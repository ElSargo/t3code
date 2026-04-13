#!/usr/bin/env python3

import os
import pathlib
import shutil
import sqlite3
import subprocess
import sys
from urllib.parse import quote

import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib


BUS_NAME = "org.t3tools.T3Code.Runner"
OBJECT_PATH = "/SessionsRunner"
RUNNER_INTERFACE = "org.kde.krunner1"
QUERY_LIMIT = 8
DEFAULT_ICON = "t3code"
DEFAULT_BASE_DIR = pathlib.Path(os.environ.get("T3CODE_HOME", "~/.t3")).expanduser()
STATE_DIR = DEFAULT_BASE_DIR / "userdata"
DB_PATH = STATE_DIR / "state.sqlite"
ENVIRONMENT_ID_PATH = STATE_DIR / "environment-id"
REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]


def _load_environment_id() -> str | None:
  try:
    value = ENVIRONMENT_ID_PATH.read_text(encoding="utf-8").strip()
  except FileNotFoundError:
    return None
  return value or None


def _launcher_command() -> list[str]:
  launcher = shutil.which("t3code")
  if launcher:
    return [launcher]

  fallback = pathlib.Path.home() / ".local" / "bin" / "t3code"
  if fallback.exists():
    return [str(fallback)]

  return ["xdg-open"]


def _launch_thread(environment_id: str, thread_id: str) -> None:
  deep_link = f"t3://thread/{quote(environment_id, safe='')}/{quote(thread_id, safe='')}"
  command = _launcher_command()
  if pathlib.Path(command[0]).name == "xdg-open":
    command.append(deep_link)
  else:
    command.append(deep_link)

  subprocess.Popen(
    command,
    cwd=str(REPO_ROOT),
    start_new_session=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
  )


def _normalize_query(raw_query: str) -> tuple[str, bool]:
  query = " ".join(raw_query.strip().split())
  lowered = query.casefold()
  for prefix in ("t3 ", "thread ", "threads ", "session ", "sessions "):
    if lowered.startswith(prefix):
      return query[len(prefix) :].strip(), True

  if lowered in {"t3", "thread", "threads", "session", "sessions"}:
    return "", True

  return query, False


def _thread_rows() -> list[dict[str, str | None]]:
  if not DB_PATH.exists():
    return []

  connection = sqlite3.connect(DB_PATH)
  connection.row_factory = sqlite3.Row
  try:
    rows = connection.execute(
      """
      SELECT
        threads.thread_id AS thread_id,
        threads.title AS thread_title,
        threads.updated_at AS updated_at,
        threads.worktree_path AS worktree_path,
        projects.title AS project_title,
        projects.workspace_root AS workspace_root,
        sessions.status AS session_status
      FROM projection_threads AS threads
      INNER JOIN projection_projects AS projects
        ON projects.project_id = threads.project_id
      LEFT JOIN projection_thread_sessions AS sessions
        ON sessions.thread_id = threads.thread_id
      WHERE threads.deleted_at IS NULL
        AND threads.archived_at IS NULL
        AND projects.deleted_at IS NULL
      ORDER BY threads.updated_at DESC, threads.thread_id DESC
      LIMIT 64
      """,
    ).fetchall()
  finally:
    connection.close()

  return [dict(row) for row in rows]


def _status_label(status: str | None) -> str:
  if status == "running":
    return "running"
  if status == "ready":
    return "ready"
  if status == "stopped":
    return "stopped"
  return "idle"


def _workspace_label(row: dict[str, str | None]) -> str:
  worktree_path = row.get("worktree_path")
  workspace_root = row.get("workspace_root")
  target_path = worktree_path or workspace_root or ""
  try:
    return pathlib.Path(target_path).name or target_path
  except Exception:
    return target_path


def _score_row(row: dict[str, str | None], query: str, index: int) -> float | None:
  title = (row.get("thread_title") or "").casefold()
  project = (row.get("project_title") or "").casefold()
  workspace = _workspace_label(row).casefold()
  haystack = " ".join(part for part in (title, project, workspace) if part)
  if not query:
    base = 0.58 - min(index, 8) * 0.03
    if row.get("session_status") == "running":
      base += 0.08
    return max(0.05, min(base, 0.95))

  tokens = [token for token in query.casefold().split(" ") if token]
  if not tokens:
    return None
  if any(token not in haystack for token in tokens):
    return None

  score = 0.28
  if title.startswith(query.casefold()):
    score += 0.34
  elif query.casefold() in title:
    score += 0.24
  elif project.startswith(query.casefold()):
    score += 0.2
  elif query.casefold() in project:
    score += 0.14
  elif query.casefold() in workspace:
    score += 0.1

  if row.get("session_status") == "running":
    score += 0.1
  score += max(0.0, 0.12 - index * 0.01)
  return min(score, 0.99)


def _subtext(row: dict[str, str | None]) -> str:
  parts = [
    row.get("project_title") or "Project",
    _workspace_label(row),
    _status_label(row.get("session_status")),
  ]
  return " • ".join(part for part in parts if part)


def _match_rows(raw_query: str) -> list[tuple[str, str, str, int, float, dict[str, dbus.String]]]:
  environment_id = _load_environment_id()
  if environment_id is None:
    return []

  query, explicit_prefix = _normalize_query(raw_query)
  if not explicit_prefix and len(query) < 2:
    return []

  matches = []
  for index, row in enumerate(_thread_rows()):
    score = _score_row(row, query, index)
    if score is None:
      continue

    thread_id = row.get("thread_id")
    if not thread_id:
      continue

    title = row.get("thread_title") or "Untitled thread"
    match_id = f"{environment_id}:{thread_id}"
    matches.append(
      (
        match_id,
        title,
        DEFAULT_ICON,
        100,
        float(score),
        {"subtext": dbus.String(_subtext(row))},
      )
    )

  matches.sort(key=lambda match: match[4], reverse=True)
  return matches[:QUERY_LIMIT]


class T3CodeSessionsRunner(dbus.service.Object):
  @dbus.service.method(RUNNER_INTERFACE, in_signature="", out_signature="a{sv}")
  def Config(self):
    return {
      "MinLetterCount": dbus.Int64(2),
    }

  @dbus.service.method(RUNNER_INTERFACE, in_signature="", out_signature="a(sss)")
  def Actions(self):
    return []

  @dbus.service.method(RUNNER_INTERFACE, in_signature="s", out_signature="a(sssida{sv})")
  def Match(self, query):
    return _match_rows(query)

  @dbus.service.method(RUNNER_INTERFACE, in_signature="ss", out_signature="")
  def Run(self, match_id, action_id):
    del action_id
    environment_id, _, thread_id = str(match_id).partition(":")
    if not environment_id or not thread_id:
      return
    _launch_thread(environment_id, thread_id)


def main() -> int:
  DBusGMainLoop(set_as_default=True)
  session_bus = dbus.SessionBus()
  bus_name = dbus.service.BusName(BUS_NAME, bus=session_bus, allow_replacement=False)
  T3CodeSessionsRunner(bus_name, OBJECT_PATH)
  loop = GLib.MainLoop()
  loop.run()
  return 0


if __name__ == "__main__":
  sys.exit(main())

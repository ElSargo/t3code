import * as OS from "node:os";
import { spawnSync } from "node:child_process";
import { Effect, Path } from "effect";
import { readPathFromLoginShell, resolveLoginShell } from "@t3tools/shared/shell";

const CHILD_PROCESS_PRIORITY = OS.constants.priority.PRIORITY_LOW;

interface DeprioritizeChildProcessOptions {
  setPriority?: typeof OS.setPriority;
  spawnSync?: typeof spawnSync;
  platform?: NodeJS.Platform;
}

export function fixPath(
  options: {
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    readPath?: typeof readPathFromLoginShell;
  } = {},
): void {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin" && platform !== "linux") return;

  const env = options.env ?? process.env;

  try {
    const shell = resolveLoginShell(platform, env.SHELL);
    if (!shell) return;
    const result = (options.readPath ?? readPathFromLoginShell)(shell);
    if (result) {
      env.PATH = result;
    }
  } catch {
    // Silently ignore — keep default PATH
  }
}

export function deprioritizeChildProcess(
  pid: number | undefined | null,
  options: DeprioritizeChildProcessOptions = {},
): void {
  const numericPid = typeof pid === "number" ? pid : Number.NaN;
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    return;
  }

  const platform = options.platform ?? process.platform;
  const setPriority = options.setPriority ?? OS.setPriority;

  try {
    setPriority(numericPid, CHILD_PROCESS_PRIORITY);
  } catch {
    // Ignore priority failures and keep the child running normally.
  }

  if (platform !== "linux") {
    return;
  }

  try {
    (options.spawnSync ?? spawnSync)("ionice", ["-c", "3", "-p", String(numericPid)], {
      stdio: "ignore",
    });
  } catch {
    // `ionice` is optional; ignore when unavailable or unsupported.
  }
}

export const expandHomePath = Effect.fn(function* (input: string) {
  const { join } = yield* Path.Path;
  if (input === "~") {
    return OS.homedir();
  }
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return join(OS.homedir(), input.slice(2));
  }
  return input;
});

export const resolveBaseDir = Effect.fn(function* (raw: string | undefined) {
  const { join, resolve } = yield* Path.Path;
  if (!raw || raw.trim().length === 0) {
    return join(OS.homedir(), ".t3");
  }
  return resolve(yield* expandHomePath(raw.trim()));
});

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
PYTHON_BIN="${PYTHON:-$(command -v python3)}"

if [[ -z "$PYTHON_BIN" ]]; then
  printf 'python3 is required for the T3 Code KRunner integration.\n' >&2
  exit 1
fi

PLUGIN_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/krunner/dbusplugins"
SERVICE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/dbus-1/services"
PLUGIN_TARGET="$PLUGIN_DIR/t3code-sessions.desktop"
SERVICE_TARGET="$SERVICE_DIR/org.t3tools.T3Code.Runner.service"

mkdir -p "$PLUGIN_DIR" "$SERVICE_DIR"
install -m 0644 "$SCRIPT_DIR/t3code-sessions.desktop" "$PLUGIN_TARGET"
chmod 0755 "$SCRIPT_DIR/t3code_krunner.py"

cat >"$SERVICE_TARGET" <<EOF
[D-BUS Service]
Name=org.t3tools.T3Code.Runner
Exec=$PYTHON_BIN $REPO_ROOT/contrib/kde/t3code_krunner.py
EOF

dbus-send --session --dest=org.freedesktop.DBus --type=method_call \
  /org/freedesktop/DBus org.freedesktop.DBus.ReloadConfig >/dev/null 2>&1 || true

if command -v kquitapp6 >/dev/null 2>&1; then
  kquitapp6 krunner >/dev/null 2>&1 || true
fi

if command -v krunner >/dev/null 2>&1; then
  nohup krunner >/dev/null 2>&1 &
fi

printf 'Installed T3 Code KRunner integration.\n'
printf 'Plugin: %s\n' "$PLUGIN_TARGET"
printf 'Service: %s\n' "$SERVICE_TARGET"

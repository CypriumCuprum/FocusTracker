#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
BINARY_SRC="$APP_DIR/src-tauri/target/release/focustracker"
BINARY_DST="$HOME/.local/bin/focustracker"

echo "==> Building FocusTracker..."
cd "$APP_DIR"
npm install
npx tauri build

echo "==> Installing binary to $BINARY_DST..."
mkdir -p "$HOME/.local/bin"
cp "$BINARY_SRC" "$BINARY_DST"
chmod +x "$BINARY_DST"

# Reload systemd service if it exists
if systemctl --user list-unit-files focustracker.service &>/dev/null; then
    echo "==> Restarting focustracker service..."
    systemctl --user daemon-reload
    systemctl --user restart focustracker.service
    echo "==> Done. Service restarted."
else
    echo "==> Done. Run the app with: focustracker"
    echo "    (Make sure ~/.local/bin is in your PATH)"
fi

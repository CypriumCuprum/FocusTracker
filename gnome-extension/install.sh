#!/usr/bin/env bash
set -e

DEST="$HOME/.local/share/gnome-shell/extensions/focustracker@cup.local"
mkdir -p "$DEST"
cp metadata.json extension.js "$DEST/"
echo "Installed to $DEST"
echo "Run: gnome-extensions enable focustracker@cup.local"
echo "Then log out and log back in (Wayland requires full session restart)."

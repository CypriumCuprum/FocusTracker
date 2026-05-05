# FocusTracker

A lightweight, privacy-first screen time tracker for Linux (Ubuntu/GNOME). Built with Rust + Tauri, FocusTracker runs silently in the background, recording which desktop apps and websites you spend time on — with zero cloud dependency and a sub-100MB footprint.

---

## Features

### 📊 Daily Insight
- **Hourly histogram** — see your screen time distribution across the day, hour by hour.
- **App usage ranking** — apps sorted by total time spent, from most to least.
- **Browser drill-down** — websites tracked inside the browser are grouped as sub-items under their parent browser entry, preventing double-counting.
- **App drill-down** — click any app or website to see its specific hourly usage timeline.

### 📈 Statistics
- Weekly, monthly, and yearly overview charts.
- Per-app history — drill into any app to see its usage trend over time.

### ✅ Task Manager
- Add, complete, and delete tasks.
- 3-level priority system: **High**, **Medium**, **Low**.
- Due date support.

### 🔔 System Tray
- Runs silently in the background as a tray icon.
- Click to show dashboard, right-click for quick actions.
- Closing the window hides it to tray — the app keeps tracking.

### ⚡ Performance
- ~50–100 MB RAM usage in the background.
- Binary size under 20 MB.
- Starts in under 1 second.

---

## Architecture

FocusTracker is made up of 3 components that work together:

```
┌─────────────────────────┐      WebSocket       ┌───────────────────────┐
│   GNOME Shell Extension  │ ──────────────────►  │                       │
│  (active window events)  │   ws://127.0.0.1:8080 │   FocusTracker App    │
└─────────────────────────┘                       │   (Tauri + Rust)      │
                                                  │   SQLite Database     │
┌─────────────────────────┐      WebSocket       │                       │
│   Browser Extension      │ ──────────────────►  │                       │
│  (website time tracking) │                      └───────────────────────┘
└─────────────────────────┘
```

| Component | Tech | Role |
|-----------|------|------|
| Desktop App | Rust + Tauri + React | UI, database, WebSocket server |
| GNOME Extension | GJS (GNOME JavaScript) | Tracks active window on Wayland |
| Browser Extension | Chrome Extension MV3 | Tracks active website per tab |

---

## Installation Guide

### Prerequisites

Make sure the following are installed on your system:

```bash
# Node.js (v18+)
node --version

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Tauri system dependencies (Ubuntu/Debian)
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev
```

---

### Step 1 — Clone the repository

```bash
git clone <repo-url> FocusTracker
cd FocusTracker
```

---

### Step 2 — Build the Desktop App

```bash
cd app
npm install
npx tauri build
```

> ⏳ First build takes 5–15 minutes (compiling Rust dependencies). Subsequent builds are much faster.

After building, the binary is located at:
```
app/src-tauri/target/release/focustracker
```

---

### Step 3 — Install the binary

```bash
mkdir -p ~/.local/bin
cp app/src-tauri/target/release/focustracker ~/.local/bin/focustracker
chmod +x ~/.local/bin/focustracker
```

Make sure `~/.local/bin` is in your PATH. Add this to `~/.zshrc` or `~/.bashrc` if needed:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

### Step 4 — Set up autostart (systemd)

Create the service file:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/focustracker.service << 'EOF'
[Unit]
Description=FocusTracker - Screen Time Tracker
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=%h/.local/bin/focustracker
Restart=on-failure
RestartSec=5s
Environment=DISPLAY=:0
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000

[Install]
WantedBy=graphical-session.target
EOF
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable focustracker.service
systemctl --user start focustracker.service
```

Verify it is running:

```bash
systemctl --user status focustracker
```

---

### Step 5 — Add convenience alias (optional)

Add to `~/.zshrc` (or `~/.bashrc`):

```bash
echo "alias focustracker='systemctl --user start focustracker'" >> ~/.zshrc
source ~/.zshrc
```

Now you can type `focustracker` in any terminal to launch the app.

---

### Step 6 — Install the GNOME Extension (Desktop App Tracking)

The GNOME extension is required to track which desktop application is currently in focus on Wayland.

```bash
# Create extension directory
mkdir -p ~/.local/share/gnome-shell/extensions/focustracker@cup.local

# Copy extension files
cp gnome-extension/extension.js ~/.local/share/gnome-shell/extensions/focustracker@cup.local/
cp gnome-extension/metadata.json ~/.local/share/gnome-shell/extensions/focustracker@cup.local/
```

Restart GNOME Shell (you must **log out and log back in** on Wayland):

```bash
# After logging back in, enable the extension:
gnome-extensions enable focustracker@cup.local
```

Verify it is active:

```bash
gnome-extensions list --enabled | grep focustracker
```

---

### Step 7 — Install the Browser Extension (Website Tracking)

#### Chrome / Brave / Edge

1. Open `chrome://extensions/` (or `brave://extensions/`)
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `browser-extension/` folder from this repository
5. Done — the extension runs silently in the background

#### Firefox (Permanent installation)

Firefox requires extensions to be signed for permanent installation:

1. Zip the extension files:
   ```bash
   cd browser-extension
   zip -j focustracker.zip background.js manifest.json
   ```
2. Go to [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/) and log in
3. Click **Submit a New Add-on** → choose **"On your own"** (Unlisted)
4. Upload the `.zip` file — Mozilla signs it automatically within seconds
5. Download the resulting `.xpi` file
6. Drag and drop the `.xpi` into any Firefox window to install permanently

> **Temporary installation** (removed on Firefox restart): Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `background.js`

---

## Daily Usage

| Action | How |
|--------|-----|
| Start app | `focustracker` in terminal, or it auto-starts on login |
| Show dashboard | Click the tray icon, or right-click → "Show Dashboard" |
| Stop tracking | Right-click tray icon → "Quit FocusTracker" |
| Restart service | `systemctl --user restart focustracker` |
| Check status | `systemctl --user status focustracker` |
| View logs | `journalctl --user -u focustracker -f` |

---

## Data Storage

All data is stored locally in SQLite at:

```
~/.local/share/FocusTracker/database.sqlite
```

No data ever leaves your machine.

---

## License

MIT

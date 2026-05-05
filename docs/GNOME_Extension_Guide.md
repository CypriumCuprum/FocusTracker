# Comprehensive Guide: GNOME Shell Extension for Active Window Tracking

This document explains the architecture and implementation of the GNOME Shell Extension used by FocusTracker. Because Wayland's security model strictly prohibits standard applications from querying the active window of other applications, a GNOME extension running within the compositor itself is required.

## 1. Extension Architecture

A GNOME extension is written in GJS (GNOME JavaScript), which provides JavaScript bindings to C libraries (like GLib, Gio, and Soup). The extension requires two primary files:

- `metadata.json`: Contains the UUID, name, description, and compatible GNOME shell versions.
- `extension.js`: Contains the core logic with `enable()` and `disable()` lifecycle hooks.

## 2. Core Logic Workflow

1. **Event Listening:**
   - The extension connects to the `notify::focus-window` signal on `global.display`. This signal fires immediately every time the user switches the active window.

2. **Window Identification:**
   - When the signal triggers, the extension retrieves the currently focused window object using `global.display.get_focus_window()`.
   - It extracts the `wm_class` (Window Manager Class) or the human-readable application name (e.g., "Visual Studio Code", "Discord", "GNOME Terminal").

3. **Data Transmission (Communication with Rust Backend):**
   - The extension uses the `Soup` library (GNOME's HTTP client) to send a lightweight, asynchronous HTTP POST request to the Tauri backend (which will host a tiny local HTTP listener, e.g., at `http://127.0.0.1:8080/log_app`).
   - *Note:* It is more efficient for the extension to simply notify the backend *when* a switch happens and *what* the new app is. The Rust backend will then start its own timer to accumulate the focus duration.

## 3. Implementation Code (Draft)

**`metadata.json`:**
```json
{
  "uuid": "focustracker@cup.local",
  "name": "FocusTracker Window Monitor",
  "description": "Sends active window changes to the FocusTracker app.",
  "shell-version": [ "42", "43", "44", "45", "46" ],
  "url": ""
}
```

**`extension.js`:**
```javascript
const { Meta, Shell, Soup, GLib } = imports.gi;

let focusWindowId = null;
let session = null;

function notifyBackend(appName) {
    if (!session) {
        // Initialize HTTP Session
        session = new Soup.Session();
    }
    
    let message = Soup.Message.new('POST', 'http://127.0.0.1:8080/log_app');
    let payload = JSON.stringify({ source: 'desktop', app_name: appName });
    
    // Send the data asynchronously to avoid blocking the GNOME UI thread
    message.set_request_body_from_bytes(
        'application/json',
        new GLib.Bytes(payload)
    );
    session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, null);
}

function onWindowFocusChanged() {
    let window = global.display.get_focus_window();
    if (window) {
        // Try to get the application name
        let tracker = Shell.WindowTracker.get_default();
        let app = tracker.get_window_app(window);
        let appName = app ? app.get_name() : window.get_wm_class();
        
        if (appName) {
            notifyBackend(appName);
        }
    }
}

export default class FocusTrackerExtension {
    enable() {
        // Hook into the window focus event
        focusWindowId = global.display.connect(
            'notify::focus-window', 
            onWindowFocusChanged
        );
    }

    disable() {
        // Clean up when extension is disabled
        if (focusWindowId) {
            global.display.disconnect(focusWindowId);
            focusWindowId = null;
        }
        session = null;
    }
}
```

## 4. Installation and Testing

Because this is a custom extension for personal use, it is installed locally rather than through the GNOME Extensions website.

1. Create a directory named matching the UUID in the extensions folder:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/focustracker@cup.local
   ```
2. Place `metadata.json` and `extension.js` inside the directory.
3. Restart GNOME Shell:
   - On **Wayland**: You must log out of your Ubuntu session and log back in.
   - On **X11**: Press `Alt+F2`, type `r`, and press `Enter`.
4. Enable the extension via the terminal:
   ```bash
   gnome-extensions enable focustracker@cup.local
   ```
5. The extension will silently run in the background, pushing active window changes to your FocusTracker app.

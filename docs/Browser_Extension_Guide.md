# Comprehensive Guide: Social Media Tracking Browser Extension

This document explains the functionality and provides detailed instructions for the Browser Extension accompanying the FocusTracker application. Due to OS security barriers (especially Wayland on Ubuntu), a browser extension is the most accurate solution to track active time spent on specific URLs.

## 1. Extension Architecture

This is a standard extension supporting Chrome (Manifest V3) and can be easily ported to Firefox. Key components:

- `manifest.json`: Contains metadata and required permissions.
- `background.js` (or Service Worker): Runs continuously in the background to manage WebSocket connections with the Desktop App and calculate time intervals.
- `content.js` (Optional): Injected into web pages to extract further information (not strictly necessary if only tracking URLs).

## 2. Workflow

1. **Tab Tracking:**
   - `background.js` listens to events: `chrome.tabs.onActivated` (tab switching) and `chrome.tabs.onUpdated` (page loading).
   - It also listens to `chrome.windows.onFocusChanged` to determine if the browser is currently the active focused window on Ubuntu (if you minimize the browser, time tracking for social media will pause).

2. **Connecting to Desktop App (WebSocket):**
   - The extension opens a local WebSocket connection to `ws://127.0.0.1:8080` hosted by the Tauri Rust backend.
   - It features an **Auto-reconnect** mechanism. If the desktop app is closed, the extension will repeatedly attempt to reconnect every few seconds.

3. **Accumulating and Sending Data:**
   - As you browse, the extension accurately calculates elapsed time and accumulates it locally for each website.
   - Periodically (e.g., every 60 seconds), it sends a batch of payloads via WebSocket for all tracked platforms:
     ```json
     {
       "action": "log_time",
       "platform": "youtube.com",
       "duration_seconds": 45
     }
     ```
   - The Tauri app receives this and saves it to SQLite.

## 3. Core Logic (Draft Code)

**`manifest.json` (Snippet):**
```json
{
  "manifest_version": 3,
  "name": "FocusTracker Extension",
  "version": "1.0",
  "permissions": ["tabs", "idle"],
  "host_permissions": ["*://*.facebook.com/*", "*://*.youtube.com/*", "*://x.com/*"],
  "background": {
    "service_worker": "background.js"
  }
}
```

**`background.js` (Core Logic):**
```javascript
const WS_URL          = 'ws://127.0.0.1:8080';
const REPORT_INTERVAL = 60000; // 1 minute

let ws              = null;
let currentPlatform = null;
let lastTick        = Date.now();
let browserFocused  = true;
let timeAccumulator = {};

// Connect to Desktop App
function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    ws.onclose = () => setTimeout(connectWebSocket, 5000); // Retry after 5s
}
connectWebSocket();

// Extract platform from URL
function getPlatformFromUrl(url) {
    if (!url) return null;
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        return host;
    } catch {}
    return null;
}

// Calculate and accumulate elapsed time
function flushCurrentTime() {
    if (currentPlatform) {
        const elapsedSeconds = (Date.now() - lastTick) / 1000;
        if (elapsedSeconds > 0) {
            timeAccumulator[currentPlatform] = (timeAccumulator[currentPlatform] || 0) + elapsedSeconds;
        }
    }
    lastTick = Date.now();
}

// Update current active tab state
async function updateCurrentTab() {
    flushCurrentTime();
    if (!browserFocused) {
        currentPlatform = null;
        return;
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentPlatform = tabs[0]?.url ? getPlatformFromUrl(tabs[0].url) : null;
    lastTick = Date.now();
}

// Send periodic accumulated reports
setInterval(() => {
    flushCurrentTime();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    for (const platform in timeAccumulator) {
        const duration = Math.round(timeAccumulator[platform]);
        if (duration > 0) {
            ws.send(JSON.stringify({ action: 'log_time', platform, duration_seconds: duration }));
        }
    }
    timeAccumulator = {}; // Clear after sending
}, REPORT_INTERVAL);

// Event Listeners
chrome.tabs.onActivated.addListener(updateCurrentTab);
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.status === 'complete') updateCurrentTab(); });
chrome.windows.onFocusChanged.addListener(winId => {
    browserFocused = winId !== chrome.windows.WINDOW_ID_NONE;
    updateCurrentTab();
});
```

## 4. Installation Guide (Developer/Internal Use)

Since this is for personal offline use, we don't need to publish it to public extension stores.

### 4.1. Google Chrome, Brave, or Edge
1. Open your Chromium-based browser.
2. Navigate to: `chrome://extensions/`
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the folder containing the Extension source code (e.g., `FocusTracker/browser-extension`).
6. Done! The extension will now silently track time and communicate with your Desktop app.

### 4.2. Mozilla Firefox (Permanent Installation)
To install the extension permanently in Firefox without it being removed upon restart, you must sign it as an "Unlisted" add-on:
1. Zip the extension files: Inside `browser-extension`, select `background.js` and `manifest.json`, and compress them into a `.zip` file (do not zip the parent folder itself).
2. Go to the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/) and log in with a Firefox account.
3. Click **"Submit a New Add-on"**.
4. Important: For distribution, select **"On your own"** (Unlisted).
5. Upload your `.zip` file. Mozilla's automated system will scan and sign it in seconds.
6. Once approved, download the resulting **`.xpi`** file.
7. Drag and drop the `.xpi` file directly into any Firefox window to install it permanently.
*(Note: A temporary installation can also be done via `about:debugging#/runtime/this-firefox` -> "Load Temporary Add-on", but it will be removed when Firefox is closed).*

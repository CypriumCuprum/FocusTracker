const WS_URL = 'ws://127.0.0.1:8080';
const REPORT_INTERVAL = 60000;

let ws = null;
let currentPlatform = null;
let lastTick = Date.now();
let browserFocused = true;
let timeAccumulator = {};

function getPlatform(url) {
  if (!url) return null;
  try {
    const { hostname, protocol } = new URL(url);
    if (!['http:', 'https:'].includes(protocol)) return null;
    const host = hostname.replace(/^www\./, '');
    // Skip localhost and bare IP addresses
    if (!host || host === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;
    return host;
  } catch { }
  return null;
}

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => console.log('[FocusTracker] WS connected');
  ws.onerror = () => { };
  ws.onclose = () => {
    ws = null;
    setTimeout(connect, 5000);
  };
}
connect();

function flushCurrentTime() {
  if (currentPlatform) {
    const now = Date.now();
    const elapsedSeconds = (now - lastTick) / 1000;
    if (elapsedSeconds > 0) {
      timeAccumulator[currentPlatform] = (timeAccumulator[currentPlatform] || 0) + elapsedSeconds;
    }
  }
  lastTick = Date.now();
}

async function updateTab() {
  flushCurrentTime();
  if (!browserFocused) {
    currentPlatform = null;
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  currentPlatform = tabs[0]?.url ? getPlatform(tabs[0].url) : null;
  lastTick = Date.now();
}

setInterval(() => {
  flushCurrentTime();

  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  for (const platform in timeAccumulator) {
    const duration = Math.round(timeAccumulator[platform]);
    if (duration > 0) {
      ws.send(JSON.stringify({ action: 'log_time', platform, duration_seconds: duration }));
    }
  }
  timeAccumulator = {};
}, REPORT_INTERVAL);

chrome.tabs.onActivated.addListener(updateTab);
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.status === 'complete') updateTab(); });
chrome.windows.onFocusChanged.addListener(winId => {
  browserFocused = winId !== chrome.windows.WINDOW_ID_NONE;
  updateTab();
});

function flushAndSend() {
  flushCurrentTime();
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  for (const platform in timeAccumulator) {
    const duration = Math.round(timeAccumulator[platform]);
    if (duration > 0) {
      ws.send(JSON.stringify({ action: 'log_time', platform, duration_seconds: duration }));
    }
  }
  timeAccumulator = {};
}

chrome.tabs.onRemoved.addListener(flushAndSend);
chrome.windows.onRemoved.addListener(flushAndSend);

updateTab();

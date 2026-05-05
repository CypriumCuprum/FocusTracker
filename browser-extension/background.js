const WS_URL = 'ws://127.0.0.1:8080';
const REPORT_INTERVAL = 10000; // 10 seconds

let ws = null;
let currentPlatform = null;
let lastTick = Date.now();
let browserFocused = true;

// ── Accumulator backed by session storage (survives SW restarts) ──────────────

async function getAccumulator() {
  const result = await chrome.storage.session.get('acc');
  return result.acc || {};
}

async function addToAccumulator(platform, seconds) {
  const acc = await getAccumulator();
  acc[platform] = (acc[platform] || 0) + seconds;
  await chrome.storage.session.set({ acc });
}

async function clearAccumulator() {
  await chrome.storage.session.set({ acc: {} });
}

// ── Platform helper ───────────────────────────────────────────────────────────

function getPlatform(url) {
  if (!url) return null;
  try {
    const { hostname, protocol } = new URL(url);
    if (!['http:', 'https:'].includes(protocol)) return null;
    const host = hostname.replace(/^www\./, '');
    if (!host || host === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;
    return host;
  } catch { }
  return null;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

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

// ── Time tracking ─────────────────────────────────────────────────────────────

async function flushCurrentTime() {
  if (currentPlatform) {
    const now = Date.now();
    const elapsedSeconds = (now - lastTick) / 1000;
    if (elapsedSeconds > 0) {
      await addToAccumulator(currentPlatform, elapsedSeconds);
    }
  }
  lastTick = Date.now();
}

async function updateTab() {
  await flushCurrentTime();
  if (!browserFocused) {
    currentPlatform = null;
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  currentPlatform = tabs[0]?.url ? getPlatform(tabs[0].url) : null;
  lastTick = Date.now();
}

// ── Periodic send ─────────────────────────────────────────────────────────────

async function flushAndSend() {
  await flushCurrentTime();
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const acc = await getAccumulator();
  for (const platform in acc) {
    const duration = Math.round(acc[platform]);
    if (duration > 0) {
      ws.send(JSON.stringify({ action: 'log_time', platform, duration_seconds: duration }));
    }
  }
  await clearAccumulator();
}

setInterval(flushAndSend, REPORT_INTERVAL);

// ── Event listeners ───────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(updateTab);
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.status === 'complete') updateTab(); });
chrome.windows.onFocusChanged.addListener(winId => {
  browserFocused = winId !== chrome.windows.WINDOW_ID_NONE;
  updateTab();
});

chrome.tabs.onRemoved.addListener(flushAndSend);
chrome.windows.onRemoved.addListener(flushAndSend);

updateTab();

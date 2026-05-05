import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './DailyInsight.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 65%, 62%)`;
}

function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

// Compact label that fits inside a narrow bar column.
function fmtShort(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

// Normalize legacy browser process names to the canonical "Browser" string,
// matching the same logic used in ws_server.rs → normalize_app().
function normalizePlatform(name) {
  const n = name.toLowerCase();
  if (['chrome', 'chromium', 'firefox', 'brave', 'edge', 'opera'].some(b => n.includes(b))) {
    return 'Browser';
  }
  return name;
}

const DISPLAY_NAMES = {
  'youtube.com': 'YouTube',
  'facebook.com': 'Facebook',
  'x.com': 'X',
  'twitter.com': 'Twitter',
  'tiktok.com': 'TikTok',
  'instagram.com': 'Instagram',
  'reddit.com': 'Reddit',
  'twitch.tv': 'Twitch',
  'netflix.com': 'Netflix',
  'github.com': 'GitHub',
  'docs.google.com': 'Google Docs',
  'sheets.google.com': 'Google Sheets',
  'slides.google.com': 'Google Slides',
  'mail.google.com': 'Gmail',
  'discord.com': 'Discord',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
};

function displayName(p) {
  return DISPLAY_NAMES[p.toLowerCase()] ?? p;
}

const DISTRACTED_DOMAINS = new Set([
  'youtube.com', 'facebook.com', 'x.com', 'twitter.com',
  'tiktok.com', 'instagram.com', 'reddit.com', 'twitch.tv', 'netflix.com',
]);

function getSummary(stats) {
  if (!stats.length) return 'No tracking data for yesterday.';
  const dSecs = stats
    .filter(s => DISTRACTED_DOMAINS.has(s.platform.toLowerCase()))
    .reduce((n, s) => n + s.time_spent_seconds, 0);
  if (dSecs > 7200) return 'You were quite distracted yesterday.';
  if (dSecs > 3600) return 'A fair amount of time was spent distracted.';
  if (dSecs < 1800) return 'You were deeply focused yesterday.';
  return 'You stayed mostly on track yesterday.';
}

function formatYesterdayLabel() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Data helpers ───────────────────────────────────────────────────────────────

function localIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPeriodRange(period) {
  const today = new Date();
  if (period === 'Week') {
    const s = new Date(today); s.setDate(today.getDate() - 6);
    return [localIso(s), localIso(today)];
  }
  if (period === 'Month') {
    const s = new Date(today); s.setDate(today.getDate() - 29);
    return [localIso(s), localIso(today)];
  }
  const s = new Date(today); s.setFullYear(today.getFullYear() - 1); s.setDate(s.getDate() + 1);
  return [localIso(s), localIso(today)];
}

// Build a grouped ranking: top-level parent apps each carry their child sites.
// Normalizes legacy browser names (e.g. "Google Chrome" → "Browser") before
// grouping so old DB rows merge cleanly with new normalized rows.
function buildRanking(stats) {
  const parentMap = {};
  const childMap = {};

  for (const s of stats) {
    const platform = normalizePlatform(s.platform);
    const parentApp = s.parent_app ? normalizePlatform(s.parent_app) : null;
    if (parentApp) {
      if (!childMap[parentApp]) childMap[parentApp] = {};
      childMap[parentApp][platform] = (childMap[parentApp][platform] || 0) + s.time_spent_seconds;
    } else {
      parentMap[platform] = (parentMap[platform] || 0) + s.time_spent_seconds;
    }
  }

  return Object.entries(parentMap)
    .sort(([, a], [, b]) => b - a)
    .map(([platform, seconds]) => ({
      platform,
      seconds,
      children: Object.entries(childMap[platform] || {})
        .sort(([, a], [, b]) => b - a)
        .map(([p, s]) => ({ platform: p, seconds: s })),
    }));
}

// Same but for aggregated history (multiple rows per platform across dates).
function buildStatsRanking(rawHistory) {
  const parentTotals = {};
  const childTotals = {};
  const childParent = {};

  for (const s of rawHistory) {
    const platform = normalizePlatform(s.platform);
    const parentApp = s.parent_app ? normalizePlatform(s.parent_app) : null;
    if (parentApp) {
      childTotals[platform] = (childTotals[platform] || 0) + s.time_spent_seconds;
      childParent[platform] = parentApp;
    } else {
      parentTotals[platform] = (parentTotals[platform] || 0) + s.time_spent_seconds;
    }
  }

  return Object.entries(parentTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([platform, seconds]) => ({
      platform,
      seconds,
      children: Object.entries(childTotals)
        .filter(([p]) => childParent[p] === platform)
        .sort(([, a], [, b]) => b - a)
        .map(([p, s]) => ({ platform: p, seconds: s })),
    }));
}

// 24 hourly buckets. When no filterPlatform: only sum top-level (parent_app=null)
// rows so we don't double-count website time that is already inside the browser.
// When filtering to one platform: include all rows matching it (parent or child).
function buildHourlyBars(rawHourly, filterPlatform) {
  const filter = filterPlatform ? normalizePlatform(filterPlatform) : null;
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    seconds: rawHourly
      .filter(r =>
        r.hour === h &&
        (filter
          ? normalizePlatform(r.platform) === filter
          : !r.parent_app),             // top-level only for totals
      )
      .reduce((n, r) => n + r.time_spent_seconds, 0),
  }));
}

// Per-day / per-month totals. Same parent_app logic as buildHourlyBars.
function buildDailyBars(rawHistory, period, filterPlatform) {
  const filter = filterPlatform ? normalizePlatform(filterPlatform) : null;
  const src = rawHistory.filter(s =>
    filter
      ? normalizePlatform(s.platform) === filter
      : !s.parent_app,                  // top-level only for totals
  );

  const byDate = {};
  for (const s of src) byDate[s.date] = (byDate[s.date] || 0) + s.time_spent_seconds;

  if (period === 'Year') {
    const byMonth = {};
    for (const [date, secs] of Object.entries(byDate)) {
      const m = date.slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + secs;
    }
    const today = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        seconds: byMonth[monthKey] || 0,
      };
    });
  }

  const days = period === 'Week' ? 7 : 30;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const date = localIso(d);
    return {
      label: period === 'Week'
        ? d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
        : String(d.getDate()),
      seconds: byDate[date] || 0,
    };
  });
}

// ── Shared: SVG tooltip ────────────────────────────────────────────────────────

const LABEL_THRESHOLD = 20; // BAR width (px): below this → tooltip, above → inline

function BarTooltip({ cx, barTop, label }) {
  const W = Math.ceil(label.length * 6.5 + 12);
  const H = 18;
  const tx = cx - W / 2;
  const ty = Math.max(barTop - H - 6, 2);
  return (
    <g transform={`translate(${tx},${ty})`} pointerEvents="none">
      <rect width={W} height={H} rx={4}
        fill="rgba(15,23,42,0.92)" stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
      <text x={W / 2} y={H / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fill="rgba(255,255,255,0.92)">
        {label}
      </text>
    </g>
  );
}

// ── Chart: Hourly ──────────────────────────────────────────────────────────────

function HourlyChart({ bars, width, height }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const maxSecs    = Math.max(...bars.map(b => b.seconds), 60);
  const count      = 24;
  const GAP        = 4;
  const BAR        = Math.max(6, Math.floor((width - GAP * (count - 1)) / count));
  const CHART_H    = Math.max(height - 28, 60);
  const svgW       = count * (BAR + GAP) - GAP;
  const showInline = BAR >= LABEL_THRESHOLD;
  const inlineSize = Math.max(7, Math.min(13, Math.round(BAR * 0.48)));
  const axisSize   = Math.max(8, Math.min(11, Math.round(BAR * 0.42)));

  const hovered     = hoveredBar !== null ? bars[hoveredBar] : null;
  const hoveredBarH = hovered?.seconds > 0
    ? Math.max((hovered.seconds / maxSecs) * CHART_H, 4) : 0;
  const showTooltip = hovered?.seconds > 0 && (!showInline || hoveredBarH < 26);

  return (
    <div className="chart-scroll">
      <svg width={svgW} height={CHART_H + 22} className="chart-svg"
        onMouseLeave={() => setHoveredBar(null)}>
        <defs>
          <linearGradient id="h-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Pass 1: bars + inline labels + x-axis labels */}
        {bars.map((b, i) => {
          const barH = b.seconds > 0 ? Math.max((b.seconds / maxSecs) * CHART_H, 4) : 0;
          const x    = i * (BAR + GAP);
          const cx   = x + BAR / 2;
          const cy   = CHART_H - barH / 2;
          return (
            <g key={i} onMouseEnter={() => setHoveredBar(i)}>
              <rect x={x} y={0} width={BAR} height={CHART_H} fill="transparent" />
              {barH > 0 ? (
                <rect x={x} y={CHART_H - barH} width={BAR} height={barH}
                  fill="url(#h-grad)" rx={4} ry={4} />
              ) : (
                <rect x={x} y={CHART_H - 2} width={BAR} height={2}
                  fill="rgba(255,255,255,0.06)" rx={1} />
              )}
              {showInline && barH >= 26 && (
                <text
                  x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={inlineSize} fill="rgba(255,255,255,0.80)"
                  transform={`rotate(-90,${cx},${cy})`}
                  pointerEvents="none"
                >
                  {fmtShort(b.seconds)}
                </text>
              )}
              {i % 6 === 0 && (
                <text x={cx} y={CHART_H + 16}
                  textAnchor="middle" fontSize={axisSize} fill="rgba(255,255,255,0.3)"
                  pointerEvents="none">
                  {i}h
                </text>
              )}
            </g>
          );
        })}

        {/* Pass 2: tooltip always on top */}
        {showTooltip && (
          <BarTooltip
            cx={hoveredBar * (BAR + GAP) + BAR / 2}
            barTop={CHART_H - hoveredBarH}
            label={fmtShort(hovered.seconds)}
          />
        )}
      </svg>
    </div>
  );
}

// ── Chart: Daily ───────────────────────────────────────────────────────────────

function DailyChart({ bars, width, height }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const maxSecs    = Math.max(...bars.map(b => b.seconds), 60);
  const count      = bars.length;
  const GAP        = count <= 7 ? 12 : count <= 12 ? 10 : 5;
  const BAR        = Math.max(8, Math.floor((width - GAP * (count - 1)) / count));
  const CHART_H    = Math.max(height - 28, 60);
  const svgW       = count * (BAR + GAP) - GAP;
  const r          = Math.min(BAR / 2, 6);
  const showInline = BAR >= LABEL_THRESHOLD;
  const inlineSize = Math.max(7, Math.min(13, Math.round(BAR * 0.48)));
  const axisSize   = Math.max(8, Math.min(11, Math.round(BAR * 0.42)));

  const hovered     = hoveredBar !== null ? bars[hoveredBar] : null;
  const hoveredBarH = hovered?.seconds > 0
    ? Math.max((hovered.seconds / maxSecs) * CHART_H, 4) : 0;
  const showTooltip = hovered?.seconds > 0 && (!showInline || hoveredBarH < 22);

  return (
    <div className="chart-scroll">
      <svg width={svgW} height={CHART_H + 22} className="chart-svg"
        onMouseLeave={() => setHoveredBar(null)}>
        <defs>
          <linearGradient id="d-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Pass 1: bars + inline labels + x-axis labels */}
        {bars.map((b, i) => {
          const barH = b.seconds > 0 ? Math.max((b.seconds / maxSecs) * CHART_H, 4) : 0;
          const x    = i * (BAR + GAP);
          const cx   = x + BAR / 2;
          const cy   = CHART_H - barH / 2;
          return (
            <g key={i} onMouseEnter={() => setHoveredBar(i)}>
              <rect x={x} y={0} width={BAR} height={CHART_H} fill="transparent" />
              {barH > 0 ? (
                <rect x={x} y={CHART_H - barH} width={BAR} height={barH}
                  fill="url(#d-grad)" rx={r} ry={r} />
              ) : (
                <rect x={x} y={CHART_H - 2} width={BAR} height={2}
                  fill="rgba(255,255,255,0.06)" rx={1} />
              )}
              {showInline && barH >= 22 && (
                <text
                  x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={inlineSize} fill="rgba(255,255,255,0.80)"
                  transform={`rotate(-90,${cx},${cy})`}
                  pointerEvents="none"
                >
                  {fmtShort(b.seconds)}
                </text>
              )}
              <text x={cx} y={CHART_H + 16}
                textAnchor="middle" fontSize={axisSize} fill="rgba(255,255,255,0.3)"
                pointerEvents="none">
                {b.label}
              </text>
            </g>
          );
        })}

        {/* Pass 2: tooltip always on top */}
        {showTooltip && (
          <BarTooltip
            cx={hoveredBar * (BAR + GAP) + BAR / 2}
            barTop={CHART_H - hoveredBarH}
            label={fmtShort(hovered.seconds)}
          />
        )}
      </svg>
    </div>
  );
}

// ── Left column: App Ranking (grouped: parent apps + indented child sites) ─────

function RankingRow({ platform, seconds, selected, onSelect, indent }) {
  return (
    <button
      className={`ranking-row ${indent ? 'ranking-row--child' : ''} ${selected === platform ? 'active' : ''}`}
      onClick={() => onSelect(selected === platform ? null : platform)}
    >
      <span className="ranking-dot" style={{ background: hashColor(platform) }} />
      <span className="ranking-name" style={{ color: hashColor(platform) }}>
        {displayName(platform)}
      </span>
      <span className="ranking-leader" />
      <span className="ranking-time">{fmt(seconds)}</span>
    </button>
  );
}

function AppRanking({ items, selected, onSelect }) {
  if (!items.length) {
    return <p className="insight-empty">No data yet.</p>;
  }
  return (
    <div className="ranking-list">
      {items.map(({ platform, seconds, children }) => (
        <div key={platform} className="ranking-group">
          <RankingRow
            platform={platform} seconds={seconds}
            selected={selected} onSelect={onSelect} indent={false}
          />
          {children && children.length > 0 && (
            <div className="ranking-children">
              {children.map(c => (
                <RankingRow
                  key={c.platform}
                  platform={c.platform} seconds={c.seconds}
                  selected={selected} onSelect={onSelect} indent={true}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Right column header when a specific app is selected ───────────────────────

function RightHeader({ platform, total, onBack }) {
  return (
    <div className="right-header">
      <button className="back-btn" onClick={onBack}>‹ Back</button>
      <span className="right-header-name" style={{ color: hashColor(platform) }}>
        {displayName(platform)}
      </span>
      <span className="right-header-total">{fmt(total)}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const PERIODS = ['Week', 'Month', 'Year'];

export default function DailyInsight({ stats }) {
  const [tab, setTab] = useState('yesterday');
  const [period, setPeriod] = useState('Week');
  const [selectedApp, setSelectedApp] = useState(null);
  const [hourlyRaw, setHourlyRaw] = useState([]);
  const [history, setHistory] = useState([]);
  const chartAreaRef = useRef(null);
  const [chartDims, setChartDims] = useState({ width: 500, height: 280 });

  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setChartDims({ width: Math.floor(width), height: Math.floor(height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const loadHourly = useCallback(() => {
    invoke('get_yesterday_hourly_stats').then(setHourlyRaw).catch(() => { });
  }, []);

  const loadHistory = useCallback(() => {
    if (tab !== 'stats') return;
    const [start, end] = getPeriodRange(period);
    invoke('get_stats_history', { startDate: start, endDate: end }).then(setHistory).catch(() => { });
  }, [tab, period]);

  useEffect(() => { loadHourly(); }, [loadHourly]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-refresh when backend emits stats-updated
  useEffect(() => {
    let unlisten;
    listen('stats-updated', () => {
      loadHourly();
      loadHistory();
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [loadHourly, loadHistory]);

  // Reset drill-down when switching tabs or periods
  useEffect(() => { setSelectedApp(null); }, [tab, period]);

  const hourlyBars = useMemo(
    () => buildHourlyBars(hourlyRaw, selectedApp),
    [hourlyRaw, selectedApp],
  );

  const dailyBars = useMemo(
    () => buildDailyBars(history, period, selectedApp),
    [history, period, selectedApp],
  );

  const yesterdayRanking = useMemo(() => buildRanking(stats), [stats]);

  const statsRanking = useMemo(() => buildStatsRanking(history), [history]);

  const ranking = tab === 'yesterday' ? yesterdayRanking : statsRanking;

  // Total for the selected app (search both parent rows and child rows)
  const selectedTotal = useMemo(() => {
    if (!selectedApp) return 0;
    for (const group of ranking) {
      if (group.platform === selectedApp) return group.seconds;
      const child = group.children?.find(c => c.platform === selectedApp);
      if (child) return child.seconds;
    }
    return 0;
  }, [selectedApp, ranking]);

  return (
    <div className="insight-view page-enter">

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="insight-tab-bar">
        <button
          className={`insight-tab ${tab === 'yesterday' ? 'active' : ''}`}
          onClick={() => setTab('yesterday')}
        >Yesterday</button>
        <button
          className={`insight-tab ${tab === 'stats' ? 'active' : ''}`}
          onClick={() => setTab('stats')}
        >Statistics</button>
      </div>

      {/* ── Top bar (date + summary OR period filter) ────────────── */}
      <div className="insight-topbar">
        {tab === 'yesterday' ? (
          <>
            <span className="insight-date-chip">{formatYesterdayLabel()}</span>
            <p className="insight-summary">{getSummary(stats)}</p>
          </>
        ) : (
          <div className="period-tabs">
            {PERIODS.map(p => (
              <button
                key={p}
                className={`period-tab ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── Two-column layout ────────────────────────────────────── */}
      <div className="insight-columns">

        {/* Left: App Ranking */}
        <div className="insight-left">
          <AppRanking
            items={ranking}
            selected={selectedApp}
            onSelect={setSelectedApp}
          />
        </div>

        {/* Right: Chart (updates on drill-down; left stays fixed) */}
        <div className="insight-right">
          {selectedApp && (
            <RightHeader
              platform={selectedApp}
              total={selectedTotal}
              onBack={() => setSelectedApp(null)}
            />
          )}
          <div className="chart-area" ref={chartAreaRef}>
            {tab === 'yesterday' ? (
              <HourlyChart bars={hourlyBars} width={chartDims.width} height={chartDims.height} />
            ) : dailyBars.every(b => b.seconds === 0) ? (
              <p className="insight-empty">No data for this period yet.</p>
            ) : (
              <DailyChart bars={dailyBars} width={chartDims.width} height={chartDims.height} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

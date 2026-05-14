import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTauriEvent } from '../../hooks/useTauriEvent';
import { formatTodayLabel } from '../../lib/format';
import {
  getSummary,
  getPeriodRange,
  buildRanking,
  buildStatsRanking,
  buildHourlyBars,
  buildDailyBars,
  buildCategoryDailyBars,
} from '../../lib/insightData';
import { HourlyChart, DailyChart } from './charts';
import { AppRanking, RightHeader } from './ranking';
import './styles.css';

const PERIODS = ['Week', 'Month', 'Year'];

export default function DailyInsight({ stats }) {
  const [tab, setTab] = useState('today');
  const [period, setPeriod] = useState('Week');
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [hourlyRaw, setHourlyRaw] = useState([]);
  const [drilldownRaw, setDrilldownRaw] = useState([]);
  const [history, setHistory] = useState([]);
  const [platformEntries, setPlatformEntries] = useState([]);
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
    invoke('get_today_hourly_stats').then(setHourlyRaw).catch(() => { });
  }, []);

  const loadHistory = useCallback(() => {
    if (tab !== 'stats') return;
    const [start, end] = getPeriodRange(period);
    invoke('get_stats_history', { startDate: start, endDate: end }).then(setHistory).catch(() => { });
  }, [tab, period]);

  const loadPlatforms = useCallback(() => {
    invoke('get_all_platforms').then(setPlatformEntries).catch(() => { });
  }, []);

  useEffect(() => { loadHourly(); }, [loadHourly]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { loadPlatforms(); }, [loadPlatforms]);

  // Load hourly data for clicked day in drill-down
  useEffect(() => {
    if (!selectedDate) { setDrilldownRaw([]); return; }
    invoke('get_hourly_stats_for_date', { date: selectedDate }).then(setDrilldownRaw).catch(() => { });
  }, [selectedDate]);

  const reloadStats = useCallback(() => {
    loadHourly();
    loadHistory();
  }, [loadHourly, loadHistory]);
  useTauriEvent('stats-updated', reloadStats);
  useTauriEvent('categories-updated', loadPlatforms);

  // Reset drill-down when switching tabs or periods
  useEffect(() => { setSelectedApp(null); setSelectedDate(null); }, [tab, period]);

  const hourlyBars = useMemo(
    () => buildHourlyBars(hourlyRaw, selectedApp),
    [hourlyRaw, selectedApp],
  );

  const drilldownBars = useMemo(
    () => buildHourlyBars(drilldownRaw, null),
    [drilldownRaw],
  );

  const platformMap = useMemo(() => {
    const m = new Map();
    for (const p of platformEntries) {
      if (p.category_id !== null) m.set(p.platform, { name: p.category_name, color: p.category_color });
    }
    return m;
  }, [platformEntries]);

  const isStacked = useMemo(
    () => platformEntries.some(p => p.category_id !== null),
    [platformEntries],
  );

  const dailyBars = useMemo(() => {
    if (isStacked && tab === 'stats' && !selectedApp) {
      return buildCategoryDailyBars(history, period, platformMap);
    }
    return buildDailyBars(history, period, selectedApp);
  }, [history, period, selectedApp, isStacked, platformMap, tab]);

  const todayRanking = useMemo(() => buildRanking(stats), [stats]);
  const statsRanking = useMemo(() => buildStatsRanking(history), [history]);
  const ranking = tab === 'today' ? todayRanking : statsRanking;

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

      <div className="insight-tab-bar">
        <button
          className={`insight-tab ${tab === 'today' ? 'active' : ''}`}
          onClick={() => setTab('today')}
        >Today</button>
        <button
          className={`insight-tab ${tab === 'stats' ? 'active' : ''}`}
          onClick={() => setTab('stats')}
        >Statistics</button>
      </div>

      <div className="insight-topbar">
        {tab === 'today' ? (
          <>
            <span className="insight-date-chip">{formatTodayLabel()}</span>
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

      <div className="insight-columns">

        <div className="insight-left">
          <AppRanking
            items={ranking}
            selected={selectedApp}
            onSelect={setSelectedApp}
          />
        </div>

        <div className="insight-right">
          {tab === 'stats' && selectedDate ? (
            <RightHeader
              platform={new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              total={drilldownBars.reduce((n, b) => n + b.seconds, 0)}
              onBack={() => setSelectedDate(null)}
            />
          ) : selectedApp ? (
            <RightHeader
              platform={selectedApp}
              total={selectedTotal}
              onBack={() => setSelectedApp(null)}
            />
          ) : null}
          <div className="chart-area" ref={chartAreaRef}>
            {tab === 'today' ? (
              <HourlyChart bars={hourlyBars} width={chartDims.width} height={chartDims.height} />
            ) : selectedDate ? (
              drilldownBars.every(b => b.seconds === 0)
                ? <p className="insight-empty">No data for this day.</p>
                : <HourlyChart bars={drilldownBars} width={chartDims.width} height={chartDims.height} />
            ) : dailyBars.every(b => b.seconds === 0) ? (
              <p className="insight-empty">No data for this period yet.</p>
            ) : (
              <DailyChart
                bars={dailyBars}
                width={chartDims.width}
                height={chartDims.height}
                stacked={isStacked && !selectedApp}
                onBarClick={period === 'Week' ? setSelectedDate : undefined}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

import { localIso } from './format';
import { normalizePlatform, DISTRACTED_DOMAINS } from './platforms';

export function getSummary(stats) {
  if (!stats.length) return 'No tracking data for today.';
  const dSecs = stats
    .filter(s => DISTRACTED_DOMAINS.has(s.platform.toLowerCase()))
    .reduce((n, s) => n + s.time_spent_seconds, 0);
  if (dSecs > 7200) return 'You were quite distracted today.';
  if (dSecs > 3600) return 'A fair amount of time was spent distracted.';
  if (dSecs < 1800) return 'You are deeply focused today.';
  return 'You are mostly on track today.';
}

export function getPeriodRange(period) {
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

// Grouped ranking from a single day's stats: top-level parent apps each carry
// their child sites. Normalizes legacy browser names so old DB rows merge
// cleanly with new normalized rows.
export function buildRanking(stats) {
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

// Aggregated ranking across multiple days of history.
export function buildStatsRanking(rawHistory) {
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

// 24 hourly buckets. Without filterPlatform, sums only top-level rows so
// website time inside the browser isn't double-counted. With a filter,
// includes all rows matching it (parent or child).
export function buildHourlyBars(rawHourly, filterPlatform) {
  const filter = filterPlatform ? normalizePlatform(filterPlatform) : null;
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    seconds: rawHourly
      .filter(r =>
        r.hour === h &&
        (filter
          ? normalizePlatform(r.platform) === filter
          : !r.parent_app),
      )
      .reduce((n, r) => n + r.time_spent_seconds, 0),
  }));
}

export function buildDailyBars(rawHistory, period, filterPlatform) {
  const filter = filterPlatform ? normalizePlatform(filterPlatform) : null;
  const src = rawHistory.filter(s =>
    filter
      ? normalizePlatform(s.platform) === filter
      : !s.parent_app,
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
      date: period === 'Week' ? date : undefined,
    };
  });
}

// Category-aware variant for the stacked Statistics chart.
// platformMap: Map<platform, {name, color}> — only categorized platforms.
// Rows with parent_app='Browser' use the website platform name for lookup.
// Rows with no category assignment go into an 'Uncategorized' grey segment.
export function buildCategoryDailyBars(rawHistory, period, platformMap) {
  const src = rawHistory.filter(s =>
    (s.parent_app === null && s.platform !== 'Browser') ||
    s.parent_app === 'Browser'
  );

  const byDate = {};
  for (const s of src) {
    const catInfo  = platformMap.get(s.platform);
    const catKey   = catInfo ? catInfo.name  : 'Uncategorized';
    const catColor = catInfo ? catInfo.color : '#555555';
    if (!byDate[s.date]) byDate[s.date] = {};
    if (!byDate[s.date][catKey]) byDate[s.date][catKey] = { color: catColor, seconds: 0 };
    byDate[s.date][catKey].seconds += s.time_spent_seconds;
  }

  const makeSegments = cats =>
    Object.entries(cats)
      .map(([name, info]) => ({ name, color: info.color, seconds: info.seconds }))
      .sort((a, b) => b.seconds - a.seconds);

  if (period === 'Year') {
    const byMonth = {};
    for (const [date, cats] of Object.entries(byDate)) {
      const m = date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = {};
      for (const [catKey, info] of Object.entries(cats)) {
        if (!byMonth[m][catKey]) byMonth[m][catKey] = { color: info.color, seconds: 0 };
        byMonth[m][catKey].seconds += info.seconds;
      }
    }
    const today = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const segments = makeSegments(byMonth[monthKey] || {});
      return {
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        seconds: segments.reduce((n, s) => n + s.seconds, 0),
        segments,
      };
    });
  }

  const days = period === 'Week' ? 7 : 30;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const date = localIso(d);
    const segments = makeSegments(byDate[date] || {});
    return {
      label: period === 'Week'
        ? d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
        : String(d.getDate()),
      seconds: segments.reduce((n, s) => n + s.seconds, 0),
      segments,
      date: period === 'Week' ? date : undefined,
    };
  });
}

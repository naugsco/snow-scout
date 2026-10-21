// Shared by the collector and browser. Unknown is never a numeric zero.
export const SNAPSHOT_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const REPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const SNOW_KEYS = ['snow24h', 'snow48h', 'snow72h', 'daysSinceSnow', 'baseDepth', 'tempF'];
export const TERRAIN_KEYS = ['runsOpen', 'runsTotal', 'groomedRuns', 'liftsOpen'];
export const CONDITION_KEYS = [...SNOW_KEYS, ...TERRAIN_KEYS];

export function emptyMetrics() {
  return Object.fromEntries([...CONDITION_KEYS, 'forecast72h'].map((key) => [key, null]));
}

export function isFresh(timestamp, maxAge = SNAPSHOT_MAX_AGE_MS, now = Date.now()) {
  if (typeof timestamp !== 'string' || !/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp)) return false;
  const age = Number(now) - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -5 * 60 * 1000 && age <= maxAge;
}

export function finiteNumber(value, { negative = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (!negative && value < 0)) return null;
  return value;
}

export function normalizeConditionMetrics(input = {}) {
  const metrics = Object.fromEntries(CONDITION_KEYS.map((key) => [key, finiteNumber(input[key], { negative: key === 'tempF' })]));
  const issues = [];
  const snow = ['snow24h', 'snow48h', 'snow72h'];
  for (let i = 0; i < snow.length; i++) {
    for (let j = i + 1; j < snow.length; j++) {
      if (metrics[snow[i]] !== null && metrics[snow[j]] !== null && metrics[snow[i]] > metrics[snow[j]]) {
        issues.push('Cumulative snowfall totals are inconsistent.');
      }
    }
  }
  if (issues.length) {
    for (const key of [...snow, 'daysSinceSnow']) metrics[key] = null;
  }
  for (const key of TERRAIN_KEYS) {
    if (metrics[key] !== null && !Number.isInteger(metrics[key])) {
      metrics[key] = null;
      issues.push(`Invalid ${key} count.`);
    }
  }
  if (metrics.runsTotal === 0) metrics.runsTotal = null;
  if (metrics.runsOpen !== null && metrics.runsTotal !== null && metrics.runsOpen > metrics.runsTotal) {
    for (const key of TERRAIN_KEYS) metrics[key] = null;
    issues.push('Terrain counts are inconsistent.');
  }
  if (metrics.groomedRuns !== null && metrics.runsOpen !== null && metrics.groomedRuns > metrics.runsOpen) {
    metrics.groomedRuns = null;
    issues.push('Open groomed count exceeds open runs; grooming value withheld.');
  }
  return { metrics, issues: [...new Set(issues)] };
}

export function assessConditions(entry, snapshotAt, now = Date.now()) {
  const { metrics, issues } = normalizeConditionMetrics(entry?.metrics);
  const snapshotFresh = isFresh(snapshotAt, SNAPSHOT_MAX_AGE_MS, now)
    && isFresh(entry?.checkedAt, SNAPSHOT_MAX_AGE_MS, now);
  const groupStatus = (keys, timestamp, upstreamStatus) => {
    if (!entry) return 'unavailable';
    if (!snapshotFresh) return 'stale';
    if (entry?.status === 'error') return 'error';
    if (upstreamStatus && upstreamStatus !== 'ready') return upstreamStatus;
    if (!keys.some((key) => metrics[key] !== null)) return 'unavailable';
    if (!timestamp) return 'unverified';
    const shortWindow = keys === SNOW_KEYS
      ? entry?.snowSourceKind === 'model' || entry?.adapter === 'open-meteo'
      : ['checked', 'feed'].includes(entry?.terrainTimestampKind);
    if (!isFresh(timestamp, shortWindow ? SNAPSHOT_MAX_AGE_MS : REPORT_MAX_AGE_MS, now)) return 'stale';
    return 'ready';
  };
  const snowStatus = groupStatus(SNOW_KEYS, entry?.snowReportedAt, entry?.snowStatus);
  const terrainStatus = groupStatus(TERRAIN_KEYS, entry?.terrainReportedAt, entry?.terrainStatus);
  if (snowStatus !== 'ready') SNOW_KEYS.forEach((key) => { metrics[key] = null; });
  if (terrainStatus !== 'ready') TERRAIN_KEYS.forEach((key) => { metrics[key] = null; });
  if (entry?.temperatureKind === 'model' && !isFresh(entry.temperatureReportedAt, SNAPSHOT_MAX_AGE_MS, now)) metrics.tempF = null;
  return { metrics, snowStatus, terrainStatus, issues };
}

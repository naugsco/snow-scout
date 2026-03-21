import { RESORT_SOURCE_ALIASES } from './constants.js';

export function normalizeResortName(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function seeded(name, min = 0, max = 1) {
  const normalized = hashString(name) / 4294967295;
  return min + normalized * (max - min);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function rangeRound(value, step = 1) {
  return Math.round(value / step) * step;
}

export function getRegion(lat, lon) {
  if (lat > 24 && lon < -50 && lon > -170) return 'north-america';
  if (lat > 42 && lat < 48.8 && lon > 5 && lon < 15.5) return 'alps';
  if (lat > 30 && lat < 47 && lon > 128 && lon < 147) return 'japan';
  if (lat < -20) return 'south';
  return 'all';
}

export function getRegionLabel(region) {
  switch (region) {
    case 'north-america': return 'North America';
    case 'alps': return 'Alps';
    case 'japan': return 'Japan';
    case 'south': return 'Southern';
    default: return 'Global';
  }
}

export function getClimate(region) {
  if (region === 'alps') return { base: 92, forecastBoost: 1.08, tempShift: -2, totalRuns: [90, 260] };
  if (region === 'japan') return { base: 118, forecastBoost: 1.2, tempShift: -4, totalRuns: [35, 92] };
  if (region === 'south') return { base: 80, forecastBoost: 0.78, tempShift: 3, totalRuns: [28, 108] };
  return { base: 86, forecastBoost: 1, tempShift: 0, totalRuns: [45, 230] };
}

export function inferStatus(metrics) {
  if (metrics.forecast72h >= 22) return 'incoming';
  if (metrics.snow24h >= 7) return 'fresh';
  if (metrics.daysSinceSnow >= 11) return 'dry';
  return 'steady';
}

export function getStatusText(status, metrics) {
  if (status === 'incoming') return `${formatInches(metrics.forecast72h)} expected in 72h`;
  if (status === 'fresh') return `${formatInches(metrics.snow24h)} in the last 24h`;
  if (status === 'dry') return `${Number.isFinite(metrics.daysSinceSnow) ? metrics.daysSinceSnow : '—'} days since the last reset`;
  return `${formatInches(metrics.baseDepth)} base with a stable surface`;
}

export function getPassTone(resort) {
  if (resort.passes.length > 1) return 'dual';
  return resort.passes[0];
}

export function getSourceKeyForResort(name) {
  const normalized = normalizeResortName(name);
  return RESORT_SOURCE_ALIASES.get(normalized) || normalized;
}

export function formatInches(value, fallback = '—') {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.abs(value - Math.round(value)) < 0.05
    ? Math.round(value)
    : Math.round(value * 10) / 10;
  return `${rounded}"`;
}

export function formatTemperature(value, fallback = '—') {
  if (!Number.isFinite(value)) return fallback;
  return `${Math.round(value)}°F`;
}

export function formatUpdateLabel(value) {
  if (!value) return 'Update time unavailable';
  return /^updated\b/i.test(value) ? value : `Updated ${value}`;
}

export function formatRunAccess(metrics, compact = false) {
  if (Number.isFinite(metrics.runsOpen) && Number.isFinite(metrics.runsTotal)) {
    return compact
      ? `${metrics.runsOpen}/${metrics.runsTotal}`
      : `${metrics.runsOpen} of ${metrics.runsTotal} runs open`;
  }
  if (Number.isFinite(metrics.runsTotal)) {
    return compact ? `—/${metrics.runsTotal}` : `${metrics.runsTotal} total runs tracked`;
  }
  if (Number.isFinite(metrics.runsOpen)) {
    return compact ? `${metrics.runsOpen}/—` : `${metrics.runsOpen} runs open`;
  }
  return compact ? '—' : 'Run access unavailable';
}

export function formatPassLabel(resort) {
  if (resort.passes.length > 1) return 'Epic + Ikon';
  return resort.passes[0] === 'epic' ? 'Epic Pass' : 'Ikon Pass';
}

export function buildForecastUrl(resort) {
  const params = new URLSearchParams({
    latitude: resort.lat.toFixed(4),
    longitude: resort.lon.toFixed(4),
    daily: 'snowfall_sum,temperature_2m_max,temperature_2m_min,weathercode',
    forecast_days: '7',
    temperature_unit: 'fahrenheit',
    timezone: 'auto'
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function getConditionsReliability(resort) {
  if (resort.liveConditionsStatus === 'ready') return 'Official Live';
  if (getConditionsPageForResort(resort)) return 'Official Link';
  return 'Estimated';
}

export function getConditionsPageForResort(resort) {
  return resort?.liveSources?.conditions || conditionPages[getSourceKeyForResort(resort.name)] || null;
}

export function getWebcamPageForResort(resort) {
  return webcamPages[getSourceKeyForResort(resort.name)] || null;
}

// Mutable lookup maps populated by data-loader
export const conditionPages = {};
export const webcamPages = {};
export const webcamStreams = new Map();
export const forecastCache = new Map();
export const forecastRequests = new Map();

export function withCacheBust(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('_scout', String(Math.floor(Date.now() / 30000)));
    return parsed.toString();
  } catch {
    return url;
  }
}
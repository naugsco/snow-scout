import { weatherUrl } from './weather-data.js?v=20261021-sources-verified';
import { RESORT_SOURCE_ALIASES } from './constants.js?v=20261021-sources-verified';
import { state } from './state.js?v=20261021-sources-verified';

export function normalizeResortName(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

export function inferStatus(metrics) {
  if (metrics.snow24h >= 7) return 'fresh';
  if (metrics.forecast72h >= 12) return 'incoming';
  if (metrics.daysSinceSnow >= 11) return 'dry';
  return 'steady';
}

export function getStatusText(status, metrics) {
  if (status === 'incoming') return `${formatInches(metrics.forecast72h)} expected in 72h`;
  if (status === 'fresh') return `${formatInches(metrics.snow24h)} in the last 24h`;
  if (status === 'dry') return `${Number.isFinite(metrics.daysSinceSnow) ? metrics.daysSinceSnow : '—'} days since the last reset`;
  if (Number.isFinite(metrics.snow24h)) return `${formatInches(metrics.snow24h)} snowfall in the last 24h`;
  return 'Current snow report unavailable';
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
  if (state.useMetric) {
    const cm = value * 2.54;
    if (cm > 0 && cm < 0.1) return '<0.1cm';
    const rounded = cm > 0 && cm < 1 ? Math.round(cm * 10) / 10 : Math.round(cm);
    return `${rounded}cm`;
  }
  if (value > 0 && value < 0.1) return '<0.1"';
  const rounded = Math.abs(value - Math.round(value)) < 0.05
    ? Math.round(value)
    : Math.round(value * 10) / 10;
  return `${rounded}"`;
}

export function formatTemperature(value, fallback = '—') {
  if (!Number.isFinite(value)) return fallback;
  if (state.useMetric) {
    const c = (value - 32) * 5 / 9;
    return `${Math.round(c)}°C`;
  }
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
  const labels = { epic: 'Epic Pass', ikon: 'Ikon Pass', 'mountain-collective': 'Mountain Collective' };
  return resort.passes.map((pass) => labels[pass]).join(' + ');
}

export function buildForecastUrl(resort) { return weatherUrl(resort); }

export function getConditionsReliability(resort) {
  if (resort.liveConditionsStatus === 'stale') return 'Stale report withheld';
  if (resort.liveConditionsStatus === 'error') return 'Feed unavailable';
  if (resort.liveConditionsKind === 'model') return 'Weather Model';
  if (resort.liveConditionsStatus === 'ready') return 'Resort report';
  if (getConditionsPageForResort(resort)) return 'Official Link';
  return 'Unavailable';
}

export function getConditionsPageForResort(resort) {
  if (resort?.liveConditionsKind === 'model') return conditionPages[getSourceKeyForResort(resort.name)] || null;
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

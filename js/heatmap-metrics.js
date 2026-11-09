import { currentSnowfall } from './season-snowfall.js?v=20261021-sources-verified';

import { isQualityMetric, qualityAssessment } from './snow-quality.js?v=20261109-preservation';

import { isFresh } from './condition-data.js?v=20261021-sources-verified';
import { preservationCredit } from './snow-preservation.js?v=20261109-preservation';
import { forecastIsCurrent } from './weather-data.js?v=20261109-powder-alert';

import { powderAlert } from './powder-alert.js?v=20261109-powder-alert';

export const HEATMAP_METRICS = [
  { id: 'snow48h', label: 'Recent snow', period: '48h', icon: 'cloud-snow', caption: 'last 48h', description: '48-hour snowfall' },
  { id: 'season', label: 'Total snowfall', period: 'Season', icon: 'layers', caption: 'season estimate', description: 'current-season snowfall · ERA5 estimate' },
  { id: 'snow24h', label: 'Most fresh', period: '24h', icon: 'snowflake', caption: 'last 24h', description: '24-hour snowfall' },
  { id: 'forecast72h', label: 'Biggest forecast', period: 'Next 72h', icon: 'cloud', caption: 'next 72h', description: 'forecast snowfall · Next 72 hours' },
  { id: 'score', label: 'Snow potential', period: 'Snow + forecast', icon: 'sparkles', caption: 'potential score', description: 'snow potential · Weather-preserved recent snow + 72h forecast · Experimental; opening not checked' },
  { id: 'bestToday', label: 'Best today', period: 'Verified open', icon: 'snowflake', caption: 'points · experimental', description: 'best today · Recent snow, rain, temperature & wind · Verified open terrain only' },
  { id: 'powderAlert', label: 'Powder Alert', period: 'Snow + arrival', icon: 'snowflake', caption: 'Powder Alert score', description: 'Powder Alert · 6″+ incoming days, weighted toward sooner arrivals · Resort-local dates' },
  { id: 'runsOpen', label: 'Runs open', period: 'Open runs', icon: 'mountain', caption: 'runs open', description: 'number of runs open' }
];

export function snowScore(metrics, preservation) {
  const credit = preservationCredit(preservation);
  if (!Number.isFinite(metrics.forecast72h) || metrics.forecast72h < 0 || credit === null) return null;
  return metrics.forecast72h * 1.1 + credit * 1.35;
}

export function metricValue(resort, metric, catalog = null) {
  if (metric === 'powderAlert') return powderAlert(resort.liveForecast).score;
  if (metric === 'season') return currentSnowfall(resort, catalog).total;
  if (metric === 'score') return forecastIsCurrent(resort.liveForecast) && isFresh(resort.liveForecast?.snowPreservation?.asOf)
    ? snowScore({forecast72h:resort.liveForecast.forecast72h},resort.liveForecast.snowPreservation) : null;
  if (isQualityMetric(metric)) return qualityAssessment(resort, metric).value;
  const value = resort.metrics[metric];
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function rankResorts(list, metric, catalog) {
  return list.map((resort) => ({ resort, value: metricValue(resort, metric, catalog) }))
    .filter(row => (!isQualityMetric(metric) && metric !== 'powderAlert') || row.value !== null)
    .sort((a, b) => {
      if (a.value === null) return b.value === null ? a.resort.name.localeCompare(b.resort.name) : 1;
      if (b.value === null) return -1;
      return b.value - a.value || a.resort.name.localeCompare(b.resort.name);
    });
}

// White is the midpoint; unknown values use a separate neutral surface.
export function heatColor(value, minimum, maximum) {
  if (value === null) return { background: '#263342', foreground: '#c4d3e5' };
  const t = maximum > minimum ? Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) : 0.5;
  const stops = [[243, 154, 80], [241, 244, 247], [37, 137, 239]];
  const [a, b] = t <= 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const fraction = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
  const rgb = a.map((channel, i) => Math.round(channel + (b[i] - channel) * fraction));
  return { background: `rgb(${rgb.join(', ')})`, foreground: t > 0.83 ? '#fff' : '#0b1b35' };
}

// A row treemap: contiguous rectangles fill the canvas, with a minimum area
// for low/zero/missing values so every displayed resort remains readable.
export function layoutHeatmap(rows, width, height, { minRowHeight = 0 } = {}) {
  if (!rows.length || width <= 0 || height <= 0) return [];
  const known = rows.map((row) => row.value).filter(Number.isFinite);
  const minimum = Math.min(0, ...known);
  const maximum = Math.max(1, ...known) - minimum;
  const weights = rows.map((row) => row.value === null ? maximum * 0.28 : Math.max(row.value - minimum, maximum * 0.28));
  const rowCount = Math.max(1, Math.min(rows.length, Math.round(Math.sqrt(rows.length * height / width * 1.35)), minRowHeight ? Math.max(1,Math.floor(height/minRowHeight)) : rows.length));
  const reservedHeight = Math.min(minRowHeight,height/rowCount);
  const groups = [];
  let cursor = 0;
  for (let i = 0; i < rowCount; i++) {
    const remaining = rows.length - cursor;
    const count = i === rowCount - 1 ? remaining : Math.max(1, Math.round(remaining / (rowCount - i) * (0.78 + i / rowCount * 0.3)));
    groups.push({ start: cursor, count, weight: weights.slice(cursor, cursor + count).reduce((sum, value) => sum + value, 0) });
    cursor += count;
  }
  const total = weights.reduce((sum, value) => sum + value, 0);
  let y = 0;
  return groups.flatMap((group, groupIndex) => {
    const h = groupIndex === groups.length - 1 ? height - y : reservedHeight + (height-reservedHeight*rowCount) * group.weight / total;
    let x = 0;
    const rects = rows.slice(group.start, group.start + group.count).map((row, i) => {
      const w = i === group.count - 1 ? width - x : width * weights[group.start + i] / group.weight;
      const rect = { ...row, x, y, width: w, height: h };
      x += w;
      return rect;
    });
    y += h;
    return rects;
  });
}

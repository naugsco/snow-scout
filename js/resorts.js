import { RAW_RESORTS } from './constants.js?v=20261021-sources-verified';
import {
  normalizeResortName,
  getRegion, getRegionLabel, inferStatus, getStatusText
} from './utils.js?v=20261021-sources-verified';

import { emptyMetrics } from './condition-data.js?v=20261021-sources-verified';

export function enrichResort(resort, index) {
  const region = getRegion(resort.lat, resort.lon);
  const metrics = emptyMetrics();
  const status = inferStatus(metrics);
  return {
    ...resort,
    id: `${normalizeResortName(resort.name)}-${index}`,
    region,
    regionLabel: getRegionLabel(region),
    metrics,
    status,
    statusText: getStatusText(status, metrics)
  };
}

export function dedupeAndEnrich(rawResorts) {
  const aliasMap = new Map([
    ['squaw valley alpine meadows', 'palisades tahoe']
  ]);
  const merged = new Map();

  rawResorts.forEach((raw) => {
    const normalized = aliasMap.get(normalizeResortName(raw.name)) || normalizeResortName(raw.name);
    const key = `${normalized}-${raw.lat.toFixed(4)}-${raw.lon.toFixed(4)}`;
    if (!merged.has(key)) {
      merged.set(key, {
        name: normalized === 'palisades tahoe' ? 'Palisades Tahoe' : raw.name,
        lat: raw.lat,
        lon: raw.lon,
        passes: [raw.pass]
      });
      return;
    }
    const existing = merged.get(key);
    if (!existing.passes.includes(raw.pass)) existing.passes.push(raw.pass);
    if (existing.name === raw.name || existing.name === 'Palisades Tahoe') return;
    existing.name = raw.name;
  });

  return Array.from(merged.values()).map((resort, index) => enrichResort(resort, index));
}

export const resorts = dedupeAndEnrich(RAW_RESORTS);

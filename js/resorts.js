import { RAW_RESORTS } from './constants.js';
import {
  normalizeResortName, seeded, clamp, rangeRound,
  getRegion, getRegionLabel, getClimate, inferStatus, getStatusText
} from './utils.js';

export function enrichResort(resort, index) {
  const region = getRegion(resort.lat, resort.lon);
  const climate = getClimate(region);
  const seed = `${resort.name}-${resort.lat}-${resort.lon}`;
  const seedA = seeded(`${seed}-a`);
  const seedB = seeded(`${seed}-b`);
  const seedC = seeded(`${seed}-c`);
  const seedD = seeded(`${seed}-d`);
  const snow24h = rangeRound(clamp((seedA * 12 + (region === 'japan' ? 2.5 : 0) - (region === 'south' ? 1.4 : 0)), 0, 18), 1);
  const forecast72h = rangeRound(clamp((seedB * 26 + (region === 'japan' ? 6 : 0) + (index % 9 === 0 ? 8 : 0)), 0, 38), 1);
  const daysSinceSnow = rangeRound(clamp((1 - seedC) * 12 + (forecast72h > 18 ? -3 : 0) - (snow24h > 6 ? 2 : 0), 0, 16), 1);
  const baseDepth = rangeRound(clamp(climate.base + seedD * 95 + snow24h * 2.1 - daysSinceSnow * 1.3, 18, 228), 1);
  const runsTotal = Math.round(climate.totalRuns[0] + seeded(`${seed}-runs`) * (climate.totalRuns[1] - climate.totalRuns[0]));
  const openRatio = clamp(0.38 + snow24h * 0.028 + forecast72h * 0.006 - daysSinceSnow * 0.03 + seeded(`${seed}-ratio`) * 0.18, 0.16, 1);
  const runsOpen = clamp(Math.round(runsTotal * openRatio), 1, runsTotal);
  const groomedRuns = clamp(Math.round(runsOpen * clamp(0.34 + seeded(`${seed}-groom`) * 0.5, 0.28, 0.88)), 0, runsOpen);
  const tempF = Math.round(clamp(14 + seeded(`${seed}-temp`) * 22 + climate.tempShift + (region === 'south' ? 5 : 0), 4, 39));
  const metrics = { snow24h, forecast72h, daysSinceSnow, baseDepth, runsOpen, runsTotal, groomedRuns, tempF };
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
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllResorts } from './fetch_resort_conditions.mjs';
import { weatherUrl, parseWeather } from '../js/weather-data.js';
import { weatherLocation } from '../js/weather-location.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'resort-forecasts.json');

// Daily model snowfall over the past 92 days (the forecast API's limit) at the same terrain
// point as the forecast. Used only to screen resort-reported season totals.
export function seasonCheckUrl(resort) {
  const point = weatherLocation(resort);
  const params = new URLSearchParams({ latitude: point.lat.toFixed(4), longitude: point.lon.toFixed(4),
    daily: 'snowfall_sum', past_days: '92', forecast_days: '1', timezone: 'GMT' });
  if (Number.isFinite(point.elevationM)) params.set('elevation', String(point.elevationM));
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function parseSeasonCheck(payload, apiUrl) {
  if (payload?.daily_units?.snowfall_sum !== 'cm') throw new Error('Season check expected daily snowfall in cm.');
  const days = payload.daily?.time || [], snow = payload.daily?.snowfall_sum || [];
  // The last day is today (incomplete); every past day must be present. Missing is never zero.
  const past = snow.slice(0, -1);
  if (days.length !== snow.length || past.length < 90 || !past.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
    throw new Error('Season check snowfall is incomplete.');
  }
  return { snowfallInches: Math.round(past.reduce((sum, v) => sum + v, 0) / 2.54 * 10) / 10,
    from: days[0], through: days[days.length - 2], apiUrl };
}

export async function fetchSeasonCheck(resort) {
  const apiUrl = seasonCheckUrl(resort);
  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Season check request failed (HTTP ${response.status}).`);
  return parseSeasonCheck(await response.json(), apiUrl);
}

export async function fetchForecast(resort) {
  const apiUrl = weatherUrl(resort);
  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Forecast request failed (HTTP ${response.status}).`);
  const parsed = parseWeather(await response.json(), apiUrl);
  return { ...parsed.forecast, recentConditions: parsed.conditions, recentConditionsAt: parsed.observedThrough };
}

async function main() {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const resorts = {};
  const summary = { ok: 0, error: 0, preservationOk: 0, preservationUnavailable: 0 };
  for (const [key, resort] of loadAllResorts()) {
    try {
      resorts[key] = await fetchForecast(resort);
      summary.ok++;
      try { resorts[key].seasonCheck = await fetchSeasonCheck(resort); }
      catch (error) { process.stderr.write(`${resort.name}: season check unavailable — ${error.message}\n`); }
      if (resorts[key].snowPreservation.status === 'ok') summary.preservationOk++;
      else {
        summary.preservationUnavailable++;
        process.stderr.write(`${resort.name}: preservation unavailable — ${resorts[key].snowPreservation.reason}\n`);
      }
      process.stdout.write(`${resort.name}: ${resorts[key].forecast72h}" next 72 hours\n`);
    } catch (error) {
      summary.error++;
      resorts[key] = { status: 'error', error: error.message, checkedAt: new Date().toISOString() };
      process.stderr.write(`${resort.name}: ${error.message}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
  }
  await writeFile(OUTPUT_PATH, JSON.stringify({ schemaVersion: 2, generatedAt: new Date().toISOString(), summary, resorts }, null, 2) + '\n');
  process.stdout.write(`Saved ${OUTPUT_PATH}\n${JSON.stringify(summary)}\n`);
  if (!summary.ok) throw new Error('No current forecasts could be collected.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}

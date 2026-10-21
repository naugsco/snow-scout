import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllResorts } from './fetch_resort_conditions.mjs';
import { weatherUrl, parseWeather } from '../js/weather-data.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'resort-forecasts.json');

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
  const summary = { ok: 0, error: 0 };
  for (const [key, resort] of loadAllResorts()) {
    try {
      resorts[key] = await fetchForecast(resort);
      summary.ok++;
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

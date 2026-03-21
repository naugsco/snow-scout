import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SOURCES_PATH = path.join(DATA_DIR, 'resort-condition-sources.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'resort-forecasts.json');

// All resorts with lat/lon from constants.js
const RESORT_LOCATIONS = [
  { key: "vail", lat: 39.6403, lon: -106.3742 },
  { key: "beaver creek", lat: 39.6042, lon: -106.5165 },
  { key: "breckenridge", lat: 39.4817, lon: -106.0384 },
  { key: "keystone", lat: 39.6069, lon: -105.9718 },
  { key: "crested butte", lat: 38.8991, lon: -106.9653 },
  { key: "park city", lat: 40.6514, lon: -111.5080 },
  { key: "kirkwood", lat: 38.6850, lon: -120.0653 },
  { key: "heavenly", lat: 38.9353, lon: -119.9400 },
  { key: "northstar", lat: 39.2746, lon: -120.1210 },
  { key: "stowe", lat: 44.5303, lon: -72.7814 },
  { key: "okemo", lat: 43.4017, lon: -72.7170 },
  { key: "mount sunapee", lat: 43.3264, lon: -72.0819 },
  { key: "stevens pass", lat: 47.7453, lon: -121.0890 },
  { key: "whistler blackcomb", lat: 50.1163, lon: -122.9574 },
  { key: "steamboat", lat: 40.4572, lon: -106.8045 },
  { key: "winter park", lat: 39.8841, lon: -105.7625 },
  { key: "copper mountain", lat: 39.5022, lon: -106.1497 },
  { key: "eldora", lat: 39.9375, lon: -105.5828 },
  { key: "arapahoe basin", lat: 39.6425, lon: -105.8719 },
  { key: "big sky", lat: 45.2836, lon: -111.4008 },
  { key: "jackson hole", lat: 43.5877, lon: -110.8279 },
  { key: "alta", lat: 40.5884, lon: -111.6386 },
  { key: "snowbird", lat: 40.5830, lon: -111.6508 },
  { key: "deer valley", lat: 40.6375, lon: -111.4783 },
  { key: "brighton", lat: 40.5980, lon: -111.5833 },
  { key: "solitude", lat: 40.6197, lon: -111.5922 },
  { key: "mammoth", lat: 37.6308, lon: -119.0326 },
  { key: "june mountain", lat: 37.7675, lon: -119.0906 },
  { key: "big bear mountain", lat: 34.2364, lon: -116.8906 },
  { key: "palisades tahoe", lat: 39.1968, lon: -120.2354 },
  { key: "killington", lat: 43.6045, lon: -72.8201 },
  { key: "sugarbush", lat: 44.1358, lon: -72.9003 },
  { key: "stratton", lat: 43.1133, lon: -72.9081 },
  { key: "tremblant", lat: 46.2094, lon: -74.5858 },
  { key: "revelstoke", lat: 51.0267, lon: -118.1631 },
  { key: "crystal", lat: 46.9283, lon: -121.5047 },
  { key: "summit at snoqualmie", lat: 47.4206, lon: -121.4139 },
  { key: "loon", lat: 44.0364, lon: -71.6214 },
  { key: "sugarloaf", lat: 45.0314, lon: -70.3131 },
  { key: "sunday river", lat: 44.4728, lon: -70.8572 },
  { key: "taos", lat: 36.5964, lon: -105.4542 },
  { key: "snowshoe", lat: 38.4106, lon: -79.9942 },
  { key: "aspen snowmass", lat: 39.2084, lon: -106.9490 },
  { key: "telluride", lat: 37.9375, lon: -107.8123 },
  { key: "snowbasin", lat: 41.2161, lon: -111.8569 },
  { key: "sun valley", lat: 43.6975, lon: -114.3514 },
  { key: "schweitzer", lat: 48.3675, lon: -116.6225 },
  { key: "mount snow", lat: 42.9603, lon: -72.9206 },
  { key: "attitash", lat: 44.0833, lon: -71.2292 },
  { key: "hunter", lat: 42.2028, lon: -74.2258 },
  { key: "seven springs", lat: 40.0231, lon: -79.2978 }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchForecast(resort) {
  const params = new URLSearchParams({
    latitude: resort.lat.toFixed(4),
    longitude: resort.lon.toFixed(4),
    daily: 'snowfall_sum,temperature_2m_max,temperature_2m_min,weathercode',
    forecast_days: '7',
    temperature_unit: 'fahrenheit',
    timezone: 'auto'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Forecast fetch failed for ${resort.key}: ${response.status}`);
  }
  const payload = await response.json();

  const dailySnowfall = Array.isArray(payload?.daily?.snowfall_sum)
    ? payload.daily.snowfall_sum.slice(0, 7).map((v) => Math.round(((Number(v) || 0) / 2.54) * 10) / 10)
    : [];
  const forecast72h = Math.round(dailySnowfall.slice(0, 3).reduce((sum, v) => sum + v, 0) * 10) / 10;

  return {
    forecast72h,
    dailySnowfall,
    dailyTime: Array.isArray(payload?.daily?.time) ? payload.daily.time.slice(0, 7) : [],
    tempMax: Array.isArray(payload?.daily?.temperature_2m_max) ? payload.daily.temperature_2m_max.slice(0, 7).map(Number) : [],
    tempMin: Array.isArray(payload?.daily?.temperature_2m_min) ? payload.daily.temperature_2m_min.slice(0, 7).map(Number) : [],
    weatherCodes: Array.isArray(payload?.daily?.weathercode)
      ? payload.daily.weathercode.slice(0, 7)
      : Array.isArray(payload?.daily?.weather_code)
        ? payload.daily.weather_code.slice(0, 7)
        : []
  };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const results = {};
  let successCount = 0;
  let errorCount = 0;

  for (const resort of RESORT_LOCATIONS) {
    try {
      const forecast = await fetchForecast(resort);
      results[resort.key] = forecast;
      successCount++;
      process.stdout.write(`✓ ${resort.key} (${forecast.forecast72h}")\n`);
    } catch (error) {
      errorCount++;
      process.stderr.write(`✗ ${resort.key}: ${error.message}\n`);
    }
    await sleep(200);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    resorts: results
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nDone: ${successCount} forecasts fetched, ${errorCount} errors.`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
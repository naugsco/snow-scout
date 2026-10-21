import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { assessConditions, normalizeConditionMetrics, isFresh, emptyMetrics } from '../js/condition-data.js';
import { parseWeather, forecastIsCurrent } from '../js/weather-data.js';
import { loadAllResorts, collectionEntries, reportTimestamp, parseVailSnow, parseSingleDepth, collectEntry, summarizeVailTerrain, summarizePowdrOpenCount, summarizePowdrGroomedCount } from '../scripts/fetch_resort_conditions.mjs';

const now = new Date('2026-10-21T21:30:00Z');
const asOf = Math.floor(Number(now) / 3600000) * 3600;
const fresh = '2026-10-21T21:00:00Z';
function entry(metrics = {}) {
  return { status: 'ok', adapter: 'vail', checkedAt: fresh, snowReportedAt: fresh, terrainReportedAt: fresh, metrics };
}
function weatherFixture(at = now) {
  const asOf = Math.floor(Number(at) / 3600000) * 3600;
  const localToday = new Date(Number(at) - 7 * 3600000).toISOString().slice(0, 10);
  const time = Array.from({ length: 240 }, (_, i) => asOf + (i - 100) * 3600);
  const daily = Array.from({ length: 10 }, (_, i) => Date.parse(`${localToday}T07:00:00Z`) / 1000 + (i - 3) * 86400);
  return {
    hourly_units: { snowfall: 'cm', temperature_2m: '°F', snow_depth: 'm' },
    daily_units: { snowfall_sum: 'cm' }, utc_offset_seconds: -25200, timezone: 'America/Los_Angeles',
    hourly: { time, snowfall: time.map(() => 0), temperature_2m: time.map(() => 25), snow_depth: time.map(() => 0) },
    daily: { time: daily, snowfall_sum: daily.map(() => 0), temperature_2m_max: daily.map(() => 30), temperature_2m_min: daily.map(() => 20), weather_code: daily.map(() => 3) }
  };
}

test('all 105 canonical resorts start with no generated condition values', async () => {
  globalThis.localStorage = { getItem: () => null };
  const { resorts } = await import('../js/resorts.js?v=20261021-sources-verified');
  assert.equal(resorts.length, 105);
  assert.equal(loadAllResorts().size, resorts.length);
  for (const resort of resorts) {
    assert.deepEqual(resort.metrics, emptyMetrics(), resort.name);
    assert.ok(loadAllResorts().has(resort.name === 'Palisades Tahoe' ? 'palisades tahoe' : (await import('../js/utils.js?v=20261021-sources-verified')).getSourceKeyForResort(resort.name)));
  }
});

test('genuine zero survives; missing, negative and nonnumeric values stay unknown', () => {
  const { metrics } = normalizeConditionMetrics({ snow24h: 0, snow48h: null, snow72h: '0', tempF: -5, runsOpen: 0, runsTotal: 111, groomedRuns: 0, baseDepth: -1 });
  assert.equal(metrics.snow24h, 0);
  assert.equal(metrics.snow48h, null);
  assert.equal(metrics.snow72h, null);
  assert.equal(metrics.tempF, -5);
  assert.equal(metrics.baseDepth, null);
  assert.equal(metrics.runsOpen, 0);
  assert.equal(metrics.groomedRuns, 0);
});

test('inconsistent cumulative snowfall and impossible terrain counts are withheld', () => {
  const { metrics, issues } = normalizeConditionMetrics({ snow24h: 5, snow48h: 7, snow72h: 6, runsOpen: 12, runsTotal: 10, groomedRuns: 18 });
  assert.equal(metrics.snow24h, null);
  assert.equal(metrics.snow48h, null);
  assert.equal(metrics.snow72h, null);
  assert.equal(metrics.runsOpen, null);
  assert.equal(issues.length, 2);
});

test('report timestamp must include date and timezone; fresh retrieval cannot renew a stale report', () => {
  assert.equal(reportTimestamp('05:00 pm'), null);
  assert.equal(reportTimestamp('2026-10-21 12:00:00'), null);
  assert.equal(reportTimestamp('Updated June 23, 2026 at 3:23 PM PDT'), '2026-06-23T22:23:00.000Z');
  assert.equal(isFresh('nonsense', undefined, now), false);
  assert.equal(isFresh('2026-10-22T00:00:00Z', undefined, now), false);
  const old = entry({ snow24h: 10, runsOpen: 0, runsTotal: 111 });
  old.snowReportedAt = '2026-06-23T22:23:00Z';
  const result = assessConditions(old, fresh, now);
  assert.equal(result.snowStatus, 'stale');
  assert.equal(result.metrics.snow24h, null);
  assert.equal(result.terrainStatus, 'ready');
  assert.equal(result.metrics.runsOpen, 0);
  const expired = assessConditions(entry({ snow24h: 5, runsOpen: 4 }), '2026-10-20T00:00:00Z', now);
  assert.equal(expired.metrics.snow24h, null);
  assert.equal(expired.metrics.runsOpen, null);
});

test('Heavenly official summer summary is 0/111 trails, not 27 lifts; June snow report is stale', async () => {
  const html = await readFile(new URL('./fixtures/heavenly-terrain.html', import.meta.url), 'utf8');
  const snow = parseVailSnow(await readFile(new URL('./fixtures/heavenly-snow.html', import.meta.url), 'utf8'));
  const terrain = summarizeVailTerrain({ GroomingAreas: [{ Trails: [] }] }, html);
  assert.deepEqual(terrain, { runsOpen: 0, runsTotal: 111, groomedRuns: 0 });
  const result = assessConditions({ ...entry({ ...snow.metrics, ...terrain }), snowReportedAt: snow.snowReportedAt }, fresh, now);
  assert.equal(result.metrics.snow24h, null);
  assert.equal(result.metrics.runsOpen, 0);
  assert.equal(result.metrics.groomedRuns, 0);
});

test('closed trail arrays report zero, empty arrays unknown, expected openings are excluded', () => {
  assert.equal(summarizePowdrOpenCount([]), null);
  assert.equal(summarizePowdrOpenCount([{ status: 'closed' }]), 0);
  assert.equal(summarizePowdrOpenCount([{ status: 'expected' }, { status: 'open' }]), 1);
  assert.equal(summarizePowdrGroomedCount([{ status: 'expected', groom_status: 'groomed' }, { status: 'closed' }]), 0);
  assert.deepEqual(summarizeVailTerrain({ GroomingAreas: [{ Trails: [{ Id: 1, IsOpen: false, IsGroomed: false }] }] }), { runsTotal: 1, runsOpen: 0, groomedRuns: 0 });
});

test('weather snowfall uses complete hourly windows, proper cm/m conversion, and actual local dates', () => {
  const payload = weatherFixture();
  // One inch in the previous hour, two inches in a future hour.
  payload.hourly.snowfall[100] = 2.54;
  payload.hourly.snowfall[101] = 5.08;
  payload.hourly.snow_depth[100] = 0.254;
  const { forecast, conditions } = parseWeather(payload, 'https://example.org', now);
  assert.equal(conditions.snow24h, 1);
  assert.equal(conditions.snow48h, 1);
  assert.equal(conditions.snow72h, 1);
  assert.equal(conditions.baseDepth, 10);
  assert.equal(forecast.forecast72h, 2);
  assert.equal(forecast.dailyTime[0], '2026-10-21');
  assert.equal(forecastIsCurrent(forecast, now), true);
  assert.equal(forecastIsCurrent(forecast, new Date('2026-10-22T09:00:00Z')), false);
  // Tokyo is already on the next date at this instant.
  payload.utc_offset_seconds = 32400;
  payload.daily.time = payload.daily.time.map(t => t - 16 * 3600);
  assert.equal(parseWeather(payload, '', now).forecast.dailyTime[0], '2026-10-22');
});

test('missing weather is not zero, wrong units/dates and partial 72h forecasts raise errors', () => {
  const missing = weatherFixture();
  missing.hourly.snowfall[100] = null;
  missing.daily.snowfall_sum[3] = null;
  const parsed = parseWeather(missing, '', now);
  assert.equal(parsed.conditions.snow24h, null);
  assert.equal(parsed.forecast.dailySnowfall[0], null);
  missing.hourly.snowfall[101] = null;
  assert.throws(() => parseWeather(missing, '', now), /missing part/);
  const wrongUnits = weatherFixture(); wrongUnits.hourly_units.snowfall = 'inch';
  assert.throws(() => parseWeather(wrongUnits, '', now), /units/);
  const wrongDate = weatherFixture(); wrongDate.daily.time = [1, 2, 3];
  assert.throws(() => parseWeather(wrongDate, '', now), /today/);
});

test('loader clears old condition fields on null, missing entries, and errors; preserves independent forecast', async () => {
  globalThis.localStorage = { getItem: () => null };
  const { resorts } = await import('../js/resorts.js?v=20261021-sources-verified');
  const { applyLiveConditions } = await import('../js/data-loader.js');
  const heavenly = resorts.find(r => r.name === 'Heavenly');
  heavenly.metrics.runsOpen = 24; heavenly.metrics.groomedRuns = 18; heavenly.metrics.forecast72h = 3;
  const checkedAt = new Date().toISOString();
  applyLiveConditions({ heavenly: { ...entry(), checkedAt, snowReportedAt: checkedAt, terrainReportedAt: checkedAt } }, checkedAt);
  assert.equal(heavenly.metrics.runsOpen, null);
  assert.equal(heavenly.metrics.groomedRuns, null);
  assert.equal(heavenly.metrics.forecast72h, 3);
  heavenly.metrics.snow24h = 99;
  applyLiveConditions({}, checkedAt);
  assert.equal(heavenly.metrics.snow24h, null);
  applyLiveConditions({ heavenly: { status: 'error', checkedAt, metrics: { runsOpen: 30 } } }, checkedAt);
  assert.equal(heavenly.metrics.runsOpen, null);
});


test('every configured official feed is matched using the same canonical keys as the browser', async () => {
  const sources = JSON.parse(await readFile(new URL('../data/resort-condition-sources.json', import.meta.url), 'utf8'));
  const entries = collectionEntries(sources);
  assert.equal(entries.size, 105);
  assert.equal([...entries.values()].filter(e => e.adapter !== 'open-meteo').length, sources.length);
  assert.equal(entries.get('wildcat').adapter, 'vail');
  assert.equal(entries.get('mammoth').adapter, 'mtnfeed');
  assert.equal(entries.get('blue').adapter, 'mtnfeed');
});


test('a reported base range is not converted into an invented point measurement', () => {
  assert.equal(parseSingleDepth('10'), 10);
  assert.equal(parseSingleDepth('0 - 0'), 0);
  assert.equal(parseSingleDepth('30 - 60'), null);
  assert.equal(parseSingleDepth('--'), null);
});

test('an incomplete combined destination cannot silently display just its first mountain report', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, headers: new Headers(), json: async () => String(url).includes('resorts/')
    ? { bearerToken: 'fixture', resortIds: [1, 2, 3] }
    : { Resorts: [{ Name: 'Mountain A', SnowReport: {} }, { Name: 'Mountain B', SnowReport: {} }] } });
  try {
    const result = await collectEntry({ name: 'Combined destination', adapter: 'mtnfeed', resortPath: 'fixture' });
    assert.equal(result.status, 'error');
    assert.match(result.error, /incomplete/);
    assert.ok(Object.values(result.metrics).every(value => value === null));
  } finally { globalThis.fetch = originalFetch; }
});

test('failed forecast fetch clears prior forecast values and errors are surfaced', async () => {
  const { resorts } = await import('../js/resorts.js?v=20261021-sources-verified');
  const { loadLiveForecastForResort } = await import('../js/data-loader.js');
  const resort = resorts.find(r => r.name === 'Heavenly');
  resort.metrics.forecast72h = 12;
  resort.liveForecast = { status: 'ok', updatedAt: '2020-01-01T00:00:00Z' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(loadLiveForecastForResort(resort), /503/);
    assert.equal(resort.metrics.forecast72h, null);
    assert.equal(resort.liveForecast, null);
    assert.equal(resort.liveForecastStatus, 'error');
  } finally { globalThis.fetch = originalFetch; }
});

test('small positive snowfall never formats as zero', async () => {
  const { formatInches } = await import('../js/utils.js?v=20261021-sources-verified');
  const { state } = await import('../js/state.js?v=20261021-sources-verified');
  state.useMetric = false;
  assert.equal(formatInches(0.03), '<0.1"');
  assert.equal(formatInches(0), '0"');
  state.useMetric = true;
  assert.equal(formatInches(0.03), '<0.1cm');
  assert.equal(formatInches(0.1), '0.3cm');
  state.useMetric = false;
});

test('conditions and forecasts expire while a browser tab stays open', async () => {
  const { loadOptionalSourceData, expireStaleWeather } = await import('../js/data-loader.js');
  const { resorts } = await import('../js/resorts.js?v=20261021-sources-verified');
  const { state } = await import('../js/state.js?v=20261021-sources-verified');
  const checkedAt = new Date().toISOString();
  const forecast = parseWeather(weatherFixture(new Date(checkedAt)), '', new Date(checkedAt)).forecast;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, json: async () => String(url).includes('resort-conditions')
    ? { schemaVersion: 2, generatedAt: checkedAt, resorts: { heavenly: { ...entry({ snow24h: 0, runsOpen: 0, runsTotal: 111, groomedRuns: 0 }), checkedAt, snowReportedAt: checkedAt, terrainReportedAt: checkedAt } } }
    : String(url).includes('resort-forecasts') ? { schemaVersion: 2, generatedAt: checkedAt, resorts: { heavenly: forecast } } : {} });
  try {
    await loadOptionalSourceData();
    const heavenly = resorts.find(r => r.name === 'Heavenly');
    assert.equal(heavenly.metrics.runsOpen, 0);
    assert.equal(heavenly.metrics.snow24h, 0);
    assert.equal(heavenly.liveForecastStatus, 'ready');
    expireStaleWeather(null, Date.parse(checkedAt) + 9 * 3600000);
    assert.equal(heavenly.metrics.runsOpen, null);
    assert.equal(heavenly.metrics.snow24h, null);
    assert.equal(heavenly.liveSnowStatus, 'stale');
    assert.equal(heavenly.metrics.forecast72h, null);
    assert.equal(heavenly.liveForecastStatus, 'stale');
    assert.equal(state.conditionsLoadStatus, 'stale');
  } finally { globalThis.fetch = originalFetch; }
});


test('an ambiguous or ranged reported number is not presented as an exact observation', () => {
  const html = 'FR.snowReportData = ' + JSON.stringify({ TwentyFourHourSnowfall: { Inches: '<1' }, FortyEightHourSnowfall: { Inches: '1-3' } });
  const result = parseVailSnow(html);
  assert.equal(result.metrics.snow24h, null);
  assert.equal(result.metrics.snow48h, null);
});

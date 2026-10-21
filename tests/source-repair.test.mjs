import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { zonedTimestamp } from '../scripts/source-time.mjs';
import { parseAltaPayload, parseMtnfeedPayload, parsePowdrPayload, parseReportPalPayload, parseMcTerrain, parseAbasinTerrain, visibleHtml } from '../scripts/resort-parsers.mjs';
import { reportTimestamp, parseSingleDepth, applyWeatherFallback, collectEntry } from '../scripts/fetch_resort_conditions.mjs';
import { normalizeConditionMetrics, assessConditions } from '../js/condition-data.js';
import { chooseConditions } from '../js/condition-selection.js';
const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/source-repair/${name}.json`, import.meta.url), 'utf8'));

test('provider wall clocks resolve in the actual resort timezone, including DST, and ambiguous times are rejected', () => {
  assert.equal(zonedTimestamp('2026-10-21 14:00:00', 'America/Denver'), '2026-10-21T20:00:00.000Z');
  assert.equal(zonedTimestamp('2026-01-21 14:00:00', 'America/Denver'), '2026-01-21T21:00:00.000Z');
  assert.equal(zonedTimestamp('2026-11-01 01:30:00', 'America/Denver'), null);
  assert.equal(zonedTimestamp('2026-03-08 02:30:00', 'America/Denver'), null);
});

test('Alta uses its full dated observation, not the display-only 02:00 pm label', async () => {
  const parsed = parseAltaPayload(await fixture('alta'), 'America/Denver');
  assert.equal(parsed.snowReportedAt, '2026-10-21T20:00:00.000Z');
  assert.equal(parsed.metrics.snow24h, 0);
  assert.equal(parsed.metrics.runsOpen, 0);
  assert.equal(parsed.metrics.runsTotal, 118);
  assert.equal(parsed.metrics.tempF, 51.7);
});

test('Mtnfeed terrain has a separate clock from an old snow report and combined destinations include every mountain', async () => {
  const parsed = parseMtnfeedPayload(await fixture('big-bear-mountain'), { parseTime: reportTimestamp, parseDepth: parseSingleDepth, expectedCount: 3 });
  assert.equal(parsed.componentReports.length, 3);
  assert.equal(parsed.metrics.runsTotal, 89);
  assert.equal(parsed.metrics.runsOpen, 0);
  assert.equal(parsed.metrics.groomedRuns, 0);
  assert.equal(parsed.terrainReportedAt.slice(0, 10), '2026-10-21');
  assert.equal(parsed.snowReportedAt.slice(0, 10), '2026-04-01');
  assert.throws(() => parseMtnfeedPayload(awaitless(), { expectedCount: 3 }), /incomplete/);
  function awaitless() { return { Resorts: [{ Name: 'One', SnowReport: {} }] }; }
});

test('POWDR preserves current winter terrain when its separate snow report is old; summer trails are excluded', async () => {
  const parsed = parsePowdrPayload(await fixture('snowbird-snow'), await fixture('snowbird-trails'), 'America/Denver');
  assert.equal(parsed.snowReportedAt, '2026-10-20T15:00:00.000Z');
  assert.equal(parsed.terrainTimestampKind, 'checked');
  assert.equal(parsed.metrics.runsTotal, 1); // One winter trail in this response excerpt.
  assert.equal(parsed.metrics.runsOpen, 0);
  assert.equal(parsed.metrics.groomedRuns, 0);
});

test('ReportPal reads winter resortwide totals, explicit inch fields, and excludes summer facilities', async () => {
  const payload = await fixture('big-sky');
  payload.summer = { areas: { area: [{ trails: { trail: [{ status: 'Open', groomed: true }] } }] } };
  const parsed = parseReportPalPayload(payload);
  assert.equal(parsed.metrics.runsTotal, 319);
  assert.equal(parsed.metrics.runsOpen, 0);
  assert.equal(parsed.metrics.groomedRuns, 0);
  assert.equal(parsed.metrics.baseDepth, 1);
  assert.equal(parsed.metrics.snow72h, 0);
  assert.equal(parsed.terrainTimestampKind, 'checked');
});

test('Snowbasin and Sun Valley use published winter summaries; legend and closed-run grooming icons add no open groomed runs', async () => {
  const basin = parseMcTerrain(await readFile(new URL('./fixtures/source-repair/snowbasin-reportUrl.html', import.meta.url), 'utf8'));
  const valley = parseMcTerrain(await readFile(new URL('./fixtures/source-repair/sun-valley-reportUrl.html', import.meta.url), 'utf8'));
  assert.deepEqual(basin, { runsOpen: 0, runsTotal: 115, groomedRuns: 0 });
  assert.deepEqual(valley, { runsOpen: 0, runsTotal: 131, groomedRuns: 0 });
});

test('A-Basin associates counts with following labels, not the next lift count; commented old HTML is ignored', () => {
  const html = '<p>0 /147 Open Runs 0 /9 Open Lifts</p><!-- 24/57 Open Runs -->';
  assert.deepEqual(parseAbasinTerrain(html), { runsOpen: 0, runsTotal: 147, groomedRuns: null, liftsOpen: 0 });
  assert.equal(visibleHtml('<!-- archived 36 inch base --><p>Current</p>'), '<p>Current</p>');
});

test('explicit model failover fills weather only and preserves primary failure and independent official terrain', () => {
  const now = new Date('2026-10-21T21:30:00Z');
  const primary = { status: 'ok', adapter: 'vail', resort: 'Heavenly', checkedAt: now.toISOString(), snowStatus: 'stale', terrainStatus: 'ready', snowReportedAt: '2026-06-23T22:23:00Z', terrainReportedAt: now.toISOString(), metrics: normalizeConditionMetrics({ runsOpen: 0, runsTotal: 111, groomedRuns: 0 }).metrics, sources: { conditions: 'https://example.com/report' } };
  const forecast = { status: 'ok', updatedAt: now.toISOString(), dailyTime: ['2026-10-21','2026-10-22','2026-10-23'], dailySnowfall: [0,0,0], utcOffsetSeconds: -25200, forecast72h: 1, periodEnd: '2026-10-24T21:00:00Z', recentConditionsAt: '2026-10-21T21:00:00Z', recentConditions: { snow24h: 0, snow48h: 0, snow72h: 0, tempF: 40 }, apiUrl: 'https://api.open-meteo.com/v1/forecast' };
  const result = applyWeatherFallback(primary, forecast, now);
  assert.equal(result.primarySnowStatus, 'stale');
  assert.equal(result.officialSnowReportedAt, primary.snowReportedAt);
  assert.equal(result.snowSourceKind, 'model');
  assert.equal(result.metrics.snow24h, 0);
  assert.equal(result.metrics.runsTotal, 111);
  assert.equal(result.metrics.runsOpen, 0);
  assert.equal(result.terrainStatus, 'ready');
  assert.equal(assessConditions(result, now.toISOString(), now).snowStatus, 'ready');
  const expired = applyWeatherFallback(primary, { ...forecast, updatedAt: '2026-10-20T00:00:00Z' }, now);
  assert.equal(expired.snowStatus, 'stale');
  assert.equal(expired.metrics.snow24h, null);
});

test('an invalid grooming count does not erase valid independent open-run counts', () => {
  const result = normalizeConditionMetrics({ runsOpen: 0, runsTotal: 115, groomedRuns: 18 });
  assert.equal(result.metrics.runsOpen, 0);
  assert.equal(result.metrics.runsTotal, 115);
  assert.equal(result.metrics.groomedRuns, null);
  assert.match(result.issues[0], /groom/);
});

test('Blue Mountain’s current feed-render time cannot renew weeks-old positive ski states', async () => {
  const payload = await fixture('blue-mountain');
  const parsed = parseMtnfeedPayload(payload, { parseTime: reportTimestamp, parseDepth: parseSingleDepth, expectedCount: 1, now: new Date('2026-10-21T21:30:00Z') });
  assert.equal(payload.Resorts[0].SnowReport.TotalOpenTrails, 38);
  assert.equal(parsed.terrainStatus, 'unverified');
  assert.equal(parsed.metrics.runsOpen, null);
  assert.equal(parsed.metrics.groomedRuns, null);
  assert.match(parsed.issues[0], /winter report/);
});

test('a report expiring in an open browser switches to fresh modeled weather and keeps independent terrain', () => {
  const now = new Date('2026-10-21T21:30:00Z');
  const primary = { status: 'ok', adapter: 'vail', checkedAt: now.toISOString(), snowReportedAt: '2026-10-20T21:29:00Z', terrainReportedAt: now.toISOString(), terrainTimestampKind: 'checked', snowStatus: 'ready', terrainStatus: 'ready', metrics: { snow24h: 5, snow48h: 7, snow72h: 8, runsOpen: 0, runsTotal: 111 }, issues: ['Resort report provenance retained.'] };
  const forecast = { status: 'ok', updatedAt: now.toISOString(), dailyTime: ['2026-10-21','2026-10-22','2026-10-23'], dailySnowfall: [0,0,0], utcOffsetSeconds: -25200, forecast72h: 1, periodEnd: '2026-10-24T21:00:00Z', recentConditionsAt: '2026-10-21T21:00:00Z', recentConditions: { snow24h: 0, snow48h: 1, snow72h: 2, tempF: 40 } };
  const selected = chooseConditions(primary, now.toISOString(), forecast, now);
  assert.equal(selected.snowSourceKind, 'model');
  assert.equal(selected.primarySnowStatus, 'stale');
  assert.deepEqual([selected.metrics.snow24h, selected.metrics.snow48h, selected.metrics.snow72h], [0,1,2]);
  assert.equal(selected.metrics.runsOpen, 0);
  assert.ok(selected.issues.includes('Resort report provenance retained.'));
  const expired = chooseConditions(primary, now.toISOString(), { ...forecast, updatedAt: '2026-10-20T00:00:00Z' }, now);
  assert.equal(expired.snowStatus, 'stale');
  assert.equal(expired.metrics.snow24h, null);
});

test('long-lived provider configuration is allowed while an expired cached observation is rejected', async () => {
  const originalFetch = globalThis.fetch;
  const payload = await fixture('mammoth-mountain');
  let feedAge = '0';
  globalThis.fetch = async url => {
    const config = String(url).includes('resorts/');
    return { ok: true, headers: new Headers({ age: config ? '90000' : feedAge }), json: async () => config ? { bearerToken: 'fixture', resortIds: [1] } : payload };
  };
  try {
    const entry = { name: 'Mammoth', adapter: 'mtnfeed', resortPath: 'fixture' };
    const usable = await collectEntry(entry);
    assert.notEqual(usable.status, 'error');
    feedAge = '90000';
    const expired = await collectEntry(entry);
    assert.equal(expired.status, 'error');
    assert.match(expired.error, /expired cached response/);
    assert.doesNotMatch(expired.error, /bearerToken|fixture&/);
  } finally { globalThis.fetch = originalFetch; }
});

test('an active summer feed never supplies ski-run counts and generated terrain snapshots expire after eight hours', async () => {
  const parsed = parseMtnfeedPayload(await fixture('mammoth-mountain'), { parseTime: reportTimestamp, parseDepth: parseSingleDepth, expectedCount: 1, winter: false });
  assert.equal(parsed.terrainStatus, 'unavailable');
  assert.equal(parsed.metrics.runsOpen, null);
  assert.equal(parsed.metrics.runsTotal, null);
  const now = new Date('2026-10-21T21:30:00Z');
  const assessed = assessConditions({ status: 'ok', checkedAt: now.toISOString(), terrainTimestampKind: 'feed', terrainStatus: 'ready', terrainReportedAt: '2026-10-21T12:00:00Z', metrics: { runsOpen: 0, runsTotal: 42 } }, now.toISOString(), now);
  assert.equal(assessed.terrainStatus, 'stale');
  assert.equal(assessed.metrics.runsOpen, null);
});

test('Mtnfeed open grooming excludes closed groomed trails and requires complete explicit trail flags', () => {
  const now = new Date('2026-10-21T21:30:00Z');
  const resort = { Name: 'Winter mountain', LastUpdate: now.toISOString(), SnowReport: { LastUpdate: now.toISOString(), TotalOpenTrails: 2, TotalTrails: 3, GroomedTrails: 2 }, MountainAreas: [{ Trails: [
    { StatusEnglish: 'open', Grooming: 'Yes', UpdateDate: now.toISOString() },
    { StatusEnglish: 'open', Grooming: 'No', UpdateDate: now.toISOString() },
    { StatusEnglish: 'closed', Grooming: 'Yes', UpdateDate: now.toISOString() }
  ] }] };
  const parse = () => parseMtnfeedPayload({ Resorts: [resort] }, { parseTime: reportTimestamp, parseDepth: parseSingleDepth, expectedCount: 1, now });
  assert.equal(parse().metrics.groomedRuns, 1);
  resort.MountainAreas[0].Trails[0].Grooming = '--';
  assert.equal(parse().metrics.groomedRuns, null);
});

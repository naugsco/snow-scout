import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { zonedTimestamp } from '../scripts/source-time.mjs';
import { parseAltaPayload, parseMtnfeedPayload, parsePowdrPayload, parseReportPalPayload, parseMcTerrain, parseAbasinTerrain, parseKillingtonTerrain, parseJacksonHoleTerrain, parseRevelstokeTerrain, visibleHtml, parseSugarBowlConditions, parseBanffSunshineConditions } from '../scripts/resort-parsers.mjs';
import { reportTimestamp, parseSingleDepth, applyWeatherFallback, collectEntry, parseVailTerrain } from '../scripts/fetch_resort_conditions.mjs';
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

test('Sun Valley reads both winter counts through access alerts and rejects an incomplete combined report', () => {
  const bald = '<p>Trails Open</p><p class="mc__alert">Mountain access closed until opening day.</p><p>0 / 109</p>';
  const dollar = '<p>Trails Open</p><p class="mc__alert">Access alert</p><p>0 / 22</p>';
  assert.deepEqual(parseMcTerrain(bald + dollar + '<p>Biking Trails 2 / 7</p>', 2),
    { runsOpen: 0, runsTotal: 131, groomedRuns: 0 });
  assert.throws(() => parseMcTerrain(bald, 2), /incomplete/);
});

test('Killington uses the dedicated winter summary and excludes sidebar counts, parks, and uphill trails', () => {
  const html = '<aside>Open Trails 99/99</aside><h2 id="mountain-status">Mountain Status</h2>'
    + '<p>Open Lifts 2/19 Open Trails 3/155 Groomed 3/3 Open Terrain Parks 1/7 Open Uphill Trails 0/5</p><h2>All Lifts</h2>';
  assert.deepEqual(parseKillingtonTerrain(html), { runsOpen: 3, runsTotal: 155, liftsOpen: 2, groomedRuns: 3 });
  assert.equal(parseKillingtonTerrain(html.replace('Groomed 3/3', 'Groomed 3/155')).groomedRuns, null);
  assert.throws(() => parseKillingtonTerrain(html.replace('Open Trails 3/155', 'Open Bike Trails 3/155')), /no open trail summary/i);
});

test('Kirkwood accepts the text-based run summary when the dated feed has no trail rows', () => {
  const feed = '<script>FR.TerrainStatusFeed = {"Date":"2026-11-19T16:00:00Z","IsSuccessful":true,"GroomingAreas":[{"Trails":[]}]};</script>';
  const summary = '<div class="terrain_summary__tab_main" data-terrain-status-id="runs">'
    + '<div class="terrain_summary__tab_main__text" tabindex="0"><div>'
    + '<span class="c118__number1--v1">0</span><span class="c118__number2--v1">/ 84</span></div></div></div>';
  assert.deepEqual(parseVailTerrain(feed + summary), {
    metrics: { runsOpen: 0, runsTotal: 84, groomedRuns: 0 },
    terrainReportedAt: '2026-11-19T16:00:00.000Z'
  });
  assert.equal(parseVailTerrain(feed + `<!--${summary}-->`).metrics.runsOpen, null);
});

test('Jackson Hole reconciles grooming with open ski rows and ages terrain from last modification', async t => {
  const payload = {
    lastModified: new Date(Date.now() - 25 * 3600000).toISOString(), respTimestamp: new Date().toISOString(),
    trailStatus: { totalTrails: 130, openTrails: 1, groomedTrails: 30 }, liftStatus: { openLifts: 1 },
    trails: {
      open: { trailType: 'DOWNHILL_SKIING', openingStatus: 'OPEN', groomingStatus: 'Groomed AM' },
      closed: { trailType: 'DOWNHILL_SKIING', openingStatus: 'CLOSED', groomingStatus: 'Groomed PM' }
    }
  };
  assert.deepEqual(parseJacksonHoleTerrain(payload), { runsOpen: 1, runsTotal: 130, groomedRuns: 1, liftsOpen: 1 });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(payload)));
  const entry = { name: 'Jackson Hole', adapter: 'jacksonhole', feedUrl: 'https://example.com/terrain.json' };
  const stale = await collectEntry(entry);
  assert.equal(stale.terrainStatus, 'stale');
  assert.equal(stale.metrics.runsOpen, null);
  payload.lastModified = payload.respTimestamp;
  const current = await collectEntry(entry);
  assert.equal(current.terrainStatus, 'ready');
  assert.equal(current.metrics.groomedRuns, 1);
});

test('Revelstoke counts unique open runs independently of lifts and preserves the date of a stale report', async t => {
  const row = (name, status) => `<tr><td class="run-name">${name}</td><td><span class="run-status run-status--${status}"></span></td></tr>`;
  const html = '<div class="lifts-runs__timestamp"><strong>2026-10-28 10:48:05</strong></div>'
    + '<span class="lift-status lift-status--closed"></span>'
    + row('Burn Down', 'open') + row('Chopper', 'open') + row('Chopper', 'open') + row('Blow Down', 'closed');
  assert.deepEqual(parseRevelstokeTerrain(html, 'America/Vancouver'), {
    terrainReportedAt: '2026-10-28T17:48:05.000Z', metrics: { runsOpen: 2 }
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(html));
  const report = await collectEntry({ name: 'Revelstoke', adapter: 'revelstoke',
    terrainUrl: 'https://example.com/lifts-grooming', timezone: 'America/Vancouver' });
  assert.equal(report.terrainStatus, 'stale');
  assert.equal(report.metrics.runsOpen, null);
  assert.match(report.issues.join(' '), /2 open runs on October 28, 2026/);
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

const sugarBowlField = (id, value) => `<span class="refresh_001 refresh_html" data-update-id="${id}">${value}</span>`;
const sugarBowlPage = (clock) => ['<div>Last Updated:  ' + sugarBowlField('conditions_last_update', clock) + '</div>',
  '<!-- ' + sugarBowlField('conditions_snowdepth_summit', '99') + ' -->',
  sugarBowlField('conditions_snowdepth_summit', '36'), sugarBowlField('conditions_snowdepth_base', '33'),
  sugarBowlField('conditions_snow_24hr_summit', '12'), sugarBowlField('conditions_snow_24hr_base', '9'),
  sugarBowlField('conditions_temp_summit', '12'), sugarBowlField('conditions_temp_base', '18'),
  sugarBowlField('conditions_snow_ytd_summit', '107'), sugarBowlField('conditions_snow_ytd_base', '72')].join('\n');

test('Sugar Bowl reports the summit point with its dated report clock, ignoring commented HTML', async t => {
  assert.deepEqual(parseSugarBowlConditions(sugarBowlPage('11/20/2026 03:33 PM'), 'America/Los_Angeles'), {
    snowReportedAt: '2026-11-20T23:33:00.000Z', sourceUpdatedText: '11/20/2026 03:33 PM',
    metrics: { snow24h: 12, baseDepth: 36, tempF: 12 }, seasonTotalInches: 107,
    note: 'Summit (8,383 ft) values from the official Sugar Bowl conditions page.'
  });
  assert.throws(() => parseSugarBowlConditions(sugarBowlPage(''), 'America/Los_Angeles'), /no valid report timestamp/);
  assert.throws(() => parseSugarBowlConditions(sugarBowlField('conditions_last_update', '11/20/2026 03:33 PM'), 'America/Los_Angeles'), /no conditions_snow_24hr_summit field/);
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-21T01:00:00Z') });
  t.mock.method(globalThis, 'fetch', async () => new Response(sugarBowlPage('11/20/2026 03:33 PM')));
  const report = await collectEntry({ name: 'Sugar Bowl', adapter: 'sugarbowl', conditionsUrl: 'https://example.com/conditions', timezone: 'America/Los_Angeles' });
  assert.equal(report.snowSourceKind, 'reported');
  assert.equal(report.snowStatus, 'ready');
  assert.equal(report.metrics.baseDepth, 36);
  assert.equal(report.terrainStatus, 'unavailable');
});

test('Banff Sunshine reports the Upper Mountain base converted from cm, not the mid-mountain settled base', () => {
  const card = (label, cm) => `<div class="copy"><h4>${label}</h4><div class="snow-stats"><div><div class="lh-1 weather-data"><span class="value">\n${cm}\n</span>\n<span class="t-label unit">\ncm\n</span></div></div></div></div>`;
  const page = (clock, upper) => `<section class="snow"><h2>Current Conditions</h2><p class="timestamp">\n${clock}\n</p>`
    + `<div class="snow-group upper"><h3 class="snow-group-title"><span class="wi wi-snow"></span>\nUpper Mountain Snow Report</h3>${upper}</div>`
    + `<div class="snow-group mid"><h3 class="snow-group-title"><span></span>Mid Mountain Snow Report</h3>${card('7 Days', 17)}${card('Settled Base', 28)}</div></section>`;
  const parsed = parseBanffSunshineConditions(page('Updated: Friday, November 20th, 2026 7:01 PM', card('7 Day', 19) + card('Base', 38) + card('Cumulative', 63)), 'America/Edmonton');
  assert.equal(parsed.snowReportedAt, '2026-11-21T02:01:00.000Z');
  assert.deepEqual(parsed.metrics, { baseDepth: 14.96 });
  assert.equal(parsed.seasonTotalInches, 24.8, 'Upper Mountain cumulative, not mid');
  assert.throws(() => parseBanffSunshineConditions(page('', card('Base', 38)), 'America/Edmonton'), /no valid report timestamp/);
  assert.throws(() => parseBanffSunshineConditions(page('Updated: Friday, November 20th, 2026 7:01 PM', card('7 Day', 19)), 'America/Edmonton'), /no base depth/);
});

test('season totals are collected from feeds, kept apart from recent-snow fallback, and screened against the model', async () => {
  const { screenSeasonSnowfall } = await import('../scripts/fetch_resort_conditions.mjs');
  const { parseSeasonCheck } = await import('../scripts/fetch_resort_forecasts.mjs');
  const report = (season) => ({ Name: 'M', LastUpdate: '2026-11-20T15:42:50-0800', SnowReport: { LastUpdate: '2026-11-20T15:42:50-0800', SeasonTotalIn: season, AllMountain: {}, SnowBaseRangeIn: '--' } });
  const opts = { parseTime: (v) => reportTimestamp(v), parseDepth: parseSingleDepth, now: Date.parse('2026-11-21T00:00:00Z') };
  assert.equal(parseMtnfeedPayload({ Resorts: [report('56')] }, opts).seasonTotalInches, 56);
  assert.equal(parseMtnfeedPayload({ Resorts: [report('--')] }, opts).seasonTotalInches, null);
  assert.equal(parseMtnfeedPayload({ Resorts: [{ ...report('20'), Name: 'X' }, { ...report('21'), Name: 'Y' }] }, opts).seasonTotalInches, null, 'combined mountains must agree');
  const withTotal = (inches) => ({ issues: [], seasonSnowfall: { inches, reportedAt: '2026-11-19T15:48:00Z', source: 'resort' } });
  const check = { seasonCheck: { snowfallInches: 0.3, from: '2026-08-21' } };
  const leftover = screenSeasonSnowfall(withTotal(145), check);
  assert.equal(leftover.seasonSnowfall, undefined);
  assert.match(leftover.issues.join(' '), /145" withheld: far above the model's 0.3" since 2026-08-21/);
  assert.equal(screenSeasonSnowfall(withTotal(5), check).seasonSnowfall.inches, 5);
  assert.equal(screenSeasonSnowfall(withTotal(5), {}).seasonSnowfall, undefined, 'no check, no publication');
  const days = Array.from({ length: 93 }, (_, i) => new Date(Date.UTC(2026, 7, 21 + i)).toISOString().slice(0, 10));
  const parsed = parseSeasonCheck({ daily_units: { snowfall_sum: 'cm' }, daily: { time: days, snowfall_sum: days.map(() => 2.54) } }, 'u');
  assert.deepEqual([parsed.snowfallInches, parsed.from, parsed.through], [92, '2026-08-21', '2026-11-20']);
  assert.throws(() => parseSeasonCheck({ daily_units: { snowfall_sum: 'cm' }, daily: { time: days, snowfall_sum: days.map((_, i) => i === 5 ? null : 1) } }, 'u'), /incomplete/);
});

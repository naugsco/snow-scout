import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadAllResorts } from '../scripts/fetch_resort_conditions.mjs';
import { normalizeConditionMetrics, isFresh, REPORT_MAX_AGE_MS } from '../js/condition-data.js';
import { forecastIsCurrent } from '../js/weather-data.js';

const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

test('published condition snapshot covers every canonical resort and contains no unverified numeric conditions', async () => {
  const data = await read('resort-conditions');
  assert.equal(data.schemaVersion, 2);
  assert.deepEqual(Object.keys(data.resorts).sort(), [...loadAllResorts().keys()].sort());
  for (const [key, entry] of Object.entries(data.resorts)) {
    assert.deepEqual(normalizeConditionMetrics(entry.metrics).metrics, entry.metrics, key);
    for (const [status, stamp, fields] of [
      [entry.snowStatus, entry.snowReportedAt, ['snow24h', 'snow48h', 'snow72h', 'daysSinceSnow', 'baseDepth', 'tempF']],
      [entry.terrainStatus, entry.terrainReportedAt, ['runsOpen', 'runsTotal', 'groomedRuns', 'liftsOpen']]
    ]) {
      if (status !== 'ready') assert.ok(fields.every(field => entry.metrics[field] === null), key);
      else assert.ok(isFresh(stamp, (fields[0] === 'snow24h' ? entry.snowSourceKind === 'model' || entry.adapter === 'open-meteo' : ['checked', 'feed'].includes(entry.terrainTimestampKind)) ? 8 * 3600000 : REPORT_MAX_AGE_MS, Date.parse(entry.checkedAt)), key);
    }
    if (entry.adapter === 'open-meteo') {
      assert.equal(entry.metrics.runsOpen, null, key);
      assert.equal(entry.metrics.runsTotal, null, key);
      assert.equal(entry.metrics.groomedRuns, null, key);
    }
    for (const url of Object.values(entry.sources || {})) {
      if (!url) continue;
      assert.ok(![...new URL(url).searchParams.keys()].some(key => /token|secret|auth/i.test(key)), key);
    }
  }
});

test('published forecast snapshot accounts for all resorts and dates every successful forecast', async () => {
  const data = await read('resort-forecasts');
  assert.equal(data.schemaVersion, 2);
  assert.deepEqual(Object.keys(data.resorts).sort(), [...loadAllResorts().keys()].sort());
  for (const [key, forecast] of Object.entries(data.resorts)) {
    if (forecast.status === 'error') { assert.ok(forecast.error && forecast.checkedAt, key); continue; }
    assert.ok(forecastIsCurrent(forecast, Date.parse(forecast.updatedAt)), key);
    assert.ok(forecast.recentConditions && forecast.recentConditionsAt, key);
    assert.equal(forecast.dailyTime.length, forecast.dailySnowfall.length, key);
    assert.ok(forecast.dailySnowfall.every(n => n === null || Number.isFinite(n) && n >= 0), key);
    assert.equal(Date.parse(forecast.periodEnd) - Date.parse(forecast.periodStart), 72 * 3600000, key);
  }
});

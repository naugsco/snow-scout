import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentSnowStatus, parseCurrentSnow, currentSnowUrl, loadCurrentSnow } from '../js/current-snow.js';

const now = Date.parse('2026-11-06T18:10:00Z');
const payload = (snowfall = .02, time = now / 1000 - 600) => ({
  current_units: { snowfall: 'cm', time: 'unixtime' },
  current: { snowfall, time, interval: 900 }
});
const resort = () => ({ name: 'Test mountain', lat: 50.1, lon: -122.9 });

test('only fresh current snowfall activates snow; zero, missing, old and future values stay distinct', () => {
  const reading = parseCurrentSnow(payload(), now);
  assert.equal(currentSnowStatus(reading, now), 'snowing');
  assert.equal(currentSnowStatus(parseCurrentSnow(payload(0), now), now), 'dry');
  assert.equal(currentSnowStatus(null, now), 'unavailable');
  assert.equal(currentSnowStatus(reading, now + 31 * 60000), 'unavailable');
  assert.equal(currentSnowStatus({ ...reading, snowfallCm: null }, now), 'unavailable');
  assert.equal(currentSnowStatus({ ...reading, checkedAt: '2000-01-01T00:00:00Z' }, now), 'unavailable');
  assert.throws(() => parseCurrentSnow(payload(.1, now / 1000 - 3600), now), /stale/);
  assert.throws(() => parseCurrentSnow(payload(.1, now / 1000 + 3600), now), /stale/);
  assert.throws(() => parseCurrentSnow(payload(-1), now), /incomplete/);
  assert.throws(() => parseCurrentSnow(payload(null), now), /incomplete/);
  assert.throws(() => parseCurrentSnow({ ...payload(), current_units: { snowfall: 'inch', time: 'unixtime' } }, now), /units/);
});

test('batched current requests preserve coordinate order and assign independent snowfall states', async () => {
  const list = [resort(), { ...resort(), lat: 49.2, lon: -123.1 }];
  const url = new URL(currentSnowUrl(list));
  assert.equal(url.searchParams.get('latitude'), '50.1000,49.2000');
  assert.equal(url.searchParams.get('longitude'), '-122.9000,-123.1000');
  assert.equal(url.searchParams.get('current'), 'snowfall');
  await loadCurrentSnow(list, null, now, async () => ({ ok: true, json: async () => [payload(), payload(0)] }));
  assert.deepEqual(list.map(r => currentSnowStatus(r.currentSnow, now)), ['snowing', 'dry']);
});

test('in-flight requests are deduplicated, refreshes are bounded, and failed updates clear snow and surface errors', async () => {
  const list = [resort()];
  let calls = 0;
  let release;
  const response = new Promise(resolve => { release = resolve; });
  const fetchImpl = async () => { calls++; return response; };
  const pending = loadCurrentSnow(list, null, now, fetchImpl);
  await loadCurrentSnow(list, null, now, fetchImpl);
  assert.equal(calls, 1);
  release({ ok: true, json: async () => payload() });
  await pending;
  await loadCurrentSnow(list, null, now + 5 * 60000, fetchImpl);
  assert.equal(calls, 1);
  await assert.rejects(loadCurrentSnow(list, null, now + 10 * 60000, async () => ({ ok: false, status: 429 })), /429/);
  assert.equal(list[0].currentSnow, null);
});

test('a partial batch is rejected instead of assigning snow to the wrong resort', async () => {
  const list = [resort(), resort()];
  await assert.rejects(loadCurrentSnow(list, null, now, async () => ({ ok: true, json: async () => payload() })), /number of resorts/);
  assert.ok(list.every(r => r.currentSnow === null));
});

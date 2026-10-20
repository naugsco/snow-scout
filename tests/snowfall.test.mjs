import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentSeason, currentSnowfall, rankedSnowfall, historyRecords } from '../js/season-snowfall.js';

const now = new Date('2026-10-19T12:00:00Z');
const resorts = [
  { id: 'a', name: 'A', lat: 45, passes: ['ikon', 'mountain-collective'] },
  { id: 'b', name: 'B', lat: 44, passes: ['epic'] },
  { id: 'c', name: 'C', lat: -45, passes: ['mountain-collective'] },
  { id: 'd', name: 'D', lat: 44, passes: ['epic'] }
];
const catalog = { resorts: {
  a: { seasons: [{ season: '2026/27', total: 12, complete: false }, { season: '1940/41', total: 200, complete: true }, { season: '2025/26', total: 150, complete: true }] },
  b: { seasons: [{ season: '2026/27', total: 0, complete: false }, { season: '2025/26', total: 100, complete: true }] },
  c: { seasons: [{ season: '2026', total: 300, complete: false }, { season: '2025', total: 250, complete: true }] }
} };

test('northern seasons roll in July; southern seasons roll in January', () => {
  assert.equal(currentSeason(resorts[0], new Date('2026-06-30T23:59:00Z')), '2025/26');
  assert.equal(currentSeason(resorts[0], new Date('2026-07-01T00:00:00Z')), '2026/27');
  assert.equal(currentSeason(resorts[2], now), '2026');
});

test('every resort is ranked, missing totals are separate from true zero, highest is leftmost', () => {
  const ranked = rankedSnowfall(resorts, catalog, now);
  assert.deepEqual(ranked.map((row) => row.resort.id), ['c', 'a', 'b', 'd']);
  assert.equal(ranked[3].total, null);
  assert.equal(ranked[2].total, 0);
});

test('last season total cannot enter the current chart', () => {
  const pastOnly = { resorts: { a: { seasons: [{ season: '2025/26', total: 500 }] } } };
  assert.equal(currentSnowfall(resorts[0], pastOnly, now).total, null);
});

test('history includes oldest complete seasons and excludes ongoing seasons', () => {
  const records = historyRecords(resorts, catalog, {}, now);
  assert.equal(records.length, 4);
  assert.ok(records.some((row) => row.season === '1940/41'));
  assert.ok(records.every((row) => row.complete));
});

test('pass, resort, season, and inclusive snowfall bounds compose correctly', () => {
  const records = historyRecords(resorts, catalog, { pass: 'mountain-collective', query: 'a', season: '2025/26', min: 150, max: 150 }, now);
  assert.deepEqual(records.map((row) => row.resort.id), ['a']);
  assert.equal(historyRecords(resorts, catalog, { pass: 'epic', min: 101 }, now).length, 0);
});

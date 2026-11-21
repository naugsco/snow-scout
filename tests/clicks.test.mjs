import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/index.mjs';
import { parseClick, createClickStore, ClickCounter, tokenMatches, DAILY_LIMIT } from '../worker/clicks.mjs';
import { classifyOutbound, bindOutboundClicks, CLICK_ENDPOINT } from '../js/outbound-clicks.js';
import { summarize } from '../scripts/click_stats.mjs';

// Durable Object-style SQL executor backed by Node's built-in SQLite.
function fakeSql() {
  const db = new DatabaseSync(':memory:');
  return { exec(query, ...bindings) {
    const statement = db.prepare(query);
    const rows = /^\s*SELECT/i.test(query) ? statement.all(...bindings) : (statement.run(...bindings), []);
    return { toArray: () => rows.map((row) => ({ ...row })) };
  } };
}

test('click bodies are strictly validated', () => {
  assert.deepEqual(parseClick('{"partner":"kayak","kind":"flights","resort":"vail","extra":1}'), { partner: 'kayak', kind: 'flights', resort: 'vail' });
  assert.deepEqual(parseClick('{"partner":"booking","kind":"lodging","resort":"unknown"}'), { partner: 'booking', kind: 'lodging', resort: 'unknown' });
  for (const bad of ['', 'nope', 'null', '{"partner":"expedia","kind":"flights","resort":"vail"}',
    '{"partner":"kayak","kind":"cars","resort":"vail"}', '{"partner":"kayak","kind":"flights","resort":"Vail"}',
    '{"partner":"kayak","kind":"flights","resort":"<x>"}', `{"partner":"kayak","kind":"flights","resort":"${'a'.repeat(61)}"}`,
    'x'.repeat(600)]) assert.equal(parseClick(bad), null, bad);
});

test('store aggregates per day and enforces the daily cap', () => {
  let now = Date.parse('2026-11-21T10:00:00Z');
  const store = createClickStore(fakeSql(), () => now);
  assert.equal(store.record({ partner: 'kayak', kind: 'flights', resort: 'vail' }), true);
  store.record({ partner: 'kayak', kind: 'flights', resort: 'vail' });
  store.record({ partner: 'booking', kind: 'lodging', resort: 'whistler-blackcomb' });
  now += 86400000;
  store.record({ partner: 'kayak', kind: 'flights', resort: 'vail' });
  const { rows, since } = store.summary(2);
  assert.equal(since, '2026-11-21');
  assert.deepEqual(rows.map((r) => [r.day, r.partner, r.resort, r.count]), [
    ['2026-11-22', 'kayak', 'vail', 1], ['2026-11-21', 'kayak', 'vail', 2], ['2026-11-21', 'booking', 'whistler-blackcomb', 1]]);
  assert.equal(store.summary(1).rows.length, 1);
  assert.throws(() => store.summary(0));
  const sql = fakeSql();
  const capped = createClickStore(sql, () => now);
  sql.exec('INSERT INTO daily_totals (day, count) VALUES (?, ?)', '2026-11-22', DAILY_LIMIT);
  assert.equal(capped.record({ partner: 'kayak', kind: 'flights', resort: 'vail' }), false);
  assert.equal(capped.summary(1).rows.length, 0);
});

test('worker routes clicks by origin and protects the summary with a token', async () => {
  const counter = new ClickCounter({ storage: { sql: fakeSql() } });
  const env = { CLICK_STATS_TOKEN: 'x'.repeat(40), CLICK_COUNTER: { idFromName: (n) => n, get: () => ({ fetch: (r) => counter.fetch(r) }) } };
  const body = JSON.stringify({ partner: 'kayak', kind: 'flights', resort: 'vail' });
  const post = (origin, text = body) => worker.fetch(new Request('https://w/api/clicks', { method: 'POST', body: text,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Content-Length': String(new TextEncoder().encode(text).length), ...(origin ? { Origin: origin } : {}) } }), env);
  assert.equal((await post('https://snowscout.ski')).status, 204);
  assert.equal((await post('https://evil.example')).status, 403);
  assert.equal((await post(null)).status, 403);
  assert.equal((await post('https://snowscout.ski', '{"partner":"x"}')).status, 400);
  assert.equal((await worker.fetch(new Request('https://w/api/clicks', { headers: { Origin: 'https://snowscout.ski' } }), env)).status, 405);
  const summary = (auth) => worker.fetch(new Request('https://w/api/clicks/summary?days=7', { headers: auth ? { Authorization: auth } : {} }), env);
  assert.equal((await summary()).status, 401);
  assert.equal((await summary(`Bearer ${'y'.repeat(40)}`)).status, 401);
  const ok = await summary(`Bearer ${'x'.repeat(40)}`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).rows[0].count, 1);
  assert.equal(tokenMatches('Bearer short', 'short'), false, 'short secrets are refused');
});

function anchor(href, { lodging = false, card = null } = {}) {
  return { href, closest: (sel) => (sel === '.travel-lodging' && lodging) ? {} : (sel === '.trip-card' && card) ? { querySelector: () => ({ textContent: card }) } : null };
}

test('outbound links are classified without sending trip details', () => {
  const ctx = { pageHost: 'snowscout.ski', hash: '#resort=kitzb-hel&sort=forecast72h' };
  assert.deepEqual(classifyOutbound(anchor('https://www.kayak.com/flights/YVR-RNO/2026-12-01/2026-12-05/2adults'), ctx), { partner: 'kayak', kind: 'flights', resort: 'kitzb-hel' });
  assert.deepEqual(classifyOutbound(anchor('https://www.booking.com/searchresults.html?dest_id=1'), ctx), { partner: 'booking', kind: 'lodging', resort: 'kitzb-hel' });
  assert.deepEqual(classifyOutbound(anchor('https://www.google.com/maps/search/?q=x', { lodging: true }), ctx), { partner: 'google-maps', kind: 'lodging', resort: 'kitzb-hel' });
  assert.deepEqual(classifyOutbound(anchor('https://www.vail.com/plan-your-trip/stay', { lodging: true, card: 'Whistler Blackcomb' }), ctx), { partner: 'official', kind: 'lodging', resort: 'whistler-blackcomb' });
  assert.equal(classifyOutbound(anchor('https://www.google.com/maps/dir/?x'), ctx), null, 'directions are not counted');
  assert.equal(classifyOutbound(anchor('https://snowscout.ski/resorts/'), ctx), null);
  assert.equal(classifyOutbound(anchor('mailto:x@example.com'), ctx), null);
  assert.equal(classifyOutbound(anchor('https://notkayak.com/'), ctx), null);
  assert.equal(classifyOutbound(anchor('https://www.kayak.com/'), { pageHost: 'snowscout.ski', hash: '#resort=<bad>' }).resort, 'unknown');
});

test('bound listener sends one beacon for counted clicks only', () => {
  const listeners = {}; const sent = [];
  globalThis.location = { hostname: 'snowscout.ski', hash: '#resort=vail' };
  bindOutboundClicks({ addEventListener: (type, fn) => { listeners[type] = fn; } }, (url, body) => sent.push([url, JSON.parse(body)]));
  const target = (href) => ({ closest: (sel) => sel === 'a[href]' ? anchor(href) : null });
  listeners.click({ type: 'click', target: target('https://www.kayak.com/flights/x'), defaultPrevented: false });
  listeners.click({ type: 'click', target: target('https://www.kayak.com/flights/x'), defaultPrevented: true });
  listeners.auxclick({ type: 'auxclick', button: 2, target: target('https://www.kayak.com/flights/x') });
  listeners.auxclick({ type: 'auxclick', button: 1, target: target('https://www.booking.com/x') });
  listeners.click({ type: 'click', target: target('https://example.org/'), defaultPrevented: false });
  assert.deepEqual(sent, [[CLICK_ENDPOINT, { partner: 'kayak', kind: 'flights', resort: 'vail' }], [CLICK_ENDPOINT, { partner: 'booking', kind: 'lodging', resort: 'vail' }]]);
  delete globalThis.location;
});

test('stats summary groups counts', () => {
  const s = summarize([{ day: '2026-11-21', partner: 'kayak', kind: 'flights', resort: 'vail', count: 3 },
    { day: '2026-11-20', partner: 'booking', kind: 'lodging', resort: 'vail', count: 2 }]);
  assert.equal(s.total, 5);
  assert.deepEqual(s.byPartner[0], ['flights · kayak', 3]);
  assert.deepEqual(s.byResort, [['vail', 5]]);
  assert.deepEqual(s.byDay.map(([d]) => d), ['2026-11-21', '2026-11-20']);
});

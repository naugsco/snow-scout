import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TRAVEL_GUIDES, guideIsCurrent, transferSeasonWarning, stayDates, staySearchUrl, areaMapUrl } from '../js/travel-guides.js';
import { RAW_RESORTS } from '../js/constants.js';
import { GATEWAYS } from '../js/trip-planning.js';
import { resorts } from '../js/resorts.js';

test('reviewed guides match actual resorts and catalog gateways, with sources for every operator and area', async () => {
  const { readFile } = await import('node:fs/promises');
  const { airports } = JSON.parse(await readFile(new URL('../data/travel-airports.json', import.meta.url)));
  assert.equal(Object.keys(TRAVEL_GUIDES).length, resorts.length);
  assert.deepEqual(Object.keys(TRAVEL_GUIDES).sort(), resorts.map(r => r.name).sort());
  for (const [name, guide] of Object.entries(TRAVEL_GUIDES)) {
    assert.ok(RAW_RESORTS.some(r => r.name === name), name);
    assert.ok(airports.some(a => a.code === guide.airport));
    assert.equal(GATEWAYS[name].code, guide.airport);
    assert.equal(GATEWAYS[name].verified, guide.airportVerified !== false);
    for (const url of [guide.accessUrl, guide.stayUrl, ...guide.transfers.flatMap(t => [t.url, t.sourceUrl])]) assert.equal(new URL(url).protocol, 'https:');
    assert.ok(guide.transfers.every(t => t.pickup && t.dropoff && t.baggage && t.season && t.timing));
    assert.equal(new Set(guide.areas.map(a => a.id)).size, guide.areas.length);
    assert.ok(guide.areas.every(a => a.access && a.transfer && a.query));
    if (guide.localTransport) assert.equal(new URL(guide.localTransport.url).protocol, 'https:');
    // A geographic flight-search suggestion must never acquire an airport
    // operator merely because we have local ski buses for this destination.
    if (guide.airportVerified === false) assert.equal(guide.transfers.length, 0, name);
  }
});

test('review freshness expires and never treats future or malformed review dates as current', () => {
  const guide = TRAVEL_GUIDES.Heavenly;
  assert.equal(guideIsCurrent(guide, '2026-11-06'), true);
  assert.equal(guideIsCurrent(guide, '2027-02-05'), false);
  assert.equal(guideIsCurrent(guide, '2026-11-05'), false);
  assert.equal(guideIsCurrent({reviewedAt:'bad'}, '2026-11-06'), false);
  assert.equal(guideIsCurrent(undefined), false);
});

test('winter seasonal guidance rejects impossible travel windows without promising a flight connection', () => {
  const transfer = TRAVEL_GUIDES['Niseko United'].transfers[0];
  assert.match(transferSeasonWarning(transfer, { departure:'2026-11-10', returnDate:'2026-11-15' }), /outside.*airport-to-resort/);
  assert.match(transferSeasonWarning(transfer, { departure:'2027-03-25', returnDate:'2027-04-02' }), /return flight.*outside/);
  assert.equal(transferSeasonWarning(transfer, { departure:'2026-11-30', returnDate:'2026-12-05' }), ''); // An overnight flight may arrive on Dec 1.
  assert.equal(transferSeasonWarning(transfer, { departure:'2026-12-10', returnDate:'2026-12-15' }), '');
});

test('stay search preserves local dates, adults and area; custom dates are independent of home departure', () => {
  const trip = { departure:'2026-12-10', returnDate:'2026-12-15', adults:2 };
  const provisional = stayDates(trip, {}, '2026-11-06');
  assert.deepEqual(provisional, { checkin:'2026-12-10', checkout:'2026-12-15', adults:2 });
  const custom = stayDates(trip, { customDates:true, checkin:'2026-12-11', checkout:'2026-12-16' }, '2026-11-06');
  const query = 'Argentière, Chamonix-Mont-Blanc, France';
  const destination = TRAVEL_GUIDES['Chamonix (Mont Blanc)'].bookingDestination;
  const url = new URL(staySearchUrl(destination, custom));
  assert.equal(url.hostname, 'www.booking.com');
  assert.equal(url.searchParams.get('dest_id'), '-1418045');
  assert.equal(url.searchParams.get('dest_type'), 'city');
  assert.equal(url.searchParams.has('ss'), false);
  assert.throws(() => staySearchUrl({id:'made-up',type:'city'}, custom));
  assert.equal(url.searchParams.get('checkin'), '2026-12-11');
  assert.equal(url.searchParams.get('checkout'), '2026-12-16');
  assert.equal(url.searchParams.get('group_adults'), '2');
  assert.equal(url.searchParams.get('no_rooms'), '1');
  assert.equal(url.searchParams.has('aid'), false);
  assert.equal(new URL(areaMapUrl(query)).searchParams.get('query'), `accommodation near ${query}`);
  for (const stay of [{customDates:true, checkin:'2026-12-15',checkout:'2026-12-10'}, {customDates:true, checkin:'2026-02-30', checkout:'2026-12-10'}, {customDates:true,checkin:'2026-10-01',checkout:'2026-12-10'}]) assert.throws(() => stayDates(trip, stay, '2026-11-06'));
  assert.throws(() => stayDates({...trip,adults:0}, {}, '2026-11-06'));
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resorts} from '../js/resorts.js';
import {availableSubregions, regionMatches, subregionsFor} from '../js/resort-regions.js';

test('every North American destination is assigned a state or province; other continents are excluded', () => {
  for (const resort of resorts) {
    assert.equal(subregionsFor(resort).length > 0, resort.region === 'north-america', resort.name);
  }
  assert.deepEqual(availableSubregions(resorts), availableSubregions(resorts).toSorted((a,b) => a.localeCompare(b)));
});
test('state/province selections distinguish local membership and preserve worldwide and continent filters', () => {
  const whistler = resorts.find(r => r.name === 'Whistler Blackcomb');
  const heavenly = resorts.find(r => r.name === 'Heavenly');
  for (const filter of ['all','north-america','north-america:British Columbia']) assert.ok(regionMatches(whistler, filter));
  for (const filter of ['japan','north-america:Colorado','north-america:Alberta']) assert.equal(regionMatches(whistler, filter), false);
  assert.ok(regionMatches(heavenly, 'north-america:California'));
  assert.ok(regionMatches(heavenly, 'north-america:Nevada'));
  assert.equal(regionMatches(heavenly, 'north-america:Utah'), false);
});

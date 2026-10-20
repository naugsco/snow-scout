import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {RAW_RESORTS} from '../js/constants.js';
import {mountainConfig, mountainSlug, mountainUrl} from '../js/mountain-config.js';

test('every catalog resort has a unique, resolvable mountain link', () => {
  const resorts = new Map(RAW_RESORTS.map(resort => [resort.name, resort]));
  const slugs = new Set();
  for (const resort of resorts.values()) {
    const slug = mountainSlug(resort.name);
    assert.ok(!slugs.has(slug), `Duplicate mountain URL for ${resort.name}`);
    slugs.add(slug);
    assert.equal(new URL(mountainUrl(resort), 'https://example.org/snow-scout/').searchParams.get('resort'), slug);
    const config = mountainConfig(resort);
    assert.ok(config.center.every(Number.isFinite));
    assert.ok(config.bounds[0] < config.center[0] && config.center[0] < config.bounds[2]);
    assert.ok(config.bounds[1] < config.center[1] && config.center[1] < config.bounds[3]);
  }
});

test('only Whistler advertises a trail overlay; other resorts cannot reuse its geometry', () => {
  for (const resort of RAW_RESORTS) {
    const config = mountainConfig(resort);
    if (resort.name !== 'Whistler Blackcomb') {
      assert.equal(config.trailsUrl, null);
      assert.deepEqual(config.namedLabels, []);
    }
  }
});

test('published Whistler geometry supplies every named label and valid route coordinates', async () => {
  const resort = RAW_RESORTS.find(item => item.name === 'Whistler Blackcomb');
  const config = mountainConfig(resort);
  const data = JSON.parse(await readFile(new URL(config.trailsUrl), 'utf8'));
  assert.ok(data.features.some(feature => feature.properties.kind === 'lift'));
  assert.ok(data.features.some(feature => feature.properties.kind === 'trail'));
  for (const label of config.namedLabels) assert.ok(data.features.some(feature => feature.properties.name === label.name));
  for (const feature of data.features) {
    assert.equal(feature.geometry.type, 'LineString');
    assert.ok(feature.geometry.coordinates.length >= 2);
    for (const [lon, lat] of feature.geometry.coordinates) {
      assert.ok(lon > -180 && lon < 180 && lat > -90 && lat < 90);
    }
  }
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {RAW_RESORTS} from '../js/constants.js';
import {mountainConfig, mountainSlug, mountainUrl} from '../js/mountain-config.js';
import {TRAIL_CATALOG} from '../js/trail-catalog.js';
import {trailColor, trailLegend} from '../js/trail-style.js';

test('every catalog resort has a unique, resolvable mountain link', () => {
  const resorts = new Map(RAW_RESORTS.map(resort => {
    const name = resort.name === 'Squaw Valley Alpine Meadows' ? 'Palisades Tahoe' : resort.name;
    return [name, {...resort, name}];
  }));
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

test('all 105 canonical resorts have their own local trail and lift snapshot', async () => {
  const names = new Set(RAW_RESORTS.map(resort => resort.name === 'Squaw Valley Alpine Meadows' ? 'Palisades Tahoe' : resort.name));
  assert.equal(names.size, 105);
  assert.equal(Object.keys(TRAIL_CATALOG).length, names.size);
  for (const name of names) {
    const config = mountainConfig({name});
    const catalog = config.coverage;
    assert.ok(catalog.trails > 0 && catalog.lifts > 0, name);
    const data = JSON.parse(await readFile(new URL(config.trailsUrl), 'utf8'));
    assert.ok(data.license, name);
    assert.equal(data.features.filter(f => f.properties.kind === 'trail').length, catalog.trails, name);
    assert.equal(data.features.filter(f => f.properties.kind === 'lift').length, catalog.lifts, name);
    assert.equal(new Set(data.features.map(f => f.properties.id)).size, data.features.length, name);
    if (name === 'Whistler Blackcomb') continue;
    assert.equal(data.name, name);
    assert.equal(catalog.conventions.length, 1, name);
    const ids = new Set(catalog.areas.map(area => area.id));
    for (const feature of data.features) {
      assert.ok(feature.properties.skiAreas.some(id => ids.has(id)), `${name}: foreign ski area`);
      assert.ok(feature.properties.sources.length, `${name}: missing upstream provenance`);
      assert.equal(feature.geometry.type, 'LineString');
      for (const [lon,lat] of feature.geometry.coordinates) {
        assert.ok(lon >= config.bounds[0] && lon <= config.bounds[2] && lat >= config.bounds[1] && lat <= config.bounds[3], name);
      }
    }
  }
});

test('group destinations cover every reviewed mountain and have cameras for choosing areas', () => {
  for (const [name, count] of [['Hakuba Valley',10],['Aspen Snowmass',4],['SkiBig3 (Banff)',3],['Big Bear Mountain',3],['Palisades Tahoe',2],['Jack Frost / Big Boulder',2]]) {
    const config = mountainConfig({name});
    assert.equal(config.coverage.areas.length, count, name);
    assert.ok(config.views.length >= count, name);
    assert.ok(config.views.every(view => view.range > 0 && view.center.every(Number.isFinite)), name);
  }
  const big3 = mountainConfig({name:'SkiBig3 (Banff)'});
  assert.ok(big3.range > 45000, 'The old camera cap must not crop Lake Louise out of the group overview');
  assert.notDeepEqual(mountainConfig({name:'Alta'}).coverage.areas, mountainConfig({name:'Snowbird'}).coverage.areas);
});

test('regional route colors and legends preserve source grading', () => {
  assert.equal(trailColor('easy','europe'), '#198be8');
  assert.equal(trailColor('intermediate','europe'), '#e24545');
  assert.equal(trailColor('intermediate','japan'), '#e24545');
  assert.equal(trailColor('intermediate','north_america'), '#198be8');
  assert.equal(trailColor('unknown','north_america'), '#859cac');
  assert.notDeepEqual(trailLegend('europe'), trailLegend('north_america'));
  assert.throws(()=>trailColor('easy','unsupported'), /Unsupported/);
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

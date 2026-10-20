import { TRAIL_CATALOG } from './trail-catalog.js?v=20261020-all-trails';

export function mountainSlug(name) {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '-');
}

export function mountainUrl(resort) {
  return `mountain.html?resort=${encodeURIComponent(mountainSlug(resort.name))}`;
}

export function mountainConfig(resort) {
  const mapped = TRAIL_CATALOG[mountainSlug(resort.name)];
  if (!mapped) throw new Error(`Trail catalog entry missing for ${resort.name}.`);
  if (resort.name === 'Whistler Blackcomb') {
    return {
      coverage: mapped, convention: 'north_america', views: [], mobileRange: 22000, minRange: 3500,
      name: resort.name, center: [-122.923, 50.082], height: 1800,
      heading: 145, pitch: -19, range: 10800, snowline: 1900,
      bounds: [-123.01, 50.02, -122.84, 50.13],
      forestBounds: [-122.99, 50.035, -122.86, 50.125],
      trailsUrl: new URL('../data/trails/whistler.geojson', import.meta.url).href,
      namedLabels: [
        {name: 'Crystal Traverse', text: 'CRYSTAL TRAVERSE', offset: [-10, -20]},
        {name: 'Harmony Ridge', text: 'HARMONY RIDGE', offset: [8, -20]},
        {name: 'Peak to Creek - Lower', text: 'PEAK TO CREEK', offset: [22, -12]}
      ]
    };
  }
  return {
    name: resort.name, center: mapped.center, height: null,
    heading: 145, pitch: -29, range: mapped.range,
    bounds: mapped.bounds, forestBounds: mapped.bounds,
    trailsUrl: new URL(`../data/trails/${mapped.file}`, import.meta.url).href,
    namedLabels: [], coverage: mapped, convention: mapped.conventions[0],
    views: mapped.views.length > 1 ? mapped.views : []
  };
}

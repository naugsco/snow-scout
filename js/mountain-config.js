import { TRAIL_MAP_VIEWPORTS } from './trail-map-viewports.js?v=20261020-painted-mountains';

export function mountainSlug(name) {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '-');
}

export function mountainUrl(resort) {
  return `mountain.html?resort=${encodeURIComponent(mountainSlug(resort.name))}`;
}

export function mountainConfig(resort) {
  if (resort.name === 'Whistler Blackcomb') {
    return {
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
  const viewport = TRAIL_MAP_VIEWPORTS[resort.name];
  // Never show another ski area's geometry as this resort's trails.
  const center = viewport && !viewport.proxyName ? viewport.center : [resort.lon, resort.lat];
  const [lon, lat] = center;
  const dx = 6000 / (111000 * Math.cos(lat * Math.PI / 180));
  const dy = 6000 / 111000;
  return {
    name: resort.name, center, height: null, heading: 145, pitch: -29, range: 10800,
    bounds: [lon - dx, lat - dy, lon + dx, lat + dy],
    forestBounds: [lon - dx, lat - dy, lon + dx, lat + dy],
    trailsUrl: null, namedLabels: []
  };
}

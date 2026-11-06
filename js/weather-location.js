import { WEATHER_LOCATIONS } from './weather-locations-data.js?v=20261106-mountain-weather';

export function weatherLocation(resort) {
  const point = WEATHER_LOCATIONS[resort.name];
  if (point) return point;
  // Unknown/test destinations retain their supplied coordinates, explicitly unreviewed.
  return { lat:resort.lat, lon:resort.lon, label:'Catalog location · terrain unverified', elevationM:null };
}

export function weatherLocationLabel(resort, forecast = resort.liveForecast) {
  const point = weatherLocation(resort);
  const elevation = forecast?.weatherLocation?.elevationM ?? point.elevationM;
  return `${point.label}${Number.isFinite(elevation) ? ` · ${Math.round(elevation).toLocaleString()} m` : ' · elevation unavailable'}`;
}

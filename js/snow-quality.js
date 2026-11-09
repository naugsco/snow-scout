import { isFresh, REPORT_MAX_AGE_MS, SNAPSHOT_MAX_AGE_MS } from './condition-data.js?v=20261021-sources-verified';
import { forecastIsCurrent } from './weather-data.js?v=20261109-powder-alert';

export const isQualityMetric = id => ['bestToday', 'bestUpcoming'].includes(id);
const valid = value => Number.isFinite(value) && value >= 0;

// These are explicit product heuristics, not calibrated snow-quality measurements.
export function weatherFactors(weather) {
  if (!weather || weather.status !== 'ok' || ![weather.minTempF, weather.maxTempF].every(Number.isFinite)
      || weather.minTempF > weather.maxTempF
      || ![weather.rainMm, weather.windMph, weather.gustMph].every(valid)) return null;
  return {
    warmth: Math.max(.2, 1 - Math.max(0, weather.maxTempF - 32) * .05),
    rain: 1 / (1 + weather.rainMm / 2),
    wind: Math.max(.25, 1 - Math.max(0, weather.windMph - 20, (weather.gustMph - 30) / 1.5) / 40),
    refreeze: weather.minTempF < 32 && weather.maxTempF > 32 ? .75 : 1
  };
}

export function qualityAssessment(resort, metric, now = Date.now()) {
  if (!isQualityMetric(metric)) throw new Error(`Unknown snow-quality metric: ${metric}`);
  const unavailable = reason => ({ value: null, reason });
  if (metric === 'bestToday') {
    if (resort.liveTerrainStatus !== 'ready' || !isFresh(resort.liveCheckedAt, SNAPSHOT_MAX_AGE_MS, now)
        || !isFresh(resort.liveTerrainReportedAt,
          ['checked', 'feed'].includes(resort.liveTerrainTimestampKind) ? SNAPSHOT_MAX_AGE_MS : REPORT_MAX_AGE_MS, now)) {
      return unavailable('Opening unverified');
    }
    if (resort.metrics.runsOpen === 0) return unavailable('No ski runs reported open');
    if (!valid(resort.metrics.runsOpen) || resort.metrics.runsOpen === 0) return unavailable('Open ski terrain unverified');
  }
  const forecast = resort.liveForecast;
  if (!forecastIsCurrent(forecast, now)) return unavailable('Current weather unavailable');
  const quality = forecast.skiQuality;
  if (quality?.version !== 1) return unavailable('Rain and wind data unavailable');
  const window = metric === 'bestToday' ? quality.today : quality.upcoming;
  const factors = weatherFactors(window);
  if (!factors) return unavailable(window?.reason || 'Incomplete weather inputs');
  let snow;
  if (metric === 'bestToday') {
    const m = resort.metrics;
    if (resort.liveSnowStatus !== 'ready' || !isFresh(resort.liveSnowReportedAt,
        resort.liveConditionsKind === 'model' ? SNAPSHOT_MAX_AGE_MS : REPORT_MAX_AGE_MS, now)
        || ![m.snow24h, m.snow48h, m.snow72h].every(valid)
        || m.snow24h > m.snow48h || m.snow48h > m.snow72h) return unavailable('Recent snowfall unavailable');
    snow = m.snow24h + .5 * (m.snow48h - m.snow24h) + .25 * (m.snow72h - m.snow48h);
  } else snow = forecast.forecast72h;
  const value = Math.round(10 * snow * Object.values(factors).reduce((a,b) => a * b, 1));
  return { value, snowInches: snow, weather: window, factors,
    reason: metric === 'bestToday' ? 'Experimental score · Verified open terrain' : 'Experimental score · Opening not checked' };
}

export function qualityExplanation(result, useMetric = false) {
  if (result.value === null) return result.reason;
  const weather = result.weather;
  const temp = value => Math.round(useMetric ? (value - 32) * 5 / 9 : value);
  const wind = value => Math.round(useMetric ? value * 1.609344 : value);
  const snow = useMetric ? `${(result.snowInches * 2.54).toFixed(1)} cm` : `${result.snowInches.toFixed(1)}″`;
  const penalties = Object.entries(result.factors).filter(([,value]) => value < 1)
    .map(([key,value]) => `${key === 'refreeze' ? 'Freeze–thaw' : key[0].toUpperCase() + key.slice(1)} −${Math.round((1-value)*100)}%`);
  return `${result.value} points · ${snow} snow basis · ${weather.rainMm.toFixed(1)} mm rain · ${wind(weather.windMph)} ${useMetric ? 'km/h' : 'mph'} wind / ${wind(weather.gustMph)} ${useMetric ? 'km/h' : 'mph'} gusts · ${temp(weather.minTempF)}–${temp(weather.maxTempF)}°${useMetric ? 'C' : 'F'}${penalties.length ? ' · ' + penalties.join(' · ') : ' · No weather deductions'} · ${result.reason}. Model at one mountain elevation; future opening and lift operation are not guaranteed.`;
}

// Describe the forecast directly; aggregate summaries cannot identify which day a risk occurs.
export function forecastTradeoffs(resort, useMetric = false, now = Date.now()) {
  const forecast = resort.liveForecast;
  if (!forecastIsCurrent(forecast, now)) return 'Forecast weather details unavailable: a current forecast is needed.';
  const weather = forecast.skiQuality?.version === 1 ? forecast.skiQuality.upcoming : null;
  const factors = weatherFactors(weather);
  if (!factors) return 'Forecast weather details unavailable: incomplete temperature, rain or wind inputs.';
  const snow = useMetric ? `${(forecast.forecast72h * 2.54).toFixed(1)} cm` : `${forecast.forecast72h.toFixed(1)}″`;
  const temp = value => Math.round(useMetric ? (value - 32) * 5 / 9 : value);
  const speed = value => Math.round(useMetric ? value * 1.609344 : value);
  const parts = [`Next 72h: ${snow} snowfall`];
  parts.push(weather.rainMm > 0 ? `Rain possible: ${weather.rainMm.toFixed(1)} mm` : 'No rain forecast');
  parts.push(weather.maxTempF > 32
    ? `Above freezing: up to ${temp(weather.maxTempF)}°${useMetric ? 'C' : 'F'}`
    : `At or below freezing: high ${temp(weather.maxTempF)}°${useMetric ? 'C' : 'F'}`);
  parts.push(`${factors.wind < 1 ? 'Strong winds possible' : 'Lighter winds'}: up to ${speed(weather.windMph)} ${useMetric ? 'km/h' : 'mph'}, gusts ${speed(weather.gustMph)} ${useMetric ? 'km/h' : 'mph'}`);
  if (factors.refreeze < 1) parts.push('Freeze–thaw possible');
  return `${parts.join(' · ')}. Model at one mountain elevation; opening status is not checked.`;
}

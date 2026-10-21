import { assessConditions, normalizeConditionMetrics, SNOW_KEYS, isFresh } from './condition-data.js?v=20261021-sources-verified';
import { forecastIsCurrent } from './weather-data.js?v=20261021-sources-verified';

// Pick a whole recent-weather report, so observed and modeled cumulative periods are never mixed.
export function chooseConditions(entry, snapshotAt, forecast, now = Date.now()) {
  const assessed = assessConditions(entry, snapshotAt, now);
  const selected = { ...entry, ...assessed, snowSourceKind: entry?.snowSourceKind || (entry?.adapter === 'open-meteo' ? 'model' : 'reported') };
  selected.issues = [...new Set([...(entry?.issues || []), ...assessed.issues])];
  selected.primarySnowStatus = selected.snowSourceKind === 'model' ? entry?.primarySnowStatus || assessed.snowStatus : assessed.snowStatus;
  selected.officialSnowReportedAt = entry?.officialSnowReportedAt || (selected.snowSourceKind === 'reported' ? entry?.snowReportedAt : null);
  selected.temperatureKind = entry?.temperatureKind || selected.snowSourceKind;
  selected.temperatureReportedAt = entry?.temperatureReportedAt || entry?.snowReportedAt;
  if (assessed.snowStatus !== 'ready' && forecastIsCurrent(forecast, now) && isFresh(forecast.recentConditionsAt, undefined, now)) {
    const modeled = normalizeConditionMetrics(forecast.recentConditions).metrics;
    if (SNOW_KEYS.some(key => Number.isFinite(modeled[key]))) {
      for (const key of SNOW_KEYS) selected.metrics[key] = modeled[key];
      selected.snowStatus = 'ready';
      selected.snowSourceKind = 'model';
      selected.snowReportedAt = forecast.recentConditionsAt;
      selected.temperatureKind = 'model';
      selected.temperatureReportedAt = forecast.recentConditionsAt;
      selected.note = `Weather-model estimates at the catalog coordinates. Resort snow report ${selected.primarySnowStatus}; these are not resort measurements.`;
      selected.sources = { ...selected.sources, weatherModel: forecast.apiUrl };
    }
  }
  if (selected.metrics.tempF === null && forecastIsCurrent(forecast, now) && isFresh(forecast.recentConditionsAt, undefined, now) && Number.isFinite(forecast.recentConditions?.tempF)) {
    selected.metrics.tempF = forecast.recentConditions.tempF;
    selected.temperatureKind = 'model';
    selected.temperatureReportedAt = forecast.recentConditionsAt;
    selected.sources = { ...selected.sources, weatherModel: forecast.apiUrl };
  }
  return selected;
}

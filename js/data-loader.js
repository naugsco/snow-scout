import { webcamCatalogState } from './webcams.js?v=20261109-audit';
import { state } from './state.js?v=20261021-sources-verified';
import { resorts } from './resorts.js?v=20261021-sources-verified';
import {
  getSourceKeyForResort, inferStatus, getStatusText,
  conditionPages, webcamPages, webcamStreams, forecastCache, forecastRequests,
  getConditionsPageForResort
} from './utils.js?v=20261106-mountain-weather';
import { DEFAULT_CONDITION_PAGES } from './constants.js?v=20261021-sources-verified';

import { CONDITION_KEYS, isFresh } from './condition-data.js?v=20261021-sources-verified';
import { chooseConditions } from './condition-selection.js?v=20261106-mountain-weather';
import { parseWeather, forecastIsCurrent, forecastMatchesLocation, weatherUrl } from './weather-data.js?v=20261109-powder-alert';

// Initialize conditionPages with defaults
Object.assign(conditionPages, DEFAULT_CONDITION_PAGES);
let conditionSnapshot = null;

export function applyLiveConditions(conditionCatalog, snapshotAt, now = Date.now()) {
  resorts.forEach((resort) => {
    let published = conditionCatalog[getSourceKeyForResort(resort.name)];
    if (published && (published.snowSourceKind === 'model' || published.adapter === 'open-meteo') && !forecastMatchesLocation(resort,{apiUrl:published.sources?.weatherModel || published.sources?.conditions})) {
      published = {...published, snowStatus:'unverified', metrics:{...published.metrics,tempF:null}, note:'Previous model location changed; awaiting a fresh terrain forecast.'};
    }
    const live = chooseConditions(published, snapshotAt, forecastCache.get(getSourceKeyForResort(resort.name)), now);
    const assessment = live;
    // Replacement, never a merge with generated or previously loaded condition values.
    for (const key of CONDITION_KEYS) resort.metrics[key] = assessment.metrics[key];
    resort.liveSnowStatus = assessment.snowStatus;
    resort.liveTerrainStatus = assessment.terrainStatus;
    resort.liveConditionsStatus = assessment.snowStatus === 'ready' || assessment.terrainStatus === 'ready' ? 'ready'
      : assessment.snowStatus === 'stale' ? 'stale' : 'error';
    resort.liveConditionsKind = live?.snowSourceKind || (live?.adapter === 'open-meteo' ? 'model' : 'reported');
    resort.liveTerrainTimestampKind = live?.terrainTimestampKind || 'reported';
    resort.liveTemperatureKind = live?.temperatureKind || resort.liveConditionsKind;
    resort.livePrimarySnowStatus = live?.primarySnowStatus || assessment.snowStatus;
    resort.liveRunsReported = Number.isFinite(resort.metrics.runsOpen);
    resort.liveUpdatedAt = assessment.snowStatus === 'ready' ? live.snowReportedAt : null;
    resort.liveSnowReportedAt = live?.snowReportedAt || null;
    resort.liveTerrainReportedAt = live?.terrainReportedAt || null;
    resort.liveCheckedAt = live?.checkedAt || null;
    resort.liveNote = [...new Set([
      assessment.snowStatus === 'ready' ? live?.note : `Current snow report ${assessment.snowStatus}.`,
      assessment.terrainStatus !== 'ready' ? `Terrain status ${assessment.terrainStatus}.` : null,
      ...assessment.issues
    ].filter(Boolean))].join(' ');
    resort.liveSources = { ...(resort.liveSources || {}), ...(live?.sources || {}) };
    resort.status = inferStatus(resort.metrics);
    resort.statusText = getStatusText(resort.status, resort.metrics);
  });
}

function clearForecast(resort, status = 'error') {
  resort.metrics.forecast72h = null;
  resort.liveForecast = null;
  resort.liveForecastStatus = status;
  resort.status = inferStatus(resort.metrics);
  resort.statusText = getStatusText(resort.status, resort.metrics);
}

export function applyForecastToResortKey(sourceKey, forecast, onDataReady) {
  if (!forecastIsCurrent(forecast)) throw new Error('Forecast is stale or invalid.');
  resorts.forEach((resort) => {
    if (getSourceKeyForResort(resort.name) !== sourceKey) return;
    resort.metrics.forecast72h = forecast.forecast72h;
    resort.liveForecast = forecast;
    resort.liveForecastStatus = 'ready';
    resort.liveSources = {
      ...(resort.liveSources || {}),
      forecastModel: forecast.apiUrl,
      forecastPage: getConditionsPageForResort(resort) || resort.liveSources?.forecastPage || null
    };
    resort.status = inferStatus(resort.metrics);
    resort.statusText = getStatusText(resort.status, resort.metrics);
  });
  if (onDataReady && conditionSnapshot) applyLiveConditions(conditionSnapshot.resorts, conditionSnapshot.generatedAt);
  if (onDataReady) onDataReady();
}

export async function loadLiveForecastForResort(resort, onDataReady) {
  const sourceKey = getSourceKeyForResort(resort.name);
  if (!sourceKey) return null;

  if (forecastIsCurrent(forecastCache.get(sourceKey)) && forecastMatchesLocation(resort,forecastCache.get(sourceKey))) {
    const cached = forecastCache.get(sourceKey);
    applyForecastToResortKey(sourceKey, cached, onDataReady);
    return cached;
  }

  forecastCache.delete(sourceKey);
  if (forecastRequests.has(sourceKey)) {
    return forecastRequests.get(sourceKey);
  }

  clearForecast(resort, 'loading');
  if (onDataReady) onDataReady();

  const apiUrl = weatherUrl(resort);
  const request = fetch(apiUrl, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Forecast request failed (${response.status})`)))
    .then((payload) => {
      const parsed = parseWeather(payload, apiUrl);
      const forecast = { ...parsed.forecast, recentConditions: parsed.conditions, recentConditionsAt: parsed.observedThrough };
      forecastCache.set(sourceKey, forecast);
      applyForecastToResortKey(sourceKey, forecast, onDataReady);
      return forecast;
    })
    .catch((error) => {
      resorts.forEach((item) => {
        if (getSourceKeyForResort(item.name) !== sourceKey) return;
        clearForecast(item);
        forecastCache.delete(sourceKey);
      });
      if (onDataReady) onDataReady();
      throw error;
    })
    .finally(() => {
      forecastRequests.delete(sourceKey);
    });

  forecastRequests.set(sourceKey, request);
  return request;
}

export async function loadOptionalSourceData(onDataReady) {
  const sourceTasks = [
    fetch('./data/resort-forecasts.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Forecast snapshot HTTP ${response.status}`)))
      .then((payload) => {
        if (payload?.schemaVersion !== 2 || !payload.resorts) throw new Error('Forecast snapshot format is outdated or invalid.');
        const fresh = isFresh(payload.generatedAt);
        for (const resort of resorts) {
          const key = getSourceKeyForResort(resort.name);
          const forecast = payload.resorts[key];
          if (fresh && forecastIsCurrent(forecast) && forecastMatchesLocation(resort,forecast)) {
            if (forecastIsCurrent(resort.liveForecast) && Date.parse(resort.liveForecast.updatedAt) > Date.parse(forecast.updatedAt)) continue;
            forecastCache.set(key, forecast);
            applyForecastToResortKey(key, forecast);
          } else if (!forecastIsCurrent(resort.liveForecast)) {
            clearForecast(resort, !fresh || forecast?.status === 'ok' ? 'stale' : 'error');
          }
        }
      })
      .catch((error) => {
        console.error('Forecast data:', error.message);
        for (const resort of resorts) if (!forecastIsCurrent(resort.liveForecast)) clearForecast(resort);
      }),
    fetch('./data/resort-conditions.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Conditions snapshot HTTP ${response.status}`)))
      .then((payload) => {
        if (payload?.schemaVersion !== 2 || !payload.resorts) throw new Error('Conditions snapshot format is outdated or invalid.');
        conditionSnapshot = payload;
        state.conditionsGeneratedAt = payload.generatedAt;
        Object.entries(payload.resorts).forEach(([key, entry]) => {
          if (entry?.adapter !== 'open-meteo' && entry?.sources?.conditions) conditionPages[key] = entry.sources.conditions;
        });
        applyLiveConditions(payload.resorts, payload.generatedAt);
        state.conditionsLoadStatus = isFresh(payload.generatedAt) ? 'ready' : 'stale';
        state.conditionErrorCount = resorts.filter((resort) => resort.liveSnowStatus !== 'ready').length;
      })
      .catch((error) => {
        console.error('Condition data:', error.message);
        conditionSnapshot = null;
        state.conditionsLoadStatus = 'error';
        applyLiveConditions({}, null);
        state.conditionErrorCount = resorts.length;
      }),
    fetch('./data/resort-webcams.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Webcam catalog HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!Array.isArray(payload.resorts)) throw new Error('Invalid webcam catalog');
        webcamStreams.clear();
        Object.keys(webcamPages).forEach(key => delete webcamPages[key]);
        webcamCatalogState.status = 'ready';
        webcamCatalogState.error = null;
        payload.resorts.forEach((entry) => {
          const key = getSourceKeyForResort(entry.sourceKey || entry.resort || '');
          if (!key) throw new Error('Webcam entry has no resort');
          if (entry.webcamPage) webcamPages[key] = entry.webcamPage;
          else delete webcamPages[key];
          webcamStreams.set(key, entry.feeds || []);
        });
      })
      .catch((error) => {
        console.error('Unable to load the audited webcam catalog:', error);
        webcamCatalogState.status = 'error';
        webcamCatalogState.error = error.message;
        webcamStreams.clear();
      })
  ];

  await Promise.all(sourceTasks);
  if (conditionSnapshot) applyLiveConditions(conditionSnapshot.resorts, conditionSnapshot.generatedAt);
  if (onDataReady) onDataReady();
}

// An open browser tab must expire data too, not just a freshly loaded page.
export function expireStaleWeather(onDataReady, now = Date.now()) {
  let changed = false;
  if (conditionSnapshot) {
    const previous = JSON.stringify(resorts.map(r => [r.metrics, r.liveSnowStatus, r.liveTerrainStatus, r.liveConditionsKind]));
    applyLiveConditions(conditionSnapshot.resorts, conditionSnapshot.generatedAt, now);
    changed = previous !== JSON.stringify(resorts.map(r => [r.metrics, r.liveSnowStatus, r.liveTerrainStatus, r.liveConditionsKind]));
    state.conditionsLoadStatus = isFresh(conditionSnapshot.generatedAt, undefined, now) ? 'ready' : 'stale';
    state.conditionErrorCount = resorts.filter((resort) => resort.liveSnowStatus !== 'ready').length;
  }
  for (const resort of resorts) {
    if (resort.liveForecastStatus === 'ready' && !forecastIsCurrent(resort.liveForecast, now)) {
      clearForecast(resort, 'stale');
      forecastCache.delete(getSourceKeyForResort(resort.name));
      changed = true;
    }
  }
  if (changed && onDataReady) onDataReady();
}

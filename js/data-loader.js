import { state } from './state.js?v=20261021-sources-verified';
import { resorts } from './resorts.js?v=20261021-sources-verified';
import {
  getSourceKeyForResort, inferStatus, getStatusText, buildForecastUrl,
  conditionPages, webcamPages, webcamStreams, forecastCache, forecastRequests,
  getConditionsPageForResort
} from './utils.js?v=20261021-sources-verified';
import { DEFAULT_CONDITION_PAGES } from './constants.js?v=20261021-sources-verified';

import { CONDITION_KEYS, isFresh } from './condition-data.js?v=20261021-sources-verified';
import { chooseConditions } from './condition-selection.js?v=20261021-sources-verified';
import { parseWeather, forecastIsCurrent } from './weather-data.js?v=20261021-sources-verified';

// Initialize conditionPages with defaults
Object.assign(conditionPages, DEFAULT_CONDITION_PAGES);
let conditionSnapshot = null;

export function applyLiveConditions(conditionCatalog, snapshotAt, now = Date.now()) {
  resorts.forEach((resort) => {
    const published = conditionCatalog[getSourceKeyForResort(resort.name)];
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

  if (forecastIsCurrent(forecastCache.get(sourceKey))) {
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

  const apiUrl = buildForecastUrl(resort);
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
          if (fresh && forecastIsCurrent(forecast)) {
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
    fetch('./ski-webcams/webcam_pages.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((catalog) => {
        if (!catalog) return;
        Object.entries(catalog).forEach(([key, value]) => {
          if (!value?.webcamPage) return;
          const resolvedKeys = new Set([
            key,
            getSourceKeyForResort(key),
            getSourceKeyForResort(value.resort || key)
          ]);
          resolvedKeys.forEach((resolvedKey) => {
            if (resolvedKey) webcamPages[resolvedKey] = value.webcamPage;
          });
        });
      })
      .catch(() => null),
    fetch('./ski-webcams/webcam_streams_complete.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload) return;
        [...(payload.epic || []), ...(payload.ikon || [])].forEach((entry) => {
          const key = getSourceKeyForResort(entry.sourceKey || entry.resort || '');
          if (!key) return;
          if (entry.webcamPage && !/page-data\.json|opensnow\.com\/location\/.+\/snow-summary/i.test(entry.webcamPage)) {
            webcamPages[key] = entry.webcamPage;
          }
          const feeds = (entry.feeds || [])
            .filter((feed) => feed?.url && !/google|doubleclick|analytics|bat\.bing|pages\d+\.net|pixel|_Incapsula_Resource|page-data\.json|getskitickets|snapchat|liveperson|pbbl\.co|t\.co\/i\/adsct|opensnow\.com\/location\/.+\/snow-summary|webcam-offline|flashtalking|everesttech/i.test(feed.url))
            .map((feed) => ({
              title: feed.title || 'Live camera',
              kind: feed.kind || 'page',
              url: feed.url
            }));
          if (feeds.length) {
            webcamStreams.set(key, feeds);
          } else if (entry.streamUrls?.length) {
            webcamStreams.set(key, entry.streamUrls.filter(Boolean).map((url, index) => ({
              title: `Live camera ${index + 1}`,
              kind: 'image',
              url
            })));
          }
        });
      })
      .catch(() => null)
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

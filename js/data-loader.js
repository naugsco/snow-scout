import { state } from './state.js';
import { resorts } from './resorts.js';
import {
  getSourceKeyForResort, inferStatus, getStatusText, buildForecastUrl, formatInches,
  conditionPages, webcamPages, webcamStreams, forecastCache, forecastRequests,
  getConditionsPageForResort
} from './utils.js';
import { DEFAULT_CONDITION_PAGES } from './constants.js';

// Initialize conditionPages with defaults
Object.assign(conditionPages, DEFAULT_CONDITION_PAGES);

export function applyLiveConditions(conditionCatalog) {
  resorts.forEach((resort) => {
    const live = conditionCatalog[getSourceKeyForResort(resort.name)];
    if (!live || live.status !== 'ok' || !live.metrics) return;

    const nextMetrics = { ...resort.metrics };
    Object.entries(live.metrics).forEach(([metricKey, value]) => {
      if (value === undefined) return;
      if (value === null) {
        nextMetrics[metricKey] = null;
        return;
      }
      if (Number.isNaN(Number(value))) return;
      nextMetrics[metricKey] = Number(value);
    });

    resort.metrics = nextMetrics;
    resort.status = inferStatus(nextMetrics);
    resort.statusText = getStatusText(resort.status, nextMetrics);
    resort.liveNote = live.note || resort.liveNote || null;
    resort.liveUpdatedAt = live.updatedAt || resort.liveUpdatedAt || null;
    resort.liveConditionsStatus = 'ready';
    resort.liveSources = {
      ...(resort.liveSources || {}),
      ...(live.sources || {})
    };
  });
}

export function applyForecastToResortKey(sourceKey, forecast, onDataReady) {
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
  if (onDataReady) onDataReady();
}

export async function loadLiveForecastForResort(resort, onDataReady) {
  const sourceKey = getSourceKeyForResort(resort.name);
  if (!sourceKey) return null;

  if (forecastCache.has(sourceKey)) {
    const cached = forecastCache.get(sourceKey);
    applyForecastToResortKey(sourceKey, cached, onDataReady);
    return cached;
  }

  if (forecastRequests.has(sourceKey)) {
    return forecastRequests.get(sourceKey);
  }

  resort.liveForecastStatus = 'loading';
  if (onDataReady) onDataReady();

  const apiUrl = buildForecastUrl(resort);
  const request = fetch(apiUrl, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Forecast request failed (${response.status})`)))
    .then((payload) => {
      const dailySnowfall = Array.isArray(payload?.daily?.snowfall_sum)
        ? payload.daily.snowfall_sum.slice(0, 7).map((value) => Math.round(((Number(value) || 0) / 2.54) * 10) / 10)
        : [];
      const forecast = {
        apiUrl,
        forecast72h: Math.round(dailySnowfall.slice(0, 3).reduce((sum, value) => sum + value, 0) * 10) / 10,
        dailySnowfall,
        dailyTime: Array.isArray(payload?.daily?.time) ? payload.daily.time.slice(0, 7) : [],
        tempMax: Array.isArray(payload?.daily?.temperature_2m_max) ? payload.daily.temperature_2m_max.slice(0, 7).map((value) => Number(value) || 0) : [],
        tempMin: Array.isArray(payload?.daily?.temperature_2m_min) ? payload.daily.temperature_2m_min.slice(0, 7).map((value) => Number(value) || 0) : [],
        weatherCodes: Array.isArray(payload?.daily?.weathercode) ? payload.daily.weathercode.slice(0, 7) : Array.isArray(payload?.daily?.weather_code) ? payload.daily.weather_code.slice(0, 7) : [],
        updatedAt: new Date().toISOString()
      };
      forecastCache.set(sourceKey, forecast);
      applyForecastToResortKey(sourceKey, forecast, onDataReady);
      return forecast;
    })
    .catch((error) => {
      resorts.forEach((item) => {
        if (getSourceKeyForResort(item.name) !== sourceKey) return;
        item.liveForecastStatus = 'error';
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
    fetch('./data/resort-conditions.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload?.resorts) return;
        if (payload.generatedAt) state.conditionsGeneratedAt = payload.generatedAt;
        Object.entries(payload.resorts).forEach(([key, entry]) => {
          if (entry?.sources?.conditions) {
            const resolvedKeys = new Set([
              key,
              getSourceKeyForResort(key),
              getSourceKeyForResort(entry.resort || key)
            ]);
            resolvedKeys.forEach((resolvedKey) => {
              if (resolvedKey) conditionPages[resolvedKey] = entry.sources.conditions;
            });
          }
        });
        applyLiveConditions(payload.resorts);
      })
      .catch(() => null),
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
  if (onDataReady) onDataReady();
}
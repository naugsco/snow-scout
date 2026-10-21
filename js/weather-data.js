import { finiteNumber, isFresh, SNAPSHOT_MAX_AGE_MS } from './condition-data.js?v=20261021-sources-verified';

const HOUR = 3600;
const round = (value) => value === null ? null : Math.round(value * 100) / 100;
const inches = (value) => { const n = finiteNumber(value); return n === null ? null : n / 2.54; };

export function weatherUrl(resort) {
  const params = new URLSearchParams({
    latitude: resort.lat.toFixed(4), longitude: resort.lon.toFixed(4),
    daily: 'snowfall_sum,temperature_2m_max,temperature_2m_min,weather_code',
    hourly: 'snowfall,temperature_2m,snow_depth',
    past_days: '3', forecast_days: '7', temperature_unit: 'fahrenheit',
    timezone: 'auto', timeformat: 'unixtime'
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

function localDate(seconds, offset) {
  return new Date((seconds + offset) * 1000).toISOString().slice(0, 10);
}

export function parseWeather(payload, apiUrl, now = new Date()) {
  if (payload?.hourly_units?.snowfall !== 'cm' || payload?.daily_units?.snowfall_sum !== 'cm'
      || payload?.hourly_units?.temperature_2m !== '°F' || payload?.hourly_units?.snow_depth !== 'm') {
    throw new Error('Weather response has missing or unexpected units.');
  }
  const offset = finiteNumber(payload.utc_offset_seconds, { negative: true });
  if (offset === null) throw new Error('Weather response has no timezone offset.');
  const nowSec = Math.floor(Number(now) / 1000);
  const asOf = Math.floor(nowSec / HOUR) * HOUR;
  const times = payload.hourly?.time;
  if (!Array.isArray(times) || !times.every(Number.isFinite) || new Set(times).size !== times.length) {
    throw new Error('Weather response has invalid hourly timestamps.');
  }
  const indexByTime = new Map(times.map((time, index) => [time, index]));
  const sumHours = (start, hours) => {
    let total = 0;
    for (let h = 1; h <= hours; h++) {
      const amount = inches(payload.hourly.snowfall?.[indexByTime.get(start + h * HOUR)]);
      if (amount === null) return null;
      total += amount;
    }
    return round(total);
  };
  const forecast72h = sumHours(asOf, 72);
  if (forecast72h === null) throw new Error('Weather response is missing part of the next 72 hours.');
  const date = localDate(nowSec, offset);
  const dailyTimes = payload.daily?.time;
  if (!Array.isArray(dailyTimes) || !dailyTimes.every(Number.isFinite)) throw new Error('Weather response has no dated daily forecast.');
  const today = dailyTimes.findIndex((time) => localDate(time, offset) === date);
  if (today < 0) throw new Error('Weather response does not cover today at the resort.');
  const dailyTime = dailyTimes.slice(today, today + 7).map((time) => localDate(time, offset));
  if (dailyTime.length < 3 || dailyTime.some((day, index) => day !== new Date(Date.parse(`${date}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10))) {
    throw new Error('Weather response has gaps in its daily forecast.');
  }
  const dailySnowfall = dailyTime.map((_, i) => round(inches(payload.daily.snowfall_sum?.[today + i])));
  const forecast = {
    status: 'ok', apiUrl, forecast72h, dailySnowfall, dailyTime,
    tempMax: dailyTime.map((_, i) => finiteNumber(payload.daily.temperature_2m_max?.[today + i], { negative: true })),
    tempMin: dailyTime.map((_, i) => finiteNumber(payload.daily.temperature_2m_min?.[today + i], { negative: true })),
    weatherCodes: dailyTime.map((_, i) => finiteNumber(payload.daily.weather_code?.[today + i])),
    timezone: payload.timezone, utcOffsetSeconds: offset, updatedAt: now.toISOString(),
    periodStart: new Date(asOf * 1000).toISOString(), periodEnd: new Date((asOf + 72 * HOUR) * 1000).toISOString()
  };
  const snow24h = sumHours(asOf - 24 * HOUR, 24);
  const snow48h = sumHours(asOf - 48 * HOUR, 48);
  const snow72h = sumHours(asOf - 72 * HOUR, 72);
  const idx = indexByTime.get(asOf);
  const depth = finiteNumber(payload.hourly.snow_depth?.[idx]);
  return { forecast, conditions: {
    snow24h, snow48h, snow72h,
    daysSinceSnow: snow24h > 0 ? 0 : snow24h === 0 && snow48h > 0 ? 1 : snow48h === 0 && snow72h > 0 ? 2 : null,
    tempF: finiteNumber(payload.hourly.temperature_2m?.[idx], { negative: true }),
    baseDepth: depth === null ? null : round(depth / 0.0254)
  }, observedThrough: new Date(asOf * 1000).toISOString() };
}

export function forecastIsCurrent(forecast, now = Date.now()) {
  if (!isFresh(forecast?.updatedAt, SNAPSHOT_MAX_AGE_MS, now) || forecast?.status !== 'ok'
      || finiteNumber(forecast.forecast72h) === null || !Number.isFinite(forecast.utcOffsetSeconds)) return false;
  const today = localDate(Math.floor(Number(now) / 1000), forecast.utcOffsetSeconds);
  return forecast.dailyTime?.[0] === today
    && Array.isArray(forecast.dailySnowfall) && forecast.dailySnowfall.length >= 3
    && Number.isFinite(Date.parse(forecast.periodEnd)) && Date.parse(forecast.periodEnd) > Number(now);
}

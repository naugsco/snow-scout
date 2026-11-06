// Open-Meteo current snowfall is a modeled accumulation over its current interval,
// not a snow-stake observation or the day's total. Values are centimeters.
const MAX_AGE = 30 * 60 * 1000;
const REFRESH_AFTER = 10 * 60 * 1000;
const requests = new WeakMap();

function fresh(timestamp, now) {
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -5 * 60000 && age <= MAX_AGE;
}

export function currentSnowStatus(reading, now = Date.now()) {
  if (!reading || !fresh(reading.validAt, now) || !fresh(reading.checkedAt, now)
      || !Number.isFinite(reading.snowfallCm) || reading.snowfallCm < 0
      || !Number.isFinite(reading.intervalSeconds) || reading.intervalSeconds <= 0 || reading.intervalSeconds > 3600) return 'unavailable';
  return reading.snowfallCm > 0 ? 'snowing' : 'dry';
}

export function parseCurrentSnow(payload, now = Date.now()) {
  const current = payload?.current;
  if (payload?.current_units?.snowfall !== 'cm' || payload?.current_units?.time !== 'unixtime'
      || !Number.isFinite(current?.time)) throw new Error('Current snowfall response has invalid units or timestamp.');
  const reading = {
    snowfallCm: current.snowfall, intervalSeconds: current.interval,
    validAt: new Date(current.time * 1000).toISOString(), checkedAt: new Date(now).toISOString()
  };
  if (currentSnowStatus(reading, now) === 'unavailable') throw new Error('Current snowfall response is stale or incomplete.');
  return reading;
}

export function currentSnowUrl(resorts) {
  const params = new URLSearchParams({
    latitude: resorts.map(r => r.lat.toFixed(4)).join(','),
    longitude: resorts.map(r => r.lon.toFixed(4)).join(','),
    current: 'snowfall', timeformat: 'unixtime', forecast_days: '1'
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export async function loadCurrentSnow(resorts, onUpdate, now = Date.now(), fetchImpl = fetch) {
  const needed = resorts.filter(resort => {
    const request = requests.get(resort);
    return !request || (!request.pending && now - request.checkedAt >= REFRESH_AFTER);
  });
  const tasks = [];
  for (let start = 0; start < needed.length; start += 20) {
    const batch = needed.slice(start, start + 20);
    batch.forEach(resort => requests.set(resort, { pending: true, checkedAt: now }));
    tasks.push((async () => {
      try {
        const response = await fetchImpl(currentSnowUrl(batch), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Current snowfall request failed (HTTP ${response.status}).`);
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : [payload];
        if (rows.length !== batch.length) throw new Error('Current snowfall response has the wrong number of resorts.');
        // Validate the entire batch before assigning readings to their resorts.
        const readings = rows.map(row => parseCurrentSnow(row, now));
        batch.forEach((resort, i) => { resort.currentSnow = readings[i]; });
      } catch (error) {
        batch.forEach(resort => { resort.currentSnow = null; });
        throw error;
      } finally {
        batch.forEach(resort => requests.set(resort, { pending: false, checkedAt: now }));
        onUpdate?.();
      }
    })());
  }
  const results = await Promise.allSettled(tasks);
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join(' '));
}

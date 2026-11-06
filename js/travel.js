// Pure trip-planning logic shared by the UI, server and tests.
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function addDays(date, days) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function validateTrip(trip, today = localDate()) {
  if (!/^[A-Z]{3}$/.test(trip.origin || '')) throw new Error('Choose a three-letter departure airport.');
  if (!/^[A-Z]{3}$/.test(trip.destination || '')) throw new Error('Choose a three-letter arrival airport.');
  if (trip.origin === trip.destination) throw new Error('Departure and arrival airports must be different.');
  if (!validDate(trip.departure) || trip.departure < today) throw new Error('Choose a departure date today or later.');
  if (!validDate(trip.returnDate) || trip.returnDate <= trip.departure) throw new Error('Return must be after departure.');
  if (trip.returnDate > addDays(today, 330)) throw new Error('Choose dates within the next 330 days.');
  if (!Number.isInteger(trip.adults) || trip.adults < 1 || trip.adults > 6) throw new Error('Choose between 1 and 6 adults.');
  if (!['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CHF'].includes(trip.currency)) throw new Error('Choose a supported currency.');
  return trip;
}
export function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function nearbyAirports(resort, airports) {
  // Proximity is an explicit discovery tool, not a claim about winter road access.
  const ranked = airports.map(a => ({ ...a, distance: distanceKm(resort, a) })).sort((a, b) => a.distance - b.distance);
  const hubs = ranked.filter(a => a.size === 'large' && a.distance <= 800).slice(0, 3);
  const regional = ranked.filter(a => a.size === 'medium' && a.distance <= 300).slice(0, 2);
  return [...hubs, ...regional];
}
export function kayakFlightUrl(trip, today) {
  validateTrip(trip, today);
  // Verified consumer search URL; NOT an affiliate URL. KAYAK chooses its display currency.
  return `https://www.kayak.com/flights/${trip.origin}-${trip.destination}/${trip.departure}/${trip.returnDate}/${trip.adults}adults?sort=bestflight_a`;
}
export function directionsUrl(resort, airport, transit = false) {
  const params = new URLSearchParams({ api: '1', origin: `${airport.lat},${airport.lon}`, destination: `${resort.lat},${resort.lon}`, travelmode: transit ? 'transit' : 'driving' });
  return `https://www.google.com/maps/dir/?${params}`;
}
export function lodgingUrl(resort) {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: `hotels near ${resort.name} ski resort ${resort.lat},${resort.lon}` })}`;
}
export function stormContext(resort, now = Date.now()) {
  const forecast = resort.liveForecast;
  const updated = Date.parse(forecast?.updatedAt);
  if (!forecast || !Number.isFinite(updated) || updated > now + 300000 || now - updated > 6 * 3600000) return null;
  const days = (forecast.dailyTime || []).slice(0, 6).map((date, i) => ({ date, snow: forecast.dailySnowfall?.[i] }))
    .filter(d => validDate(d.date) && Number.isFinite(d.snow) && d.snow >= 0 && Date.parse(`${d.date}T23:59:59Z`) >= now - 14 * 3600000);
  const peak = days.reduce((best, day) => !best || day.snow > best.snow ? day : best, null);
  return peak?.snow > 0 ? { ...peak, updatedAt: forecast.updatedAt } : null;
}

// Contract: https://developers.kayak.com/flights-search-api (read 2026-10-21).
// This module is server-only and excluded from the Pages artifact.
import { validateTrip } from '../js/travel.js';

export function kayakSettings(env = process.env) {
  const mode = env.KAYAK_MODE || 'off';
  if (!['off', 'sandbox', 'live'].includes(mode)) throw new Error('KAYAK_MODE must be off, sandbox or live.');
  if (mode === 'off') return { mode };
  if (!env.KAYAK_API_KEY) throw new Error('KAYAK_API_KEY is required when flight search is enabled.');
  const base = new URL(mode === 'sandbox' ? 'https://sandbox-en-us.kayakaffiliates.com' : env.KAYAK_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.port || base.search || base.hash || base.pathname !== '/' ||
      !(base.hostname.endsWith('.kayakaffiliates.com') || base.hostname.endsWith('.kayak.com'))) throw new Error('Use the HTTPS partner API domain assigned by KAYAK.');
  if (mode === 'live' && base.hostname.includes('sandbox')) throw new Error('Sandbox domain cannot be used in live mode.');
  return { mode, base: base.origin, key: env.KAYAK_API_KEY };
}
export function searchBody(trip) {
  validateTrip(trip);
  const leg = (origin, destination, date) => ({ origin: { locationType: 'airports', airports: [origin] }, destination: { locationType: 'airports', airports: [destination] }, date, flex: 'exact' });
  return {
    searchStartParameters: { cabin: 'economy', passengers: Array(trip.adults).fill('ADT'), legs: [leg(trip.origin, trip.destination, trip.departure), leg(trip.destination, trip.origin, trip.returnDate)], filters: { includeSplit: false } },
    resultParameters: { currency: trip.currency, priceMode: 'perPerson', pageNumber: 1, pageSize: 10, sort: { key: 'price', direction: 'asc' } }
  };
}
function bookingUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || /api[_-]?key/i.test(url.href)) throw new Error('Unsafe flight booking link returned.');
  return url.href;
}
export function normalizeResponse(data, mode, now = new Date()) {
  if (!['first-phase','second-phase','complete'].includes(data.status) || !Array.isArray(data.results) ||
      !/^[A-Z]{3}$/.test(data.currency || '') || !['perPerson', 'total'].includes(data.priceMode)) throw new Error('KAYAK returned an unsupported flight response.');
  const offers = [];
  for (const result of data.results) {
    if (!Array.isArray(result.bookingOptions)) throw new Error('KAYAK returned incomplete booking options.');
    for (const option of result.bookingOptions) {
      const price = option.displayPrice?.price;
      if (price === -1) continue; // Documented schedule-only sentinel, never a fare.
      if (option.type !== 'regular' || !Number.isFinite(price) || price <= 0) throw new Error('KAYAK returned an unsupported fare.');
      if (!Array.isArray(result.legs) || result.legs.length !== 2) throw new Error('KAYAK returned an incomplete round trip.');
      const disclosures = [];
      const legs = result.legs.map(ref => {
        const leg = data.legs?.[ref.id];
        if (!leg || !Array.isArray(leg.segments) || !leg.segments.length || !Number.isFinite(leg.duration) || leg.duration <= 0) throw new Error('KAYAK returned incomplete flight timing.');
        const segments = leg.segments.map(ref => data.segments?.[ref.id]);
        if (segments.some(s => !s || !s.origin || !s.destination || !s.departureTime || !s.arrivalTime) || !leg.departureTime || !leg.arrivalTime) throw new Error('KAYAK returned incomplete flight segments.');
        for (const s of segments) if (s.operationalDisplay) disclosures.push(s.operationalDisplay);
        return { origin: segments[0].origin, destination: segments.at(-1).destination, departure: leg.departureTime, arrival: leg.arrivalTime, duration: leg.duration, stops: segments.length - 1 };
      });
      if (option.fees?.nonRefundableDisclosure) disclosures.push(option.fees.nonRefundableDisclosure);
      if (option.segmentFares?.some(s => s.isSelfTransfer)) disclosures.push('Self-transfer: you must manage the connection and baggage.');
      for (const family of option.fareFamilies || []) {
        const scope = family.legIndices?.length ? `Leg ${family.legIndices.map(n => n + 1).join(', ')}` : 'Trip';
        const amenities = (family.amenities || []).filter(a => ['checkedBag','carryOnBag','change','refundable'].includes(a.code)).map(a => a.displayName);
        if (amenities.length) disclosures.push(`${scope} · ${family.displayName}: ${amenities.join('; ')}`);
      }
      offers.push({ price, provider: data.providers?.[option.providerCode]?.displayName || option.providerCode, bookingUrl: bookingUrl(option.bookingUrl), legs, disclosures: [...new Set(disclosures)] });
    }
  }
  return { mode, complete: data.status === 'complete', checkedAt: now.toISOString(), currency: data.currency, priceMode: data.priceMode, offers: offers.sort((a,b) => a.price - b.price) };
}
export async function searchKayak(trip, settings, client, { fetchImpl = fetch, pause = ms => new Promise(r => setTimeout(r, ms)), signal, reserveCall = () => {} } = {}) {
  if (settings.mode === 'off') throw new Error('Live flight pricing is not connected.');
  const initial = searchBody(trip);
  const deadline = Date.now() + 28000;
  let body = initial, cluster, latest;
  for (let attempt = 0; attempt < 8; attempt++) {
    signal?.throwIfAborted();
    const url = new URL('/i/api/affiliate/search/flight/v1/poll', settings.base);
    url.searchParams.set('apiKey', settings.key);
    url.searchParams.set('userTrackId', client.userTrackId);
    if (cluster) url.searchParams.set('cluster', cluster);
    reserveCall();
    let response;
    try {
      response = await fetchImpl(url, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', 'User-Agent': client.userAgent, 'x-original-client-ip': client.ip }, body: JSON.stringify(body), signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now())))]) });
    } catch {
      // Fetch errors can include the full URL, which contains the API key.
      throw new Error('KAYAK did not respond in time. Please retry the search.');
    }
    if (!response.ok) throw new Error(response.status === 429 ? 'KAYAK search limit reached. Please try later.' : `KAYAK search unavailable (HTTP ${response.status}).`);
    try { latest = await response.json(); } catch { throw new Error('KAYAK returned an unreadable response.'); }
    // Validate before retaining a partial result; never silently treat an error as no fares.
    const normalized = normalizeResponse(latest, settings.mode);
    if (normalized.currency !== trip.currency || normalized.priceMode !== 'perPerson') throw new Error('KAYAK returned a different currency or price basis.');
    if (JSON.stringify(normalized).includes(settings.key)) throw new Error('KAYAK returned a credential-bearing response; results withheld.');
    if (latest.status === 'complete' || Date.now() >= deadline || attempt === 7) return normalized;
    if (typeof latest.searchId !== 'string' || typeof latest.cluster !== 'string') throw new Error('KAYAK search cannot be continued.');
    cluster = latest.cluster;
    body = { searchId: latest.searchId, resultParameters: initial.resultParameters };
    await pause(1500);
  }
}

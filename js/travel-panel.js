import './detail-card.js?v=20261107-resort-view';
import { mountTravelGuide } from './travel-guide-panel.js?v=20261106-all-travel-guides';
import { GATEWAYS } from './trip-planning.js?v=20261106-all-travel-guides';
import { TRAVEL_CONFIG } from './travel-config.js?v=20261022-travel';
import { addDays, localDate, nearbyAirports, validateTrip, kayakFlightUrl, stormContext } from './travel.js?v=20261106-all-travel-guides';
import { formatInches, getConditionsPageForResort } from './utils.js?v=20261106-mountain-weather';
import { icon } from './ui-icons.js?v=20261021-sources-verified';

const root = document.getElementById('travel-panel');
const drafts = new Map();
const stayDrafts = new Map();
let catalogPromise;
let currentResort;
let searchController;
let quoteExpiryTimer;
let service = { mode: 'off' };
let serviceError = '';
let revision = 0;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function readPreference(key) {
  try { return localStorage.getItem(key) || ''; }
  catch (error) { console.error('Travel preference could not be read:', error.name); return ''; }
}
function remember(key, value) {
  try { localStorage.setItem(key, value); }
  catch (error) {
    console.error('Travel preference could not be saved:', error.name);
    root.querySelector('.travel-storage').textContent = 'Your browser could not save this preference. It will work for this visit.';
  }
}
async function catalog() {
  if (!catalogPromise) catalogPromise = fetch(new URL('../data/travel-airports.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error(`Airport catalog unavailable (${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data.airports) || !data.airports.length) throw new Error('Airport catalog is empty.');
    return data;
  }).catch(error => { catalogPromise = null; throw error; });
  return catalogPromise;
}
function stopSearch() { searchController?.abort(); searchController = null; clearTimeout(quoteExpiryTimer); revision++; }
function tripFromForm() {
  const form = root.querySelector('form');
  return { origin: form.elements.origin.value.trim().toUpperCase(), destination: form.elements.destination.value.trim().toUpperCase(), departure: form.elements.departure.value, returnDate: form.elements.returnDate.value, adults: Number(form.elements.adults.value), currency: form.elements.currency.value };
}
function external(link, url) {
  if (url) { link.href = url; link.removeAttribute('aria-disabled'); }
  else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
}
function updateContext(resort) {
  const context = root.querySelector('.travel-snow');
  if (!context) return;
  const peak = stormContext(resort);
  context.querySelector('strong').textContent = peak ? `${formatInches(peak.snow)} modeled on ${peak.date}` : 'No fresh snow window verified';
  context.querySelector('p').textContent = peak ? 'Highest daily snowfall in the available forecast. Plan for local arrival time and ground travel; forecasts can change.' : 'Review the resort forecast before choosing dates. Travel dates below are editable starting points.';
  const terrain = root.querySelector('.travel-terrain');
  terrain.textContent = resort.liveTerrainStatus === 'ready' && Number.isFinite(resort.metrics.runsOpen)
    ? `${resort.metrics.runsOpen} runs reported open${resort.metrics.runsOpen === 0 ? ' — check opening plans before booking' : ' — confirm operations before booking'}.`
    : 'Current terrain opening status is unverified. Check the resort before booking.';
  const official = root.querySelector('.travel-official');
  const source = resort.liveSources?.terrain || getConditionsPageForResort(resort);
  official.hidden = !source;
  if (source) official.href = source;
}
function renderOffers(data) {
  const results = root.querySelector('.travel-results');
  results.replaceChildren();
  const heading = document.createElement('p');
  heading.textContent = `${data.mode === 'sandbox' ? 'SANDBOX · Synthetic test fares, not bookable prices. ' : ''}${data.complete ? 'Search complete' : 'Partial results — some providers did not finish'}. Showing offers from up to 10 itineraries. Checked ${new Date(data.checkedAt).toLocaleTimeString()}. Prices can change at checkout.`;
  results.appendChild(heading);
  if (!data.offers.length) {
    const empty = document.createElement('p'); empty.textContent = 'No priced flight options returned for these dates. Try another airport or date.'; results.appendChild(empty);
  }
  for (const offer of data.offers) {
    const card = document.createElement('article'); card.className = 'travel-offer';
    const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: data.currency }).format(offer.price);
    card.innerHTML = `<div class="travel-offer-head"><strong>${escape(money)} <small>${escape(data.currency)} · ${data.priceMode === 'total' ? 'all travelers' : 'per person'} · round trip</small></strong><span>${escape(offer.provider)}</span></div>`;
    for (const [i, leg] of offer.legs.entries()) {
      const line = document.createElement('p');
      line.textContent = `${i ? 'Return' : 'Outbound'}: ${leg.origin} → ${leg.destination} · ${leg.departure.replace('T', ' ')} → ${leg.arrival.replace('T', ' ')} · ${leg.stops === 0 ? 'Nonstop' : `${leg.stops} stop(s)`} · ${Math.floor(leg.duration / 60)}h ${leg.duration % 60}m. Airport-local times.`;
      card.appendChild(line);
    }
    for (const disclosure of [...offer.disclosures, 'Ski baggage is not verified; check airline rules and fees.']) {
      const note = document.createElement('p'); note.className = 'travel-small'; note.textContent = disclosure; card.appendChild(note);
    }
    const book = document.createElement('a'); book.className = 'travel-link'; book.textContent = data.mode === 'sandbox' ? 'Test booking link' : 'View offer on provider';
    book.href = offer.bookingUrl; book.target = '_blank'; book.rel = 'noopener noreferrer sponsored';
    // Quotes expire locally after ten minutes until a provider-specific TTL is approved.
    const expires = Date.parse(data.checkedAt) + 10 * 60000;
    book.addEventListener('click', event => { if (Date.now() >= expires) { event.preventDefault(); root.querySelector('.travel-error').textContent = 'These flight results have expired. Search again for current prices.'; results.replaceChildren(); } });
    card.appendChild(book); results.appendChild(card);
  }
  if (data.mode === 'live' && data.offers.length) {
    const disclosure = document.createElement('p'); disclosure.className = 'travel-small';
    disclosure.textContent = 'Provider booking links may earn Snow Scout a referral commission. Prices are ranked by fare, not commission.';
    results.appendChild(disclosure);
  }
  clearTimeout(quoteExpiryTimer);
  quoteExpiryTimer = setTimeout(() => {
    results.replaceChildren();
    if (results.isConnected) root.querySelector('.travel-error').textContent = 'These flight results have expired. Search again for current prices.';
  }, Math.max(0, Date.parse(data.checkedAt) + 10 * 60000 - Date.now()));
}
export async function renderTravelPanel(resort) {
  if (!resort) { stopSearch(); currentResort = null; root.replaceChildren(); return; }
  if (currentResort?.id === resort.id && root.querySelector('form')) { currentResort = resort; updateContext(resort); return; }
  stopSearch(); currentResort = resort;
  const renderRevision = revision;
  root.innerHTML = '<p role="status">Loading airport choices…</p>';
  let data;
  try { data = await catalog(); }
  catch (error) {
    if (renderRevision !== revision) return;
    root.innerHTML = `<p role="alert">${escape(error.message)}</p><button class="travel-link" type="button">Retry airport lookup</button>`;
    root.querySelector('button').addEventListener('click', () => renderTravelPanel(resort)); return;
  }
  if (renderRevision !== revision) return;
  const nearby = nearbyAirports(resort, data.airports);
  const gateway = GATEWAYS[resort.name];
  const verifiedAirport = data.airports.find(a => a.code === gateway?.code);
  if (verifiedAirport && !nearby.some(a => a.code === verifiedAirport.code)) nearby.unshift({...verifiedAirport, distance: null});
  const draft = drafts.get(resort.id) || { origin: readPreference('snow-scout-airport'), destination: gateway?.code || '', departure: addDays(localDate(), 1), returnDate: addDays(localDate(), 5), adults: 1, currency: readPreference('snow-scout-travel-currency') || 'CAD' };
  const savedOrigin = readPreference('snow-scout-airport');
  if (savedOrigin) draft.origin = savedOrigin;
  root.innerHTML = `
    <div class="travel-intro"><span class="travel-eyebrow">${icon('plane')} FROM FORECAST TO FIRST CHAIR</span><h3>Plan this snow trip</h3><p>Choose your route. Check the snow. Keep the whole journey in view.</p></div>
    <div class="travel-snow"><span>${icon('cloud-snow')}</span><div><strong></strong><p></p></div></div>
    <p class="travel-terrain"></p><a class="travel-official" target="_blank" rel="noopener noreferrer">Check resort operations ↗</a>
    <form class="travel-form" novalidate>
      <div class="travel-fields"><label>Departure airport<input name="origin" aria-label="Trip departure airport" list="travel-airport-list" placeholder="e.g. YVR" maxlength="3" autocomplete="off" value="${escape(draft.origin)}" required></label>
      <label>Arrival airport<input name="destination" aria-label="Trip arrival airport" list="travel-airport-list" placeholder="Choose below or enter code" maxlength="3" autocomplete="off" value="${escape(draft.destination)}" required></label></div>
      <div class="travel-airports"><span>Explore nearby airports</span><div>${nearby.map(a => `<button type="button" data-airport="${a.code}"><strong>${a.code}</strong><span>${escape(a.city || a.name)} · ${a.country}</span><small>${a.code === gateway?.code ? (gateway.verified ? 'Listed access airport' : 'Regional flight-search option') : Math.round(a.distance) + ' km straight-line'}</small></button>`).join('')}</div>
      <p class="travel-small">Geographic suggestions, not verified routes. Mountains, borders and seasonal flights can change the best choice. <a href="https://ourairports.com/data/" target="_blank" rel="noopener noreferrer">OurAirports</a> · updated ${escape(data.retrievedAt.slice(0, 10))}.</p></div>
      <div class="travel-fields"><label>Depart home<input type="date" name="departure" required min="${localDate()}" max="${addDays(localDate(), 329)}" value="${escape(draft.departure)}"></label><label>Return flight<input type="date" name="returnDate" required min="${addDays(localDate(), 1)}" max="${addDays(localDate(), 330)}" value="${escape(draft.returnDate)}"></label>
      <label>Adults<select name="adults">${[1,2,3,4,5,6].map(n => `<option value="${n}" ${n === draft.adults ? 'selected' : ''}>${n} adult${n === 1 ? '' : 's'}</option>`).join('')}</select></label>
      <label class="travel-currency">Quote currency<select name="currency">${['CAD','USD','EUR','GBP','JPY','AUD','NZD','CHF'].map(c => `<option ${c === draft.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
      <p class="travel-small">Economy, round trip. Overnight flights can arrive the next day. Confirm local arrival before arranging accommodation or transfers. For children, use KAYAK’s search controls.</p>
      <p class="travel-error" role="alert"></p><p class="travel-storage" role="status"></p>
      <div class="travel-flight-actions"><button type="submit" class="travel-primary" hidden>Search flight prices</button><a class="travel-kayak travel-link" target="_blank" rel="noopener noreferrer">Search on KAYAK ↗</a></div>
      <p class="travel-service" role="status"></p>
    </form>
    <div class="travel-results" aria-live="polite"></div>
    <div class="travel-guide-root"></div>
    <p class="travel-footnote">Flight, stay and transfer totals are not yet combined. External sites confirm availability and final prices. Your airport preference stays in this browser.</p>`;
  if (!document.getElementById('travel-airport-list')) {
    const list = document.createElement('datalist'); list.id = 'travel-airport-list';
    list.innerHTML = data.airports.map(a => `<option value="${a.code}" label="${escape(`${a.city} · ${a.name} · ${a.country}`)}"></option>`).join('');
    document.body.appendChild(list);
  }
  updateContext(resort);
  const form = root.querySelector('form');
  const searchButton = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.travel-service');
  function checkedTrip() {
    const trip = validateTrip(tripFromForm());
    for (const code of [trip.origin, trip.destination]) if (!data.airports.some(a => a.code === code)) throw new Error(`${code} is not in the passenger-airport catalog. Choose a listed airport.`);
    return trip;
  }
  function update(showErrors = false) {
    stopSearch();
    root.querySelector('.travel-results').replaceChildren();
    searchButton.textContent = service.mode === 'sandbox' ? 'Search sandbox test fares' : 'Search flight prices';
    const trip = tripFromForm(); drafts.set(resort.id, trip);
    let valid = false;
    try { checkedTrip(); valid = true; root.querySelector('.travel-error').textContent = ''; }
    catch (error) { if (showErrors) root.querySelector('.travel-error').textContent = error.message; }
    external(root.querySelector('.travel-kayak'), valid ? kayakFlightUrl(trip) : null);
    const airport = data.airports.find(a => a.code === trip.destination);
    const stay = stayDrafts.get(resort.id) || {};
    stayDrafts.set(resort.id, stay);
    mountTravelGuide(root.querySelector('.travel-guide-root'), { resort, airport, trip, stay });
    root.querySelectorAll('[data-airport]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.airport === trip.destination)));
    searchButton.hidden = service.mode === 'off'; searchButton.disabled = !valid;
    root.querySelector('.travel-currency').hidden = service.mode === 'off';
    status.textContent = serviceError || (service.mode === 'sandbox' ? 'SANDBOX ONLY · Synthetic test prices. Not live or bookable.' : service.mode === 'live' ? 'Search shares your trip, IP address and browser information with KAYAK. Offers open on the provider’s site.' : 'Flight prices are coming soon here. Check current fares on KAYAK in a new tab.');
    if (service.mode !== 'off') status.textContent += ' External KAYAK search uses its own currency setting.';
    else status.textContent += ' Set your preferred currency on KAYAK.';
  }
  form.addEventListener('input', event => {
    if (['origin','destination'].includes(event.target.name)) event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    update();
  });
  form.addEventListener('change', () => {
    update(true);
    const trip = tripFromForm();
    if (data.airports.some(a => a.code === trip.origin)) { remember('snow-scout-airport', trip.origin); document.dispatchEvent(new CustomEvent('travel-airport-change', { detail: trip.origin })); }
    remember('snow-scout-travel-currency', trip.currency);
  });
  root.querySelectorAll('[data-airport]').forEach(button => button.addEventListener('click', () => { form.elements.destination.value = button.dataset.airport; update(true); }));
  root.querySelector('.travel-kayak').addEventListener('click', event => { try { checkedTrip(); } catch (error) { event.preventDefault(); root.querySelector('.travel-error').textContent = error.message; } });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    let trip;
    try { trip = checkedTrip(); } catch (error) { root.querySelector('.travel-error').textContent = error.message; return; }
    if (service.mode === 'off' || !TRAVEL_CONFIG.apiBase) return;
    stopSearch(); const searchRevision = revision;
    searchController = new AbortController();
    root.querySelector('.travel-results').replaceChildren(); root.querySelector('.travel-error').textContent = '';
    searchButton.disabled = true; searchButton.textContent = 'Checking flight options…';
    try {
      const response = await fetch(`${TRAVEL_CONFIG.apiBase}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trip), signal: searchController.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Flight search failed. Please try again.');
      if (searchRevision === revision) renderOffers(result);
    } catch (error) {
      if (error.name !== 'AbortError' && searchRevision === revision) root.querySelector('.travel-error').textContent = error.message;
    } finally {
      if (searchRevision === revision) { searchButton.disabled = false; searchButton.textContent = service.mode === 'sandbox' ? 'Search sandbox test fares' : 'Search flight prices'; }
    }
  });
  update();
  if (TRAVEL_CONFIG.apiBase) {
    try {
      const response = await fetch(`${TRAVEL_CONFIG.apiBase}/status`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Flight service is unavailable. You can still search on KAYAK.');
      const result = await response.json();
      if (!['off','sandbox','live'].includes(result.mode)) throw new Error('Flight service returned an invalid status.');
      service = result; serviceError = '';
    } catch (error) { service = { mode: 'off' }; serviceError = error.message; }
    if (currentResort?.id === resort.id && root.contains(form)) update();
  }
}

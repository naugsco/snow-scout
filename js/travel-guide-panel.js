import { TRAVEL_GUIDES, guideIsCurrent, transferSeasonWarning, stayDates, staySearchUrl, areaMapUrl } from './travel-guides.js?v=20261106-all-travel-guides';
import { directionsUrl } from './travel.js?v=20261106-all-travel-guides';
import { icon } from './ui-icons.js?v=20261021-sources-verified';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const link = (label, url) => `<a class="travel-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;

// Shared by resort details and comparison cards; no remote calls until a user
// follows an external link. Stay edits never reset the flight form.
export function mountTravelGuide(root, { resort, airport, trip, stay = {}, compact = false, onStayChange = () => {} }) {
  const guide = TRAVEL_GUIDES[resort.name];
  const current = guideIsCurrent(guide);
  const matching = guide && airport?.code === guide.airport;
  const areas = guide?.areas || [{ id:'near-resort', name:`Around ${resort.name}`, query:`${resort.name} ski resort ${resort.lat},${resort.lon}`, access:'Check the property address, lift access and local transport.', transfer:'Resort-specific lodging areas have not been reviewed yet.' }];
  if (!areas.some(a => a.id === stay.area)) stay.area = areas[0].id;
  root.classList.add('travel-guide');
  root.innerHTML = `
    <section class="travel-guide-section travel-ground" aria-label="Airport to mountain">
      <h4>${icon('globe')} Airport to mountain</h4>
      <p class="travel-guide-route">${airport ? `${esc(airport.code)} → ${esc(resort.name)}` : 'Choose an arrival airport'}</p>
      ${guide?.airportVerified === false ? `<p class="travel-small">${esc(guide.airport)} is a regional flight-search starting point. It is not a verified airport-to-resort connection.</p>` : ''}
      ${!guide ? '<p>Transfer operators have not been reviewed for this resort. Use the route links to research your journey.</p>' : !matching ? `<p>${airport ? 'No reviewed transfer for this airport.' : 'Select the reviewed gateway to see transfer options.'} Our guide covers ${esc(guide.airport)}.</p>` : !current ? '<p class="travel-guide-warning" role="status">This route guide needs a fresh review. Check the operator directly for current stops, times and baggage rules.</p>' : `<p>${esc(guide.note)}</p><div class="travel-transfer-list">${guide.transfers.map(t => `<article class="travel-transfer"><span class="travel-guide-kicker">${esc(t.kind)}</span><h5>${esc(t.name)}</h5><strong>${esc(t.duration || 'Journey time: check the operator timetable')}</strong><p class="travel-small">${esc(t.season)}</p>${transferSeasonWarning(t, trip) ? `<p class="travel-guide-warning" role="status">${esc(transferSeasonWarning(t, trip))}</p>` : ''}<details><summary>Stops, bags &amp; timing</summary><dl><dt>Pickup</dt><dd>${esc(t.pickup)}</dd><dt>Drop-off</dt><dd>${esc(t.dropoff)}</dd><dt>Ski bags</dt><dd>${esc(t.baggage)}</dd><dt>Before booking</dt><dd>${esc(t.timing)}</dd></dl></details><div class="travel-guide-links">${link('Timetable & booking', t.url)}${t.sourceUrl !== t.url ? link('Source', t.sourceUrl) : ''}</div></article>`).join('')}</div>`}
      ${guide && matching && !current ? guide.transfers.map(t => link(t.name, t.url)).join('') : ''}
      ${matching && current && !guide.transfers.length ? '<p class="travel-small">No scheduled airport transfer is confirmed in this guide. Use the access guide to arrange a car, private pickup or the required public-transport connections.</p>' : ''}
      ${current && guide?.localTransport ? `<article class="travel-local-connection"><span class="travel-guide-kicker">Local connection · separate from the airport</span><h5>${esc(guide.localTransport.name)}</h5><p>${esc(guide.localTransport.note)}</p>${link('Local timetable & details', guide.localTransport.url)}</article>` : ''}
      <div class="travel-guide-links">${airport ? link('Driving route', directionsUrl(resort, airport)) + link('Public transport route', directionsUrl(resort, airport, true)) : ''}${guide ? link('Official access guide', guide.accessUrl) : ''}</div>
      <p class="travel-small">${guide ? `Sources reviewed ${esc(guide.reviewedAt)}. ` : ''}No live seats or transfer prices. Published journey times exclude airport processing and may increase in winter. Confirm both directions with the operator.</p>
    </section>
    <section class="travel-guide-section travel-lodging" aria-label="Places to stay">
      <h4>${icon('mountain')} Places to stay</h4>
      <label class="travel-area-label">Stay area<select class="travel-stay-area">${areas.map(a => `<option value="${esc(a.id)}" ${stay.area === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <p class="travel-stay-access"></p><p class="travel-stay-transfer travel-small"></p>
      <p class="travel-stay-dates travel-small"></p>
      <details class="travel-stay-edit"><summary>Adjust local stay dates</summary><p class="travel-small">Optional. Leave this closed to use your travel dates as a starting point.</p><div class="travel-fields"><label>Check-in at destination<input class="travel-stay-checkin" type="date" value="${esc(stay.customDates ? stay.checkin : trip.departure)}"></label><label>Check-out at destination<input class="travel-stay-checkout" type="date" value="${esc(stay.customDates ? stay.checkout : trip.returnDate)}"></label></div><button type="button" class="travel-link travel-stay-reset">Use travel dates</button></details>
      <p class="travel-stay-error travel-guide-warning" role="alert"></p>
      <div class="travel-guide-links"><a class="travel-stay-search travel-link" target="_blank" rel="noopener noreferrer">Search stays on Booking.com ↗</a><a class="travel-stay-map travel-link" target="_blank" rel="noopener noreferrer">View area map ↗</a>${guide ? link('Official stay options', guide.stayUrl) : ''}</div>
      <p class="travel-small">${guide ? `Area sources reviewed ${esc(guide.reviewedAt)}. ` : ''}No live hotel rates or availability. Check the exact address, total price, cancellation and shuttle hours. These ordinary links currently earn no commission.</p>
    </section>`;
  if (compact) {
    // Keep the comparison scannable; each resort opens its own practical guide.
    for (const section of root.querySelectorAll('.travel-guide-section')) {
      const disclosure = document.createElement('details');
      disclosure.className = 'travel-guide-disclosure';
      const summary = document.createElement('summary');
      summary.appendChild(section.querySelector('h4'));
      const hint = document.createElement('span'); hint.className = 'travel-guide-summary';
      hint.textContent = section.classList.contains('travel-ground')
        ? matching && current ? guide.transfers.length ? `${guide.airport} · ${guide.transfers.length} transfer option${guide.transfers.length === 1 ? '' : 's'}` : `${guide.airport} · ground travel planning` : 'Route research & official links'
        : `${areas.length} area${areas.length === 1 ? '' : 's'} · dates from your trip`;
      summary.appendChild(hint);
      if (section.classList.contains('travel-ground') && matching && current && guide.transfers.some(t => transferSeasonWarning(t, trip))) {
        const warning = document.createElement('span'); warning.className = 'travel-guide-summary travel-guide-warning'; warning.textContent = 'Check transfer season for these dates'; summary.appendChild(warning);
      }
      disclosure.appendChild(summary);
      while (section.firstChild) disclosure.appendChild(section.firstChild);
      section.appendChild(disclosure);
    }
  }
  function updateStay() {
    const area = areas.find(a => a.id === stay.area);
    const hint = root.querySelector('.travel-lodging .travel-guide-summary');
    if (hint) hint.textContent = `${areas.length} area${areas.length === 1 ? '' : 's'} · ${stay.customDates ? 'custom local dates' : 'dates from your trip'}`;
    root.querySelector('.travel-stay-access').textContent = area.access;
    root.querySelector('.travel-stay-transfer').textContent = area.transfer;
    root.querySelector('.travel-stay-map').href = areaMapUrl(area.query);
    const search = root.querySelector('.travel-stay-search');
    const error = root.querySelector('.travel-stay-error');
    const summary = root.querySelector('.travel-stay-dates');
    try {
      const dates = stayDates(trip, stay);
      search.hidden = !guide?.bookingDestination;
      if (guide?.bookingDestination) { search.href = staySearchUrl(guide.bookingDestination, dates); search.removeAttribute('aria-disabled'); }
      else search.removeAttribute('href');
      summary.textContent = `${dates.checkin} → ${dates.checkout} · ${dates.adults} adult${dates.adults === 1 ? '' : 's'}. ${stay.customDates ? 'Your local stay dates.' : 'Provisional: using travel dates. An overnight flight may change check-in.'} ${guide?.bookingDestination ? 'Booking.com starts with 1 room in the wider '+guide.bookingDestination.name+' area; use the area map for your chosen base. Confirm dates and rooms there.' : 'Use the area map and official stay options. Enter these dates and your room requirements on the booking site; they are not passed automatically.'}`;
      error.textContent = '';
    } catch (e) { search.removeAttribute('href'); search.setAttribute('aria-disabled', 'true'); error.textContent = e.message; summary.textContent = 'Set valid travel or local stay dates to search accommodation.'; }
  }
  root.querySelector('.travel-stay-area').onchange = e => { stay.area = e.target.value; updateStay(); onStayChange(stay); };
  for (const field of ['checkin', 'checkout']) root.querySelector(`.travel-stay-${field}`).onchange = e => {
    stay.customDates = true;
    stay.checkin = root.querySelector('.travel-stay-checkin').value;
    stay.checkout = root.querySelector('.travel-stay-checkout').value;
    updateStay(); onStayChange(stay);
  };
  root.querySelector('.travel-stay-reset').onclick = () => {
    stay.customDates = false; delete stay.checkin; delete stay.checkout;
    root.querySelector('.travel-stay-checkin').value = trip.departure;
    root.querySelector('.travel-stay-checkout').value = trip.returnDate;
    updateStay(); onStayChange(stay);
  };
  root.querySelector('.travel-stay-search').onclick = e => { if (!e.currentTarget.hasAttribute('href')) e.preventDefault(); };
  updateStay();
}

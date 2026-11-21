import { normalizeResortName } from './utils.js?v=20261106-mountain-weather';

// Counts outbound KAYAK and lodging clicks. Sends partner, link kind and resort
// slug only: no URL, query, dates, airports or visitor identifiers.
export const CLICK_ENDPOINT = 'https://snow-scout-weather.nick-naugle.workers.dev/api/clicks';

const slug = (name) => normalizeResortName(name).replace(/\s+/g, '-');
const host = (url) => url.hostname.replace(/^www\./, '');
const isHost = (url, domain) => host(url) === domain || host(url).endsWith(`.${domain}`);

function resortFor(anchor, hash) {
  const card = anchor.closest('.trip-card');
  const name = card?.querySelector('h3')?.textContent?.trim();
  if (name) return slug(name);
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('resort');
  return fromHash && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(fromHash) ? fromHash : 'unknown';
}

// Returns {partner, kind, resort} for a countable link, otherwise null.
export function classifyOutbound(anchor, { pageHost, hash = '' }) {
  let url;
  try { url = new URL(anchor.href); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname === pageHost) return null;
  let partner, kind;
  if (isHost(url, 'kayak.com')) {
    partner = 'kayak'; kind = 'flights';
  } else if (isHost(url, 'booking.com')) {
    partner = 'booking'; kind = 'lodging';
  } else if (anchor.closest('.travel-lodging')) {
    partner = /^google\./.test(host(url)) && url.pathname.startsWith('/maps') ? 'google-maps' : 'official';
    kind = 'lodging';
  } else {
    return null;
  }
  return { partner, kind, resort: resortFor(anchor, hash) };
}

export function bindOutboundClicks(doc = document, send = (url, body) => navigator.sendBeacon(url, body)) {
  const handle = (event) => {
    if (event.defaultPrevented) return; // e.g. the trip form blocked an invalid search
    if (event.type === 'auxclick' && event.button !== 1) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const click = classifyOutbound(anchor, { pageHost: location.hostname, hash: location.hash });
    if (click) send(CLICK_ENDPOINT, JSON.stringify(click));
  };
  doc.addEventListener('click', handle);
  doc.addEventListener('auxclick', handle);
}

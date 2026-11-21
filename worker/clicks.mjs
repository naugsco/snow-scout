// Outbound click counter. Stores only aggregate counts per UTC day, partner,
// link kind and resort slug: no IP address, cookie, user agent or visitor id.
// Counts are directional; partner reports remain the record of bookings.

export const PARTNERS = new Set(['kayak', 'booking', 'google-maps', 'official']);
export const KINDS = new Set(['flights', 'lodging']);
const RESORT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DAILY_LIMIT = 20000;
export const MAX_BODY_BYTES = 512;
const MAX_SUMMARY_DAYS = 365;

// Returns a validated click or null. Unknown fields are ignored.
export function parseClick(text) {
  if (typeof text !== 'string' || text.length > MAX_BODY_BYTES) return null;
  let body;
  try { body = JSON.parse(text); } catch { return null; }
  if (!body || typeof body !== 'object') return null;
  const { partner, kind, resort } = body;
  if (!PARTNERS.has(partner) || !KINDS.has(kind)) return null;
  if (typeof resort !== 'string' || resort.length > 60 || !(resort === 'unknown' || RESORT.test(resort))) return null;
  return { partner, kind, resort };
}

export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// Storage logic over a SQL executor with Durable Object semantics:
// exec(query, ...bindings) returns a cursor with toArray().
export function createClickStore(sql, now = Date.now) {
  sql.exec(`CREATE TABLE IF NOT EXISTS clicks (
    day TEXT NOT NULL, partner TEXT NOT NULL, kind TEXT NOT NULL, resort TEXT NOT NULL,
    count INTEGER NOT NULL, PRIMARY KEY (day, partner, kind, resort))`);
  sql.exec('CREATE TABLE IF NOT EXISTS daily_totals (day TEXT PRIMARY KEY, count INTEGER NOT NULL)');
  return {
    record(click) {
      const day = utcDay(now());
      const [row] = sql.exec('SELECT count FROM daily_totals WHERE day = ?', day).toArray();
      if (row && row.count >= DAILY_LIMIT) return false;
      sql.exec(`INSERT INTO daily_totals (day, count) VALUES (?, 1)
        ON CONFLICT(day) DO UPDATE SET count = count + 1`, day);
      sql.exec(`INSERT INTO clicks (day, partner, kind, resort, count) VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(day, partner, kind, resort) DO UPDATE SET count = count + 1`,
      day, click.partner, click.kind, click.resort);
      return true;
    },
    summary(days) {
      if (!Number.isInteger(days) || days < 1 || days > MAX_SUMMARY_DAYS) throw new Error(`days must be 1–${MAX_SUMMARY_DAYS}.`);
      const since = utcDay(now() - (days - 1) * 86400000);
      const rows = sql.exec(`SELECT day, partner, kind, resort, count FROM clicks
        WHERE day >= ? ORDER BY day DESC, count DESC, partner, kind, resort`, since).toArray();
      return { since, days, rows };
    },
  };
}

export class ClickCounter {
  constructor(ctx) {
    this.store = createClickStore(ctx.storage.sql);
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/clicks') {
      const click = parseClick(await request.text());
      if (!click) return new Response('Invalid click.', { status: 400 });
      return new Response(null, { status: this.store.record(click) ? 204 : 429 });
    }
    if (request.method === 'GET' && url.pathname === '/api/clicks/summary') {
      const days = Number(url.searchParams.get('days') || 30);
      try {
        return Response.json(this.store.summary(days), { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
    }
    return new Response('Not found.', { status: 404 });
  }
}

// Constant-time comparison for the stats bearer token.
export function tokenMatches(header, secret) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof header !== 'string') return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

import { createWeatherTileGateway } from './weather-tiles.mjs';
// Local development gateway. Public rollout requires a chosen host and trusted proxy configuration.
import http from 'node:http';
import { readFile, mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { kayakSettings, searchKayak } from './kayak.mjs';
import { validateTrip, addDays } from '../js/travel.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.geojson':'application/geo+json', '.png':'image/png', '.svg':'image/svg+xml' };
export function createTravelServer({ publicDir, settings = { mode: 'off' }, airports = [], search = searchKayak, weather = createWeatherTileGateway() } = {}) {
  const validCodes = new Set(airports.map(a => a.code));
  const sessions = new Map();
  let windowStart = Date.now(), calls = 0;
  function reserveCall() {
    if (Date.now() - windowStart >= 3600000) { windowStart = Date.now(); calls = 0; }
    if (calls >= 180) throw new Error('Flight search hourly budget reached. Please try later.');
    calls++;
  }
  function json(res, status, data) {
    res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(JSON.stringify(data));
  }
  return http.createServer(async (req, res) => {
    // Bind and enforce loopback: this first-build server is not a public proxy.
    const remote = req.socket.remoteAddress;
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)) return json(res, 403, { error:'Local preview only.' });
    const expectedOrigin = `http://127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}`) return json(res, 403, { error:'Unexpected host.' });
    const url = new URL(req.url, expectedOrigin);
    if (url.pathname.startsWith('/api/weather/')) {
      if(req.method!=='GET') return json(res,405,{error:'GET required.'});
      if(url.pathname==='/api/weather/status') return json(res,200,weather.status());
      const match=url.pathname.match(/^\/api\/weather\/tiles\/([a-z_]+)\/(\d{1,2})\/(\d{1,3})\/(\d{1,3})\.png$/);
      if(!match) return json(res,404,{error:'Unknown weather resource.'});
      const result=await weather.tile(match[1],...match.slice(2).map(Number));
      if(result.retry)res.setHeader('Retry-After',String(result.retry));
      if(result.status!==200)return json(res,result.status,{error:result.message});
      res.writeHead(200,{'Content-Type':result.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end(result.bytes);
    }
    if (url.pathname === '/api/travel/status'  && req.method === 'GET') return json(res, 200, { mode: settings.mode });
    if (url.pathname === '/api/travel/search') {
      if (req.method !== 'POST') return json(res, 405, { error:'POST required.' });
      if (req.headers.origin !== expectedOrigin || !req.headers['content-type']?.startsWith('application/json')) return json(res, 403, { error:'Search must originate from this site.' });
      if (settings.mode === 'off') return json(res, 503, { error:'Live flight pricing is not connected.' });
      let trip;
      try {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 4096) { json(res, 413, { error:'Search request too large.' }); return; } }
        trip = JSON.parse(raw);
        // UTC minus one day allows legitimate local dates near the date line.
        validateTrip(trip, addDays(new Date().toISOString().slice(0,10), -1));
        if (![trip.origin, trip.destination].every(code => validCodes.has(code))) throw new Error('Choose airports from the passenger-airport catalog.');
      } catch (error) { return json(res, 400, { error: error instanceof SyntaxError ? 'Invalid search request.' : error.message }); }
      const now = Date.now();
      for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
      const cookie = req.headers.cookie?.match(/(?:^|;\s*)snow_trip=([a-f0-9-]{36})(?:;|$)/)?.[1];
      let session = cookie && sessions.get(cookie);
      if (!session) {
        if (sessions.size >= 1000) return json(res, 429, { error:'Flight service is busy. Try later.' });
        const id = randomUUID(); session = { userTrackId: randomUUID(), count:0, busy:false, expires:now + 3600000 }; sessions.set(id, session);
        res.setHeader('Set-Cookie', `snow_trip=${id}; HttpOnly; SameSite=Strict; Path=/api/travel; Max-Age=3600`);
      }
      if (session.busy || session.count >= 10) return json(res, 429, { error:'Too many searches. Wait before searching again.' });
      session.count++; session.busy = true;
      const abort = new AbortController();
      res.on('close', () => { if (!res.writableEnded) abort.abort(); });
      try {
        const result = await search(trip, settings, { userTrackId:session.userTrackId, userAgent:req.headers['user-agent'] || 'SnowScoutLocalPreview', ip:remote }, { signal:abort.signal, reserveCall });
        json(res, 200, result);
      } catch (error) {
        // Only curated adapter errors reach the UI; never log upstream URLs or bodies.
        json(res, 502, { error: error.message.includes(settings.key) ? 'Flight search failed.' : error.message });
      } finally { session.busy = false; }
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) return json(res, 405, { error:'Method not allowed.' });
    if (url.pathname === '/js/weather-config.js') {
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
      return res.end('export const WEATHER_CONFIG = Object.freeze({apiBase:"/api/weather"});');
    }
    if (url.pathname === '/js/travel-config.js') {
      res.writeHead(200, { 'Content-Type':'text/javascript', 'Cache-Control':'no-store' });
      return res.end('export const TRAVEL_CONFIG = Object.freeze({apiBase:"/api/travel"});');
    }
    try {
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = await realpath(path.join(publicDir, relative));
      if (!file.startsWith(publicDir + path.sep)) return json(res, 404, { error:'Not found.' });
      const buffer = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : buffer);
    } catch { json(res, 404, { error:'Not found.' }); }
  });
}
async function main() {
  const settings = kayakSettings();
  const temp = await mkdtemp(path.join(tmpdir(), 'snow-scout-travel-'));
  execFileSync('python3', [path.join(ROOT, 'scripts/package_site.py'), '--output', path.join(temp, 'site')]);
  const publicDir = await realpath(path.join(temp, 'site'));
  const { airports } = JSON.parse(await readFile(path.join(publicDir, 'data/travel-airports.json'), 'utf8'));
  const server = createTravelServer({ publicDir, settings, airports, weather:createWeatherTileGateway({key:process.env.OPENWEATHER_API_KEY,enabled:process.env.OPENWEATHER_ENABLED==='true'}) });
  server.listen(Number(process.env.TRAVEL_PORT || 4174), '127.0.0.1', () => console.log(`Travel preview: http://127.0.0.1:${server.address().port} · KAYAK mode: ${settings.mode}`));
  server.on('error', error => { console.error('Travel server failed:', error.code); process.exitCode = 1; rm(temp, { recursive:true, force:true }); });
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { server.close(); rm(temp, { recursive:true, force:true }).finally(() => process.exit()); });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error('Travel startup failed:', error.message); process.exitCode = 1; });

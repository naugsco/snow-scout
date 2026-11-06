#!/usr/bin/env node
// Optional public-link audit. No credentials, booking searches, weather calls,
// retries or browser impersonation. HTTP success does not renew reviewedAt.
import { writeFile } from 'node:fs/promises';
import { TRAVEL_GUIDES } from '../js/travel-guides.js';
import { resorts } from '../js/resorts.js';

const output = process.argv[process.argv.indexOf('--output') + 1];
if (!process.argv.includes('--output') || !output || !process.argv.includes('--network')) {
  throw new Error('Usage: node scripts/audit_travel_guides.mjs --network --output <report.json>');
}
const byUrl = new Map();
for (const r of resorts) {
  const g = TRAVEL_GUIDES[r.name];
  if (!g) throw new Error(`Missing guide: ${r.name}`);
  for (const url of [g.accessUrl, g.stayUrl, ...g.transfers.flatMap(t => [t.url, t.sourceUrl]), g.localTransport?.url].filter(Boolean)) {
    if (new URL(url).protocol !== 'https:') throw new Error(`Non-HTTPS source: ${r.name}`);
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(r.name);
  }
}
const queue = [...byUrl.entries()], results = [], hosts = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check() {
  while (queue.length) {
    const [url, names] = queue.shift();
    const host = new URL(url).hostname;
    const previous = hosts.get(host) || Promise.resolve();
    let release;
    hosts.set(host, new Promise(resolve => { release = resolve; }));
    await previous;
    const record = { url, resorts:[...new Set(names)] };
    try {
      const response = await fetch(url, { headers:{'User-Agent':'SnowScoutSourceAudit/1.0 (+https://naugsco.github.io/snow-scout/)'}, signal:AbortSignal.timeout(12000) });
      record.status = response.status; record.finalUrl = response.url;
      record.result = response.ok ? 'reachable' : [401,403,429].includes(response.status) ? 'restricted-needs-manual-check' : 'http-error';
      // No inventory scraping, tracking identifiers or response bodies retained.
      await response.body?.cancel();
    } catch (error) { record.result = 'network-error'; record.error = error.name; }
    results.push(record);
    await pause(600); release();
  }
}
await Promise.all(Array.from({length:6}, check));
const report = { checkedAt:new Date().toISOString(), resorts:resorts.length, note:'Reachability only. A response is not evidence of live inventory, a bookable connection or current seasonal details. Restricted sources need manual review; no bypass or retry was attempted.', sources:results.sort((a,b)=>a.url.localeCompare(b.url)) };
await writeFile(output, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({resorts:resorts.length,sources:results.length,counts:results.reduce((counts,r)=>(counts[r.result]=(counts[r.result]||0)+1,counts),{})}));
console.log(JSON.stringify(results.filter(r=>r.result==='http-error')));

if (results.some(r => ['http-error','network-error'].includes(r.result))) process.exitCode = 1;

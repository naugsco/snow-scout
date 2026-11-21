#!/usr/bin/env node
// Print outbound click counts from the Snow Scout worker.
// Usage: node scripts/click_stats.mjs [days]
// Token: CLICK_STATS_TOKEN env var, or ~/.config/snow-scout/click-stats.env
// (outside the repository so no local static server can expose it).
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUMMARY_URL = 'https://snow-scout-weather.nick-naugle.workers.dev/api/clicks/summary';
export const TOKEN_FILE = path.join(os.homedir(), '.config/snow-scout/click-stats.env');

async function loadToken() {
  if (process.env.CLICK_STATS_TOKEN) return process.env.CLICK_STATS_TOKEN;
  const text = await readFile(TOKEN_FILE, 'utf8');
  const match = text.match(/^CLICK_STATS_TOKEN=(\S+)$/m);
  if (!match) throw new Error(`CLICK_STATS_TOKEN missing from ${TOKEN_FILE}`);
  return match[1];
}

export function summarize(rows) {
  const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n);
  const byPartner = new Map(), byResort = new Map(), byDay = new Map();
  let total = 0;
  for (const row of rows) {
    total += row.count;
    add(byPartner, `${row.kind} · ${row.partner}`, row.count);
    add(byResort, row.resort, row.count);
    add(byDay, row.day, row.count);
  }
  const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  return { total, byPartner: sorted(byPartner), byResort: sorted(byResort), byDay: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
}

async function main() {
  const days = Number(process.argv[2] || 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('days must be an integer from 1 to 365.');
  const response = await fetch(`${SUMMARY_URL}?days=${days}`, { headers: { Authorization: `Bearer ${await loadToken()}` } });
  if (!response.ok) throw new Error(`Summary request failed: HTTP ${response.status} ${await response.text()}`);
  const data = await response.json();
  const { total, byPartner, byResort, byDay } = summarize(data.rows);
  const print = (title, entries, limit = entries.length) => {
    process.stdout.write(`\n${title}\n`);
    if (!entries.length) process.stdout.write('  (none)\n');
    for (const [key, n] of entries.slice(0, limit)) process.stdout.write(`  ${String(n).padStart(6)}  ${key}\n`);
  };
  process.stdout.write(`Outbound clicks since ${data.since} (UTC, ${data.days} days): ${total}\n`);
  print('By link type and partner', byPartner);
  print('Top resorts', byResort, 15);
  print('By day', byDay);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

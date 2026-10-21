import { readFile, writeFile } from 'node:fs/promises';
import { loadAllResorts } from './fetch_resort_conditions.mjs';
import { assessConditions } from '../js/condition-data.js';
import { forecastIsCurrent } from '../js/weather-data.js';

const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const conditions = await read('resort-conditions');
const forecasts = await read('resort-forecasts');
const season = await read('resort-snowfall');
const auditedAt = new Date().toISOString();
const now = Date.parse(auditedAt);
const rows = [...loadAllResorts()].map(([key, resort]) => {
  const entry = conditions.resorts[key];
  const assessment = assessConditions(entry, conditions.generatedAt, now);
  return { key, resort, entry, ...assessment, forecast: forecastIsCurrent(forecasts.resorts[key], now) };
});
const count = (predicate) => rows.filter(predicate).length;
const clean = (value) => String(value ?? '—').replaceAll('|', '/').replace(/\s+/g, ' ');
const sourceLink = (url, label) => url ? `[${label}](${url})` : '—';
const lines = [
  '# Snow Scout data accuracy audit', '',
  `Audit: ${auditedAt}. Conditions collected: ${conditions.generatedAt}. Forecasts collected: ${forecasts.generatedAt}.`, '',
  '## Findings and fixes', '',
  '- Startup code generated example snowfall, forecasts, base depths, temperatures, run totals, open runs, and groomed counts. It now initializes all dynamic values as unknown.',
  '- The loader preserved generated terrain values when an upstream source returned null, and left generated daily snowfall in the popup. Both behaviors are removed.',
  '- The collector estimated open runs from lift ratios or weather, and groomed counts from a percentage. Those estimates and unsourced terrain totals are removed.',
  '- Snow and terrain now have independent source timestamps. A new download cannot renew an old report. Missing dates, stale reports, parser failures and unsupported combined destinations are withheld.',
  '- Resort aliases now match the configured official adapters and the application catalog. Both snapshots account for all 105 destinations.',
  '- The recent-snow popup uses cumulative 24/48/72-hour windows, never invented daily increments. Inconsistent cumulative totals are rejected.',
  '- Forecasts use complete hourly snowfall windows, correct units, and dated resort-local daily bars. Missing values never become zero. Daily bars are calendar-day totals; the 72-hour forecast is a separate rolling total.',
  '- Genuine zero is retained for closed runs, grooming, and snowfall. Trace snowfall is not rounded into a false zero.',
  '', '## Current coverage', '',
  `- ${count(r => r.forecast)}/105 current weather-model forecasts.`,
  `- ${count(r => r.snowStatus === 'ready' && (r.entry.snowSourceKind || (r.entry.adapter === 'open-meteo' ? 'model' : 'reported')) === 'reported')}/105 current resort-reported snow/condition reports.`,
  `- ${count(r => r.snowStatus === 'ready' && r.entry.snowSourceKind === 'model')}/105 explicitly labeled weather-model recent conditions. These are not resort observations.`,
  `- ${count(r => r.terrainStatus === 'ready')}/105 verified, dated terrain reports. Other terrain counts are unavailable.`,
  '', '## Heavenly', '',
  'The old 24/57 open-run count and 18 groomed count were generated examples, not official data. The official terrain page now supplies 0/111 open and 0 groomed. Its separate snow report is dated June 23, 2026 and is withheld as stale; it is not presented as current zero snowfall.',
  '', '## Refresh and display rules', '',
  '- Static condition and forecast snapshots expire after 8 hours. Resort snow and terrain source reports expire after 24 hours; model conditions expire after 8 hours. Unknown source timestamps are not accepted as current.',
  '- The existing GitHub workflow collects hourly, tests the parsers and output contract, then commits both snapshots. The existing deployment workflow runs after that workflow completes. Local changes still need to be published for this to affect the public site.',
  '- Open tabs check expiration every minute and reload snapshots every 15 minutes. A resort forecast can also be fetched on demand. Fetch errors are surfaced without invented replacement values.',
  '- Open terrain counts come from the provider’s current inventory. Seasonal inventories can change; zero or missing inventory totals are unknown, not a fabricated full-mountain total.',
  '- Combined Mtnfeed destinations include every requested mountain. Snow is reported as a single value only when all components agree; the first mountain is never substituted for the whole destination.',
  `- Season totals are separate ERA5 historical-model estimates, collected ${season.generatedAt}. Current-season tiles/previews show the underlying “through” date. They are not live resort snow reports.`,
  '- The “Best snow” score remains an application heuristic, not a measured snow-quality observation; it is unavailable unless all its inputs are known.',
  '', '## Every destination', '',
  'Status is evaluated at the audit time above. Report dates and checked dates remain in data/resort-conditions.json. “Unverified” means no trustworthy full source timestamp was parsed; “stale” means the source report or snapshot exceeded the policy.', '',
  '| Resort | Recent conditions | Snow report time (UTC) | Terrain | Terrain report time (UTC) | Forecast | Sources / remaining issue |',
  '| --- | --- | --- | --- | --- | --- | --- |'
];
for (const row of rows) {
  const e = row.entry;
  const issues = [...(e?.issues || []), e?.error].filter(Boolean).join(' ');
  const links = [sourceLink(e?.sources?.conditions, e?.adapter === 'open-meteo' ? 'Model' : 'Conditions'), sourceLink(e?.sources?.terrain, 'Terrain')].filter(s => s !== '—').join(' · ');
  lines.push(`| ${clean(row.resort.name)} | ${clean(row.snowStatus)}${e?.adapter === 'open-meteo' ? ' (model)' : ''} | ${clean(e?.snowReportedAt)} | ${clean(row.terrainStatus)} | ${clean(e?.terrainReportedAt)} | ${row.forecast ? 'Current model' : 'Unavailable'} | ${links}${issues ? ' · ' + clean(issues) : ''} |`);
}
const output = new URL('../docs/data-accuracy-audit.md', import.meta.url);
await writeFile(output, lines.join('\n') + '\n');
console.log(`Saved ${output.pathname}\n${count(r => r.forecast)} forecasts; ${count(r => r.snowStatus === 'ready')} recent condition sources; ${count(r => r.terrainStatus === 'ready')} terrain reports.`);

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllResorts, collectionEntries } from './fetch_resort_conditions.mjs';
import { chooseConditions } from '../js/condition-selection.js';
import { forecastIsCurrent } from '../js/weather-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const conditions = await read('data/resort-conditions.json');
const forecasts = await read('data/resort-forecasts.json');
const sources = await read('data/resort-condition-sources.json');
const configured = collectionEntries(sources);
const now = Date.now();
const fields = ['snow24h','snow48h','snow72h','baseDepth','tempF','runsOpen','runsTotal','groomedRuns'];
const records = [...loadAllResorts()].map(([key, resort]) => {
  const source = conditions.resorts[key];
  const current = chooseConditions(source, conditions.generatedAt, forecasts.resorts[key], now);
  const official = configured.get(key).adapter !== 'open-meteo';
  return { key, resort: resort.name, adapter: source?.adapter, officialConfigured: official,
    snowStatus: current.snowStatus, snowKind: current.snowSourceKind,
    primarySnowStatus: official ? current.primarySnowStatus : 'not-configured',
    terrainStatus: current.terrainStatus, terrainTimestampKind: source?.terrainTimestampKind || 'reported',
    checkedAt: source?.checkedAt, snowReportedAt: current.snowReportedAt, officialSnowReportedAt: source?.officialSnowReportedAt || source?.snowReportedAt,
    terrainReportedAt: source?.terrainReportedAt,
    forecastStatus: forecastIsCurrent(forecasts.resorts[key], now) ? 'ready' : 'unavailable',
    metrics: current.metrics, missingFields: fields.filter(field => !Number.isFinite(current.metrics[field])),
    sources: source?.sources, issues: [...(source?.issues || []), source?.sourceError, source?.error].filter(Boolean) };
});
const count = predicate => records.filter(predicate).length;
const coverage = { resorts: records.length, officialConfigured: count(r=>r.officialConfigured),
  reportedSnow: count(r=>r.snowStatus==='ready'&&r.snowKind==='reported'), modeledSnow: count(r=>r.snowStatus==='ready'&&r.snowKind==='model'),
  terrain: count(r=>r.terrainStatus==='ready'), forecast: count(r=>r.forecastStatus==='ready'),
  fields: Object.fromEntries(fields.map(field=>[field,count(r=>Number.isFinite(r.metrics[field]))])) };
const byAdapter = {};
for(const record of records) {
  const bucket=byAdapter[record.adapter]||={resorts:0,snowReported:0,snowModeled:0,terrain:0,primaryErrors:0};
  bucket.resorts++;
  if(record.snowStatus==='ready')bucket[record.snowKind==='model'?'snowModeled':'snowReported']++;
  if(record.terrainStatus==='ready')bucket.terrain++;
  if(record.primarySnowStatus==='error')bucket.primaryErrors++;
}
const result={schemaVersion:1,generatedAt:new Date(now).toISOString(),conditionsGeneratedAt:conditions.generatedAt,forecastsGeneratedAt:forecasts.generatedAt,coverage,byAdapter,resorts:Object.fromEntries(records.map(r=>[r.key,r]))};
await fs.writeFile(path.join(root,'data/resort-source-health.json'),JSON.stringify(result,null,2)+'\n');
const clean=v=>String(v??'—').replaceAll('|','/').replace(/\s+/g,' ');
const lines=['# Resort source repair and reliability report','',`Checked ${result.generatedAt}. All counts describe this collection, not a historical uptime guarantee.`,'',
 '## How collection works','',
 'The hourly GitHub workflow fetches one Open-Meteo weather response per destination, then attempts each configured official source. The official collectors read embedded JSON, provider JSON APIs, or a scoped visible winter report. A stale or failed snowfall report can use the same fresh weather response as an explicitly labeled model estimate. Model weather never supplies terrain or grooming counts. Hourly weather uses approximately 2,520 API requests per day for 105 destinations. Historical backfill is capped at 1,200 weighted calls per six-hour run to leave current-weather capacity on the evaluation tier. The browser reloads snapshots every 15 minutes and checks expiration every minute. A 1–3 hour old forecast is still a forecast issued at its recorded time, not a current mountain measurement.','',
 '## Coverage after repair','',
 '| Category | Destinations |','| --- | --- |',
 `| Official report connections configured | ${coverage.officialConfigured}/105 |`,
 `| Current resort-reported recent conditions | ${coverage.reportedSnow}/105 |`,
 `| Explicit model alternatives for recent conditions | ${coverage.modeledSnow}/105 |`,
 `| Current official winter terrain snapshots | ${coverage.terrain}/105 |`,
 `| Current model forecasts | ${coverage.forecast}/105 |`,'',
 '| Field | Available destinations |','| --- | --- |',...fields.map(field=>`| ${field} | ${coverage.fields[field]}/105 |`),'',
 '## Diagnoses and repairs','',
 '- Alta: the full `conditions.dated_at` was ignored in favor of a time-only display label. The collector now resolves the full timestamp in America/Denver and collects the published temperature and operation totals.',
 '- Mtnfeed/Alterra: snow reports and terrain share a response but have different clocks. Terrain now uses the current feed snapshot, not the date of a separate old snowfall report. Big Bear combines all three requested mountains, with completeness and duplicate checks; snow is a point value only when component reports agree.',
 '- Palisades: the static winter configuration returned HTTP 401 while the official website publishes a different summer configuration. The collector now follows the official page’s active configuration and public token rotation. A summer-only feed with no winter inventory is unavailable, rather than zero ski runs.',
 '- Boyne/ReportPal: nine resorts had no official connector. The collector now reads the same structured JSON endpoint used by their official websites. Winter facilities are separated from summer biking and hiking. Explicit inch fields avoid metric-unit mistakes.',
 '- Snowbasin/Sun Valley: broad HTML matches picked unrelated numbers and counted grooming legend/closed-trail icons. The collector now uses the visible winter summaries, combining Bald and Dollar mountains at Sun Valley. Open groomed runs exclude closed trails and legends.',
 '- POWDR: naive report times lacked a timezone, and old snow-report dates suppressed healthy trail data. Full dates now resolve in each verified resort timezone; winter trail status is independently checked. Summer and hidden trail records are excluded.',
 '- A-Basin: the old count pattern ran past the run label and captured the lift count. The repaired count pattern returns the explicit 0/147 run summary. Undated snow is not promoted into a fresh observation.',
 '- Telluride: the old scrape included commented-out report HTML, and the page-render timestamp does not establish when snowfall was measured. The connector uses the live visible trail summary and keeps undated snow as unverified.',
 '- Killington: the old API hostname fails TLS hostname validation. The new official report URL works but currently exposes summer bike/hike counts only. Those counts are not ski runs; the old API is retired in the configuration. TLS verification remains enabled.',
 '- Blue Mountain: a fresh generated feed contained 38 open trail states last changed weeks earlier. Positive skiing access now requires current dated winter evidence; the generated feed clock cannot renew old states. Closed/expected and summer trails are never turned into open ski runs.',
 '- Fourteen Vail-owned small-resort terrain feeds explicitly return IsSuccessful=false. That is an upstream/offseason failure, not a missing JSON parser. Their weather remains available as labeled model estimates; ski operations remain unavailable without another verified source.',
 '- Transient connection resets and HTTP 502/503/504 get one bounded retry. Authentication failures, invalid certificates, and missing schemas are surfaced. No retry fabricates a response or renews an old observation date.','',
 '## Which sources are reliable for which purpose?','',
 '| Source | Suitable use | Material limit |','| --- | --- | --- |',
 '| Official live terrain JSON / current winter tables | Published run counts, closures, open groomed trails | Some sites stop winter feeds in summer; states are checked snapshots, not continuous telemetry. |',
 '| Resort-dated snow reports | Resort measurements at a stated time and reporting point | May stop updating offseason. Some fields/periods are never reported; grouped destinations can have different measurements. |',
 '| Open-Meteo | Consistent global forecasts and labeled recent-weather estimates | Model output at catalog coordinates, not resort observations, grooming, or open terrain. Free endpoint has no uptime guarantee; commercial use needs an appropriate plan. |',
 '| OnTheSnow / Mountain News partner API | A candidate licensed global source for snow and operating data | Paid, API-key access; exact coverage, timestamps, grooming fields and redistribution terms need a quote for this catalog. |',
 '| Skiresort Service International XML | Another candidate global snow/operation feed | Commercial access; some destinations describe slopes in km instead of run counts. Need a field-level coverage check. |',
 '| SnoCountry | Candidate licensed resort conditions feed, particularly North America | A purchased key is needed; international coverage is separately licensed. Public demonstration access is not production coverage. |','',
 'Provider documentation: [Open-Meteo reliability and licensing](https://open-meteo.com/en/pricing), [Mountain News partner API](https://partner.docs.onthesnow.com/), [Skiresort XML interface](https://www.skiresort-service.com/en/content/interface), [SnoCountry developer guide](https://feeds.snocountry.net/legacy-docs.php).','',
 '## Remaining work needed for complete global coverage','',
 'The unconnected destinations still need verified official adapters or a licensed feed. Weather models cannot recover ski operations or grooming. A provider quote should use the complete 105-destination catalog and explicitly ask about grouped resorts, 24/48/72-hour measurements, report timestamps, open runs versus piste km, open groomed runs, seasonal closure status, allowed refresh frequency, and commercial redistribution. No paid service has been purchased or contacted. Neither scrape-based nor licensed feeds can promise every field at every resort at all times; the UI must continue to show the source, time and unavailable state.','',
 'Collection is scheduled hourly; GitHub Actions schedules are best-effort, not a continuous-data service guarantee. The local code is repaired; scheduled collection changes take effect only after these changes are published to the default branch with Actions enabled. The existing Pages deployment is triggered after the data workflow.','',
 '## Every destination','',
 '| Resort | Collector | Resort snow report | Displayed recent conditions | Winter terrain | Remaining gaps / issues |','| --- | --- | --- | --- | --- | --- |',
 ...records.map(r=>`| ${clean(r.resort)} | ${clean(r.adapter)} | ${clean(r.primarySnowStatus)} | ${clean(r.snowStatus)} (${clean(r.snowKind)}) | ${clean(r.terrainStatus)} | ${clean([...r.missingFields,r.issues.join(' ')].filter(Boolean).join('; '))} |`)];
await fs.writeFile(path.join(root,'docs/source-repair-report.md'),lines.join('\n')+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.slice(0,30).join('\n')+'\n');
const failed=count(r=>r.officialConfigured&&r.primarySnowStatus==='error');
if(failed)console.log(`::warning::${failed} official snow report connections failed. See resort-source-health.json; model estimates are labeled and operations are not fabricated.`);
console.log(JSON.stringify(coverage));

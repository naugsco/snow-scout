import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SOURCES_PATH = path.join(DATA_DIR, 'resort-condition-sources.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'resort-conditions.json');
import { RAW_RESORTS, RESORT_SOURCE_ALIASES } from '../js/constants.js';
import { assessConditions, normalizeConditionMetrics } from '../js/condition-data.js';
import { weatherUrl, parseWeather, forecastIsCurrent } from '../js/weather-data.js';
import { chooseConditions } from '../js/condition-selection.js';
import { zonedTimestamp } from './source-time.mjs';
import { parseAltaPayload, parseMtnfeedPayload, parsePowdrPayload, parseReportPalPayload, parseMcTerrain, parseAbasinTerrain, htmlText, visibleHtml } from './resort-parsers.mjs';

const USER_AGENT = 'SnowScoutConditionFetcher/1.0 (+https://local.snowscout)';

function normalizeResortName(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

export function parseSingleDepth(value) {
  if (value === null || value === undefined) return null;
  const numbers = String(value)
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((number) => Number.isFinite(number));
  if (!numbers?.length) return null;
  // A range is not a point observation. Do not manufacture a single depth.
  return numbers.every((number) => number === numbers[0]) ? numbers[0] : null;
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || text === '--') return null;
  return text;
}

function stripHtml(value) {
  const text = cleanText(
    String(value ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#8217;/gi, "'")
      .replace(/&#8220;|&#8221;/gi, '"')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
  );
  return text;
}

function inferDaysSinceSnow({ snow24h = null, snow48h = null, snow72h = null }) {
  if (snow24h > 0) return 0;
  if (snow24h === 0 && snow48h > 0) return 1;
  if (snow48h === 0 && snow72h > 0) return 2;
  return null;
}

export function reportTimestamp(value, timezone) {
  if (!value) return null;
  if (timezone) { const zoned = zonedTimestamp(value, timezone); if (zoned) return zoned; }
  const dotNet = String(value).match(/^\/Date\((\d+)\)\/$/);
  if (dotNet) return new Date(Number(dotNet[1])).toISOString();
  const offsets = { PST: '-0800', PDT: '-0700', MST: '-0700', MDT: '-0600', CST: '-0600', CDT: '-0500', EST: '-0500', EDT: '-0400' };
  let text = String(value).replace(/^Updated\s+/i, '').replace(/ at /i, ' ');
  text = text.replace(/\b(PST|PDT|MST|MDT|CST|CDT|EST|EDT)$/, (zone) => offsets[zone]);
  // A time of day, a date with no timezone, or a page retrieval date is not a report timestamp.
  if (!/\d{4}/.test(text) || !/(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function publicUrl(value) {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (/token|key|secret|auth/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

async function fetchResponse(url, { staticResource = false } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(20000) });
      if ([502, 503, 504].includes(response.status) && attempt === 0) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      if (!response.ok) throw new Error(`Request failed (${response.status}) for ${publicUrl(url)}`);
      if (!staticResource && Number(response.headers.get('age')) > 8 * 3600) throw new Error(`Source returned an expired cached response for ${publicUrl(url)}`);
      return response;
    } catch (error) {
      if (attempt === 0 && ['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(error.cause?.code)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}
async function fetchText(url) { return (await fetchResponse(url)).text(); }
async function fetchJson(url, options) { return (await fetchResponse(url, options)).json(); }

function extractBalancedObject(source, startIndex) {
  if (startIndex < 0) {
    throw new Error('Object start not found');
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return source.slice(startIndex, index + 1);
    }
  }

  throw new Error('Unterminated object literal');
}

function extractJsonAssignment(source, token) {
  const tokenIndex = source.indexOf(token);
  if (tokenIndex === -1) {
    throw new Error(`Assignment token not found: ${token}`);
  }

  const objectStart = source.indexOf('{', tokenIndex);
  const jsonText = extractBalancedObject(source, objectStart);
  return JSON.parse(jsonText);
}

export function summarizeVailTerrain(terrainFeed, html = '') {
  const trailMap = new Map();
  for (const area of terrainFeed?.GroomingAreas || []) {
    for (const trail of area?.Trails || []) {
      if (trail?.Id !== undefined && trail?.Id !== null) trailMap.set(trail.Id, trail);
    }
  }
  const trails = [...trailMap.values()];
  // The summer feed has no trail rows. Read the actual site's summary, never a made-up total.
  const summary = html.match(/<div\s+class="terrain_summary__tab_main"\s+data-terrain-status-id="runs">\s*<div\s+class="terrain_summary__circle"([^>]+)>/i);
  const open = summary?.[1].match(/data-open="(\d+)"/i);
  const total = summary?.[1].match(/data-total="(\d+)"/i);
  const runsTotal = parseNumber(total?.[1]) || (trails.length || null);
  const runsOpen = parseNumber(open?.[1]) ?? (trails.length ? trails.filter((trail) => trail.IsOpen === true).length : null);
  return {
    runsTotal, runsOpen,
    // No open runs means zero open groomed runs; otherwise require actual trail rows.
    groomedRuns: runsOpen === 0 ? 0 : trails.length && trails.every((trail) => typeof trail.IsGroomed === 'boolean')
      ? trails.filter((trail) => trail.IsOpen === true && trail.IsGroomed === true).length : null
  };
}

export function parseVailSnow(html) {
  const snow = extractJsonAssignment(html, 'FR.snowReportData =');
  const snow24h = parseNumber(snow?.TwentyFourHourSnowfall?.Inches);
  const snow48h = parseNumber(snow?.FortyEightHourSnowfall?.Inches);
  return {
    snowReportedAt: reportTimestamp(snow.LastUpdatedText),
    sourceUpdatedText: cleanText(snow.LastUpdatedText),
    metrics: { snow24h, snow48h, snow72h: null, baseDepth: parseNumber(snow?.BaseDepth?.Inches),
      daysSinceSnow: inferDaysSinceSnow({ snow24h, snow48h }) },
    note: cleanText(snow?.OverallSnowConditions)
  };
}

async function parseVail(entry) {
  const results = await Promise.allSettled([fetchText(entry.snowUrl), fetchText(entry.terrainUrl)]);
  const result = { metrics: {}, issues: [], sources: { conditions: entry.snowUrl, terrain: entry.terrainUrl } };
  try {
    if (results[0].status === 'rejected') throw results[0].reason;
    Object.assign(result, parseVailSnow(results[0].value));
  } catch (error) { result.snowStatus = 'error'; result.issues.push(`Snow report: ${error.message}`); }
  try {
    if (results[1].status === 'rejected') throw results[1].reason;
    const html = results[1].value;
    const terrain = extractJsonAssignment(html, 'FR.TerrainStatusFeed =');
    if (terrain.IsSuccessful !== true) throw new Error('Terrain feed did not report success.');
    Object.assign(result.metrics, summarizeVailTerrain(terrain, html));
    result.terrainReportedAt = reportTimestamp(terrain.Date);
  } catch (error) { result.terrainStatus = 'error'; result.issues.push(`Terrain report: ${error.message}`); }
  return result;
}

async function parseAlta(entry) {
  const html = await fetchText(entry.conditionsUrl);
  return { ...parseAltaPayload(extractJsonAssignment(html, 'window.Alta ='), entry.timezone),
    sources: { conditions: entry.conditionsUrl, terrain: entry.terrainUrl || entry.conditionsUrl } };
}

async function parseSnowbasin(entry) {
  const html = await fetchText(entry.reportUrl);
  return { snowStatus: 'unverified', terrainReportedAt: new Date().toISOString(), terrainTimestampKind: 'checked',
    metrics: parseMcTerrain(html),
    note: 'Winter trail summary checked on the official report. Weather timestamps are not used to renew undated snowfall observations.',
    sources: { conditions: entry.reportUrl, terrain: entry.reportUrl } };
}

function extractMtnfeedConfig(html, reportUrl) {
  if (html?.resortPath) {
    return {
      basePath: html.basePath || 'https://v4.mtnfeed.com/',
      resortPath: html.resortPath
    };
  }

  const basePathMatch = html.match(/liftsAndTrailsBuilderBasePath:\s*"([^"]+)"/i);
  const resortPathMatch = html.match(/resortPath:\s*"([^"]+)"/i);

  if (!basePathMatch || !resortPathMatch) {
    throw new Error(`mtnfeed config not found for ${reportUrl}`);
  }

  return {
    basePath: new URL(basePathMatch[1], reportUrl).toString(),
    resortPath: resortPathMatch[1]
  };
}

async function parseMtnfeed(entry) {
  // Published page configuration controls active feed selection and token rotation.
  const config = entry.reportUrl && entry.discoverConfig
    ? extractMtnfeedConfig(await fetchText(entry.reportUrl), entry.reportUrl)
    : entry.resortPath ? extractMtnfeedConfig(entry, entry.reportUrl)
      : extractMtnfeedConfig(await fetchText(entry.reportUrl), entry.reportUrl);
  const configUrl = new URL(`resorts/${config.resortPath}.json`, config.basePath).toString();
  const resortConfig = await fetchJson(configUrl, { staticResource: true });
  const feedUrl = new URL('feed/v3.json', 'https://mtnpowder.com/');
  if (!resortConfig.bearerToken || !resortConfig.resortIds?.length) throw new Error('Published resort feed configuration is incomplete.');
  feedUrl.searchParams.set('bearer_token', resortConfig.bearerToken);
  for (const id of resortConfig.resortIds) feedUrl.searchParams.append('resortId[]', String(id));
  return { ...parseMtnfeedPayload(await fetchJson(feedUrl.toString()), {
      parseTime: reportTimestamp, parseDepth: parseSingleDepth, expectedCount: resortConfig.resortIds.length, winter: !/-summer$/i.test(config.resortPath)
    }), sources: { conditions: entry.reportUrl || null, terrain: entry.reportUrl || null, feed: publicUrl(feedUrl.toString()), configuration: configUrl } };
}

export function summarizePowdrOpenCount(items) {
  if (!items.length) return null;
  return items.filter((item) => String(item?.status || '').toLowerCase() === 'open').length;
}

export function summarizePowdrGroomedCount(trails) {
  if (!trails.length) return null;
  return trails.filter((trail) => {
    const status = String(trail?.status || '').toLowerCase();
    const groom = String(trail?.groom_status || '').toLowerCase();
    return status === 'open' && groom === 'groomed';
  }).length;
}

async function parsePowdr(entry) {
  // A weather endpoint failing must not discard a healthy independent terrain endpoint.
  const snowUrl = `${entry.apiBase}/drupal/snow-reports?sort=date&direction=desc`;
  const trailsUrl = `${entry.apiBase}/drupal/trails`;
  const responses = await Promise.allSettled([fetchJson(snowUrl), fetchJson(trailsUrl)]);
  const snow = responses[0].status === 'fulfilled' ? responses[0].value : [];
  const trails = responses[1].status === 'fulfilled' ? responses[1].value : [];
  if (!snow.length && !trails.length) throw new Error(responses.map(r => r.reason?.message).filter(Boolean).join('; ') || 'No snow or terrain records.');
  const parsed = parsePowdrPayload(snow.length ? snow : [{ unit_of_measurement: 'in', computed: {} }], trails, entry.timezone);
  parsed.issues = responses.filter(r => r.status === 'rejected').map(r => r.reason.message);
  return { ...parsed, sources: { conditions: entry.reportUrl, terrain: entry.terrainUrl || entry.reportUrl, snowReport: snowUrl, trails: trailsUrl } };
}

async function parseKillington(entry) {
  const text = htmlText(await fetchText(entry.reportUrl));
  if (/Open Bike Trails/i.test(text) && !/\d+\s*\/\s*\d+\s*(?:Ski Trails|Winter Trails)/i.test(text)) {
    return { snowStatus: 'unavailable', terrainStatus: 'unavailable', metrics: {},
      note: 'The current official page publishes summer bike/hiking counts, not winter ski-run counts.',
      sources: { conditions: entry.reportUrl, terrain: entry.reportUrl } };
  }
  throw new Error('Winter report schema needs verification on the migrated official website.');
}

async function parseReportPal(entry) {
  return { ...parseReportPalPayload(await fetchJson(entry.feedUrl)), sources: { conditions: entry.reportUrl, terrain: entry.reportUrl, feed: entry.feedUrl } };
}

async function parseTelluride(entry) {
  const text = htmlText(await fetchText(entry.reportUrl));
  const runs = text.match(/Trail Status\s+(\d+)\s*\/\s*(\d+)\s*trails open/i);
  if (!runs) throw new Error('Official report has no trail summary.');
  return { snowStatus: 'unverified', terrainReportedAt: new Date().toISOString(), terrainTimestampKind: 'checked',
    metrics: { runsOpen: parseNumber(runs[1]), runsTotal: parseNumber(runs[2]), groomedRuns: Number(runs[1]) === 0 ? 0 : null },
    note: 'Snow values withheld: the page refresh clock does not establish a snow observation date. Terrain uses the current visible trail summary.',
    sources: { conditions: entry.reportUrl, terrain: entry.reportUrl } };
}

async function parseJacksonHole(entry) {
  const html = await fetchText(entry.reportUrl);

  function extractTotalSmall(label) {
    const pattern = new RegExp(label + '[\\s\\S]{0,200}?class="total-small"[^>]*>\\s*(\\d+(?:\\.\\d+)?)', 'i');
    const match = html.match(pattern);
    return parseNumber(match?.[1]);
  }

  const snow24h = null;
  const snow48h = extractTotalSmall('48 HOURS');
  const baseDepth = extractTotalSmall('SNOW DEPTH');

  return {
    updatedAt: null,
    metrics: {
      snow24h,
      daysSinceSnow: inferDaysSinceSnow({ snow24h, snow48h }),
      baseDepth,
      runsOpen: null,
      runsTotal: null,
      groomedRuns: null
    },
    note: null,
    sources: {
      conditions: entry.reportUrl,
      terrain: entry.reportUrl
    }
  };
}

async function parseAbasin(entry) {
  return { snowStatus: 'unverified', terrainReportedAt: new Date().toISOString(), terrainTimestampKind: 'checked',
    metrics: parseAbasinTerrain(await fetchText(entry.reportUrl)),
    sources: { conditions: entry.reportUrl, terrain: entry.reportUrl } };
}

async function parseRevelstoke(entry) {
  const [conditionsHtml, terrainHtml] = await Promise.all([
    fetchText(entry.conditionsUrl),
    fetchText(entry.terrainUrl)
  ]);

  // Parse conditions page (dl/dt/dd structure)
  const condText = conditionsHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const baseMatch = condText.match(/Base Depth\s+([\d.]+)\s*cm/i);
  const snow24Match = condText.match(/24 hours\s+([\d.]+)\s*cm/i);

  const baseDepthCm = parseNumber(baseMatch?.[1]);
  const snow24hCm = parseNumber(snow24Match?.[1]);

  // Convert cm to inches
  const baseDepth = baseDepthCm !== null ? Math.round(baseDepthCm / 2.54 * 10) / 10 : null;
  const snow24h = snow24hCm !== null ? Math.round(snow24hCm / 2.54 * 10) / 10 : null;

  const runsOpen = null, runsTotal = null, groomedRuns = null, liftsOpen = null;

  return {
    updatedAt: null,
    metrics: {
      snow24h,
      daysSinceSnow: inferDaysSinceSnow({ snow24h }),
      baseDepth,
      runsOpen,
      runsTotal,
      groomedRuns,
      liftsOpen
    },
    note: null,
    sources: {
      conditions: entry.conditionsUrl,
      terrain: entry.terrainUrl
    }
  };
}

async function parseOpenMeteo(entry) {
  const url = weatherUrl(entry);
  const parsed = parseWeather(await fetchJson(url), url);
  return {
    snowReportedAt: parsed.observedThrough,
    metrics: parsed.conditions,
    note: 'Open-Meteo weather-model estimate at the resort coordinates; not a resort observation.',
    sources: { conditions: url, terrain: null }
  };
}

async function parseEntry(entry) {
  switch (entry.adapter) {
    case 'killington': return parseKillington(entry);
    case 'reportpal': return parseReportPal(entry);
    case 'vail':
      return parseVail(entry);
    case 'alta':
      return parseAlta(entry);
    case 'snowbasin':
      return parseSnowbasin(entry);
    case 'mtnfeed':
      return parseMtnfeed(entry);
    case 'powdr':
      return parsePowdr(entry);
    case 'telluride':
      return parseTelluride(entry);
    case 'jacksonhole':
      return parseJacksonHole(entry);
    case 'abasin':
      return parseAbasin(entry);
    case 'revelstoke':
      return parseRevelstoke(entry);
    case 'open-meteo':
      return parseOpenMeteo(entry);
    default:
      throw new Error(`Unsupported adapter: ${entry.adapter}`);
  }
}

async function readSources() {
  const raw = await readFile(SOURCES_PATH, 'utf8');
  return JSON.parse(raw);
}

async function ensureOutputDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export function loadAllResorts() {
  const seen = new Map();
  for (const resort of RAW_RESORTS) {
    const normalized = normalizeResortName(resort.name);
    const key = RESORT_SOURCE_ALIASES.get(normalized) || normalized;
    if (!seen.has(key)) seen.set(key, { ...resort, name: normalized === 'squaw valley alpine meadows' ? 'Palisades Tahoe' : resort.name, key });
  }
  return seen;
}

export function collectionEntries(sources) {
  const sourceMap = new Map(sources.map((entry) => {
    const normalized = normalizeResortName(entry.key || entry.name);
    return [RESORT_SOURCE_ALIASES.get(normalized) || normalized, entry];
  }));
  return new Map([...loadAllResorts()].map(([key, resort]) => [key,
    sourceMap.get(key) || { ...resort, adapter: 'open-meteo' }
  ]));
}

async function collectPrimary(entry) {
  try {
    const parsed = await parseEntry(entry);
    const checkedAt = new Date().toISOString();
    const reportedAt = reportTimestamp(parsed.updatedAt);
    const normalized = normalizeConditionMetrics(parsed.metrics);
    if (normalized.metrics.daysSinceSnow === null) normalized.metrics.daysSinceSnow = inferDaysSinceSnow(normalized.metrics);
    const result = {
      status: 'ok', resort: entry.name, adapter: entry.adapter, checkedAt,
      snowReportedAt: parsed.snowReportedAt || reportedAt,
      terrainReportedAt: parsed.terrainReportedAt || reportedAt,
      terrainTimestampKind: parsed.terrainTimestampKind || 'reported',
      componentReports: parsed.componentReports || undefined,
      sourceUpdatedText: parsed.sourceUpdatedText || parsed.updatedAt || null,
      snowStatus: parsed.snowStatus, terrainStatus: parsed.terrainStatus,
      note: parsed.note || null, metrics: normalized.metrics, sources: parsed.sources,
      issues: [...(parsed.issues || []), ...normalized.issues]
    };
    const assessment = assessConditions(result, checkedAt, Date.now());
    result.metrics = assessment.metrics;
    result.snowStatus = assessment.snowStatus;
    result.terrainStatus = assessment.terrainStatus;
    // Never publish stale/unverified source values as current numeric metrics.
    if (result.snowStatus !== 'ready') result.issues.push(`Snow report ${result.snowStatus}${result.sourceUpdatedText ? ': ' + result.sourceUpdatedText : ': no verified report timestamp'}.`);
    if (result.terrainStatus !== 'ready' && entry.adapter !== 'open-meteo') result.issues.push(`Terrain report ${result.terrainStatus}.`);
    result.issues = [...new Set([...result.issues, ...assessment.issues])];
    result.status = Object.values(result.metrics).some(Number.isFinite) ? 'ok' : 'unavailable';
    return result;
  } catch (error) {
    return { status: 'error', resort: entry.name, adapter: entry.adapter, checkedAt: new Date().toISOString(),
      error: error instanceof Error ? `${error.message}${error.cause?.code ? ' (' + error.cause.code + ')' : ''}` : String(error),
      snowStatus: 'error', terrainStatus: 'error', metrics: normalizeConditionMetrics().metrics,
      sources: { conditions: entry.conditionsUrl || entry.snowUrl || entry.reportUrl || null, terrain: entry.terrainUrl || entry.reportUrl || null }
    };
  }
}

export function applyWeatherFallback(primary, forecast, now = Date.now()) {
  const result = chooseConditions(primary, primary.checkedAt, forecast, now);
  if (result.snowSourceKind === 'model' && primary.error) {
    result.issues.push(`Official source failed: ${primary.error}`);
    result.sourceError = primary.error;
    delete result.error;
  }
  result.status = Object.values(result.metrics).some(Number.isFinite) ? 'ok' : primary.status;
  return result;
}

export async function collectEntry(entry, { modelForecast } = {}) {
  // A configured resort report is still attempted and its result remains visible in provenance.
  const primary = entry.adapter === 'open-meteo' && forecastIsCurrent(modelForecast)
    ? { status: 'unavailable', adapter: entry.adapter, resort: entry.name, checkedAt: new Date().toISOString(), snowStatus: 'unavailable', terrainStatus: 'unavailable', metrics: normalizeConditionMetrics().metrics, sources: {} }
    : await collectPrimary(entry);
  return applyWeatherFallback(primary, modelForecast);
}

async function main() {
  const sources = await readSources();
  const forecasts = JSON.parse(await readFile(path.join(DATA_DIR, 'resort-forecasts.json'), 'utf8'));
  if (forecasts.schemaVersion !== 2) throw new Error('Refresh forecasts before collecting conditions.');
  const results = {};
  // Only canonical application resorts: no duplicate alias destinations or hard-coded parallel catalog.
  for (const [key, entry] of collectionEntries(sources)) {
    const resort = loadAllResorts().get(key);
    process.stdout.write(`Fetching ${resort.name} (${entry.adapter})...\n`);
    results[key] = await collectEntry(entry, { modelForecast: forecasts.resorts[key] });
    if (results[key].status === 'error') process.stderr.write(`  ${resort.name}: ${results[key].error}\n`);

  }
  const summary = {};
  for (const result of Object.values(results)) summary[result.status] = (summary[result.status] || 0) + 1;
  await ensureOutputDir();
  await writeFile(OUTPUT_PATH, JSON.stringify({ schemaVersion: 2, generatedAt: new Date().toISOString(), summary, resorts: results }, null, 2) + '\n');
  process.stdout.write(`Saved ${OUTPUT_PATH}\n${JSON.stringify(summary)}\n`);
  if (!summary.ok) throw new Error('No current resort data could be collected.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}

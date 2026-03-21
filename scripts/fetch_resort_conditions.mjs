import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SOURCES_PATH = path.join(DATA_DIR, 'resort-condition-sources.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'resort-conditions.json');
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function cmToInches(value) {
  const numeric = parseNumber(value);
  if (numeric === null) return null;
  return numeric / 2.54;
}

function parseSnowRange(value) {
  if (value === null || value === undefined) return null;
  const numbers = String(value)
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((number) => Number.isFinite(number));
  if (!numbers?.length) return null;
  return Math.max(...numbers);
}

function averageRange(value) {
  if (value === null || value === undefined) return null;
  const numbers = String(value)
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((number) => Number.isFinite(number));
  if (!numbers?.length) return null;
  const total = numbers.reduce((sum, number) => sum + number, 0);
  return total / numbers.length;
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

function inferDaysSinceSnow({ snow24h = null, snow48h = null, snow72h = null, snow7d = null }) {
  if ((snow24h ?? 0) > 0) return 0;
  if ((snow48h ?? 0) > 0) return 1;
  if ((snow72h ?? 0) > 0) return 2;
  if ((snow7d ?? 0) > 0) return 5;
  return null;
}

function formatOpenMeteoUrl(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: 'snowfall_sum',
    forecast_days: '4',
    timezone: 'auto'
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      'accept-language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      'accept-language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

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

async function fetchForecast72h(entry) {
  if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lon)) {
    return null;
  }

  const url = formatOpenMeteoUrl(entry.lat, entry.lon);
  const payload = await fetchJson(url);
  const amounts = Array.isArray(payload?.daily?.snowfall_sum) ? payload.daily.snowfall_sum : [];

  return {
    value: amounts.slice(0, 3).reduce((sum, amount) => sum + (cmToInches(amount) ?? 0), 0),
    url
  };
}

function summarizeVailTerrain(terrainFeed) {
  const trailMap = new Map();

  for (const area of terrainFeed?.GroomingAreas || []) {
    for (const trail of area?.Trails || []) {
      if (trail?.Id === undefined || trail?.Id === null) continue;
      trailMap.set(trail.Id, trail);
    }
  }

  const trails = [...trailMap.values()];
  return {
    runsTotal: trails.length || null,
    runsOpen: trails.filter((trail) => trail?.IsOpen).length || null,
    groomedRuns: trails.filter((trail) => trail?.IsOpen && trail?.IsGroomed).length || null
  };
}

async function parseVail(entry) {
  const [snowHtml, terrainHtml] = await Promise.all([
    fetchText(entry.snowUrl),
    fetchText(entry.terrainUrl)
  ]);

  const snow = extractJsonAssignment(snowHtml, 'FR.snowReportData =');
  const terrain = extractJsonAssignment(terrainHtml, 'FR.TerrainStatusFeed =');
  const terrainSummary = summarizeVailTerrain(terrain);

  return {
    updatedAt: cleanText(snow.LastUpdatedText),
    metrics: {
      snow24h: parseNumber(snow?.TwentyFourHourSnowfall?.Inches),
      forecast72h: null,
      daysSinceSnow: inferDaysSinceSnow({
        snow24h: parseNumber(snow?.TwentyFourHourSnowfall?.Inches),
        snow48h: parseNumber(snow?.FortyEightHourSnowfall?.Inches),
        snow72h: null,
        snow7d: parseNumber(snow?.SevenDaySnowfall?.Inches)
      }),
      baseDepth: parseNumber(snow?.BaseDepth?.Inches),
      runsOpen: terrainSummary.runsOpen,
      runsTotal: terrainSummary.runsTotal,
      groomedRuns: terrainSummary.groomedRuns
    },
    note: cleanText(snow?.OverallSnowConditions),
    sources: {
      conditions: entry.snowUrl,
      terrain: entry.terrainUrl
    }
  };
}

async function parseAlta(entry) {
  const html = await fetchText(entry.conditionsUrl);
  const payload = extractJsonAssignment(html, 'window.Alta =');
  const forecastDays = Array.isArray(payload?.forecast?.days) ? payload.forecast.days : [];
  const forecast72h = forecastDays
    .slice(0, 3)
    .reduce((sum, day) => sum + (parseSnowRange(day?.expected_snowfall) ?? 0), 0);

  return {
    updatedAt: cleanText(payload?.conditions?.last_updated),
    metrics: {
      snow24h: parseNumber(payload?.conditions?.last24),
      forecast72h,
      daysSinceSnow: (parseNumber(payload?.conditions?.last24) ?? 0) > 0 ? 0 : null,
      baseDepth: parseNumber(payload?.conditions?.base_depth),
      runsOpen: parseNumber(payload?.operations?.runs?.open),
      runsTotal: parseNumber(payload?.operations?.runs?.total),
      groomedRuns: null
    },
    note: cleanText(payload?.conditions?.sky_cover),
    sources: {
      conditions: entry.conditionsUrl,
      terrain: entry.terrainUrl || entry.conditionsUrl
    }
  };
}

async function parseSnowbasin(entry) {
  const html = await fetchText(entry.reportUrl);

  const liftsMatch = html.match(/<span class="mc-lifts__graph-value">(\d+)\s*\/\s*(\d+)<\/span>\s*Lifts Open/i);
  const trailsMatch = html.match(/<span class="mc-lifts__graph-value">(\d+)\s*\/\s*(\d+)<\/span>\s*Trails Open/i);
  const baseMatch = html.match(/<h3 class="mc__heading mc__h3">Base<\/h3>[\s\S]{0,400}?>(\d+(?:\.\d+)?)<?/i);
  const snow24hMatch = html.match(/<h3 class="mc__heading mc__h3">Overnight<\/h3>\s*<p class="mc__num mc__num-lg">(\d+(?:\.\d+)?)&#8221;<\/p>/i)
    || html.match(/<p class="mc__num mc__num-sm">(\d+(?:\.\d+)?)&#8221;<\/p>[\s\S]{0,80}<p class="mc__heading mc__h4">Overnight<\/p>/i);
  const groomedRuns = (html.match(/mc__icon-groomed/g) || []).length || null;

  return {
    updatedAt: null,
    metrics: {
      snow24h: parseNumber(snow24hMatch?.[1]),
      forecast72h: null,
      daysSinceSnow: inferDaysSinceSnow({
        snow24h: parseNumber(snow24hMatch?.[1])
      }),
      baseDepth: parseNumber(baseMatch?.[1]),
      runsOpen: parseNumber(trailsMatch?.[1]),
      runsTotal: parseNumber(trailsMatch?.[2]),
      groomedRuns
    },
    note: cleanText((html.match(/We are currently operating[^<]+/i) || [])[0]),
    sources: {
      conditions: entry.reportUrl,
      terrain: entry.reportUrl
    }
  };
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
  const config = entry.resortPath
    ? extractMtnfeedConfig(entry, entry.reportUrl)
    : extractMtnfeedConfig(await fetchText(entry.reportUrl), entry.reportUrl);
  const resortConfigUrl = new URL(`resorts/${config.resortPath}.json`, config.basePath).toString();
  const resortConfig = await fetchJson(resortConfigUrl);
  const feedUrl = new URL('feed/v3.json', 'https://mtnpowder.com/');

  feedUrl.searchParams.set('bearer_token', resortConfig.bearerToken);
  for (const resortId of resortConfig.resortIds || []) {
    feedUrl.searchParams.append('resortId[]', String(resortId));
  }

  const feed = await fetchJson(feedUrl.toString());
  const resort = Array.isArray(feed?.Resorts) ? feed.Resorts[0] : null;

  if (!resort?.SnowReport) {
    throw new Error(`SnowReport not found for ${entry.name}`);
  }

  return {
    updatedAt: cleanText(resort?.SnowReport?.LastUpdate),
    metrics: {
      snow24h: parseNumber(resort?.SnowReport?.AllMountain?.Last24HoursIn),
      forecast72h:
        (parseSnowRange(resort?.Forecast?.OneDay?.forecasted_snow_in) ?? 0) +
        (parseSnowRange(resort?.Forecast?.TwoDay?.forecasted_snow_in) ?? 0) +
        (parseSnowRange(resort?.Forecast?.ThreeDay?.forecasted_snow_in) ?? 0),
      daysSinceSnow: inferDaysSinceSnow({
        snow24h: parseNumber(resort?.SnowReport?.AllMountain?.Last24HoursIn),
        snow48h: parseNumber(resort?.SnowReport?.AllMountain?.Last48HoursIn),
        snow72h: parseNumber(resort?.SnowReport?.AllMountain?.Last72HoursIn),
        snow7d: parseNumber(resort?.SnowReport?.AllMountain?.Last7DaysIn)
      }),
      baseDepth: averageRange(resort?.SnowReport?.SnowBaseRangeIn),
      runsOpen: parseNumber(resort?.SnowReport?.TotalOpenTrails),
      runsTotal: parseNumber(resort?.SnowReport?.TotalTrails),
      groomedRuns: parseNumber(resort?.SnowReport?.GroomedTrails)
    },
    note: cleanText(resort?.SnowReport?.BaseConditions),
    sources: {
      conditions: entry.reportUrl,
      terrain: entry.reportUrl,
      feed: feedUrl.toString()
    }
  };
}

function summarizePowdrOpenCount(items) {
  return items.filter((item) => ['open', 'expected'].includes(String(item?.status || '').toLowerCase())).length || null;
}

function summarizePowdrGroomedCount(trails) {
  return trails.filter((trail) => {
    const status = String(trail?.status || '').toLowerCase();
    const groom = String(trail?.groom_status || '').toLowerCase();
    return ['open', 'expected'].includes(status) && groom === 'groomed';
  }).length || null;
}

async function parsePowdr(entry) {
  const [snowReports, lifts, trails] = await Promise.all([
    fetchJson(`${entry.apiBase}/drupal/snow-reports?sort=date&direction=desc`),
    fetchJson(`${entry.apiBase}/drupal/lifts`),
    fetchJson(`${entry.apiBase}/drupal/trails`)
  ]);

  const snowReport = Array.isArray(snowReports) ? snowReports[0] : null;
  if (!snowReport) {
    throw new Error(`Snow report not found for ${entry.name}`);
  }

  const trailItems = Array.isArray(trails) ? trails.filter((trail) => trail?.type === 'alpine_trail') : [];
  const liftItems = Array.isArray(lifts) ? lifts.filter((lift) => String(lift?.season || '').toLowerCase() === 'winter') : [];
  const snow24h = parseNumber(snowReport?.computed?.['24_hour']) ?? parseNumber(snowReport?.amount);
  const snow48h = parseNumber(snowReport?.computed?.['48_hour']);
  const snow72h = parseNumber(snowReport?.computed?.['72_hour']);
  const snow7d = parseNumber(snowReport?.computed?.['7_day']);

  return {
    updatedAt: cleanText(snowReport?.date),
    metrics: {
      snow24h,
      forecast72h: null,
      daysSinceSnow: inferDaysSinceSnow({
        snow24h,
        snow48h,
        snow72h,
        snow7d
      }),
      baseDepth: parseNumber(snowReport?.base_depth),
      runsOpen: summarizePowdrOpenCount(trailItems),
      runsTotal: trailItems.length || null,
      groomedRuns: summarizePowdrGroomedCount(trailItems)
    },
    note: stripHtml(snowReport?.report)?.split('\n\n')[0] || null,
    sources: {
      conditions: entry.reportUrl,
      terrain: entry.terrainUrl || entry.reportUrl,
      snowReport: `${entry.apiBase}/drupal/snow-reports?sort=date&direction=desc`,
      lifts: `${entry.apiBase}/drupal/lifts`,
      trails: `${entry.apiBase}/drupal/trails`
    }
  };
}

async function parseEntry(entry) {
  switch (entry.adapter) {
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
    default:
      throw new Error(`Unsupported adapter: ${entry.adapter}`);
  }
}

async function withForecast(entry, result) {
  const forecast = await fetchForecast72h(entry).catch(() => null);

  if (!forecast) return result;

  if (result.metrics.forecast72h === null || result.metrics.forecast72h === undefined) {
    result.metrics.forecast72h = Math.round(forecast.value * 10) / 10;
  }

  result.sources.forecast = forecast.url;
  return result;
}

async function readSources() {
  const raw = await readFile(SOURCES_PATH, 'utf8');
  return JSON.parse(raw);
}

async function ensureOutputDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function main() {
  const sources = await readSources();
  const resortResults = {};

  for (const entry of sources) {
    const key = normalizeResortName(entry.key || entry.name);
    process.stdout.write(`Fetching ${entry.name} (${entry.adapter})...\n`);

    try {
      const parsed = await parseEntry(entry);
      const withLiveForecast = await withForecast(entry, parsed);

      resortResults[key] = {
        status: 'ok',
        resort: entry.name,
        adapter: entry.adapter,
        updatedAt: withLiveForecast.updatedAt,
        note: withLiveForecast.note,
        metrics: {
          snow24h: withLiveForecast.metrics.snow24h,
          forecast72h: withLiveForecast.metrics.forecast72h,
          daysSinceSnow: withLiveForecast.metrics.daysSinceSnow,
          baseDepth: withLiveForecast.metrics.baseDepth === null
            ? null
            : Math.round(withLiveForecast.metrics.baseDepth * 10) / 10,
          runsOpen: withLiveForecast.metrics.runsOpen,
          runsTotal: withLiveForecast.metrics.runsTotal,
          groomedRuns: withLiveForecast.metrics.groomedRuns
        },
        sources: withLiveForecast.sources
      };
    } catch (error) {
      resortResults[key] = {
        status: 'error',
        resort: entry.name,
        adapter: entry.adapter,
        error: error instanceof Error ? error.message : String(error),
        sources: {
          conditions: entry.conditionsUrl || entry.snowUrl || entry.reportUrl || null,
          terrain: entry.terrainUrl || entry.reportUrl || null
        }
      };
      process.stderr.write(`  Failed for ${entry.name}: ${resortResults[key].error}\n`);
    }
  }

  const summary = Object.values(resortResults).reduce((accumulator, entry) => {
    if (entry.status === 'ok') accumulator.ok += 1;
    else accumulator.error += 1;
    return accumulator;
  }, { ok: 0, error: 0 });

  await ensureOutputDir();
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary,
      resorts: resortResults
    }, null, 2)
  );

  process.stdout.write(`Saved ${OUTPUT_PATH}\n`);
  process.stdout.write(`Successful: ${summary.ok}, failed: ${summary.error}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

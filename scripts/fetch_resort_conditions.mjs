import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SOURCES_PATH = path.join(DATA_DIR, 'resort-condition-sources.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'resort-conditions.json');
const USER_AGENT = 'SnowScoutConditionFetcher/1.0 (+https://local.snowscout)';

// Liftie.info slug mappings for resorts that have lift data
const LIFTIE_SLUGS = {
  'crystal mountain': 'crystal-mountain',
  'sunday river': 'sunday-river',
  'sugarloaf': 'sugarloaf',
  'schweitzer': 'schweitzer',
  'windham mountain': 'windham',
  'loon mountain': 'loon',
  'taos': 'taos',
  'brighton resort': 'brighton',
  'solitude': 'solitude',
  'sun peaks': 'sun-peaks',
  'red mountain': 'red-mountain',
  'tremblant': 'tremblant',
  'aspen snowmass': 'aspen-highlands',
  'cypress mountain': 'cypress-mountain',
  'big sky': 'big-sky'
};

// Real terrain totals for resorts without dedicated scrapers
const TERRAIN_TOTALS = {
  'aspen snowmass': { runsTotal: 362, liftsTotal: 47 },
  'arapahoe basin': { runsTotal: 147, liftsTotal: 9 },
  'big sky': { runsTotal: 317, liftsTotal: 40 },
  'brighton resort': { runsTotal: 66, liftsTotal: 7 },
  'solitude': { runsTotal: 82, liftsTotal: 8 },
  'palisades tahoe': { runsTotal: 270, liftsTotal: 42 },
  'squaw valley alpine meadows': { runsTotal: 270, liftsTotal: 42 },
  'tremblant': { runsTotal: 102, liftsTotal: 14 },
  'blue mountain': { runsTotal: 43, liftsTotal: 15 },
  'skibig3': { runsTotal: 334, liftsTotal: 26 },
  'revelstoke': { runsTotal: 69, liftsTotal: 5 },
  'cypress mountain': { runsTotal: 53, liftsTotal: 6 },
  'red mountain': { runsTotal: 119, liftsTotal: 7 },
  'sun peaks': { runsTotal: 138, liftsTotal: 13 },
  'crystal mountain': { runsTotal: 57, liftsTotal: 11 },
  'the summit at snoqualmie': { runsTotal: 140, liftsTotal: 25 },
  'loon mountain': { runsTotal: 61, liftsTotal: 10 },
  'sugarloaf': { runsTotal: 162, liftsTotal: 15 },
  'sunday river': { runsTotal: 135, liftsTotal: 18 },
  'boyne highlands': { runsTotal: 55, liftsTotal: 8 },
  'boyne mountain': { runsTotal: 60, liftsTotal: 10 },
  'taos': { runsTotal: 110, liftsTotal: 14 },
  'windham mountain': { runsTotal: 54, liftsTotal: 11 },
  'schweitzer': { runsTotal: 92, liftsTotal: 10 },
  'sun valley': { runsTotal: 121, liftsTotal: 18 },
  'panorama': { runsTotal: 130, liftsTotal: 10 },
  'perisher': { runsTotal: 119, liftsTotal: 47 },
  'falls creek': { runsTotal: 92, liftsTotal: 14 },
  'hotham': { runsTotal: 80, liftsTotal: 13 },
  'hakuba valley': { runsTotal: 137, liftsTotal: 23 },
  'rusutsu': { runsTotal: 37, liftsTotal: 18 },
  'andermatt sedrun': { runsTotal: 120, liftsTotal: 22 },
  'verbier': { runsTotal: 195, liftsTotal: 35 },
  'crans montana': { runsTotal: 140, liftsTotal: 27 },
  'les 3 vall es': { runsTotal: 328, liftsTotal: 55 },
  'paradiski': { runsTotal: 264, liftsTotal: 70 },
  'tignes': { runsTotal: 154, liftsTotal: 38 },
  'val d is re': { runsTotal: 78, liftsTotal: 38 },
  'chamonix': { runsTotal: 119, liftsTotal: 49 },
  'zermatt': { runsTotal: 145, liftsTotal: 52 },
  'st moritz': { runsTotal: 88, liftsTotal: 24 },
  'kitzb hel': { runsTotal: 170, liftsTotal: 54 },
  'lech z rs am arlberg': { runsTotal: 131, liftsTotal: 35 },
  'dolomiti superski': { runsTotal: 450, liftsTotal: 175 },
  'thredbo': { runsTotal: 50, liftsTotal: 14 },
  'niseko united': { runsTotal: 81, liftsTotal: 30 },
  'lotte arai': { runsTotal: 24, liftsTotal: 5 },
  'valle nevado': { runsTotal: 46, liftsTotal: 15 }
};

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

function formatOpenMeteoFullUrl(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: 'snowfall_sum,temperature_2m_max,temperature_2m_min,snow_depth_max',
    hourly: 'temperature_2m',
    past_days: '7',
    forecast_days: '4',
    temperature_unit: 'fahrenheit',
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

async function fetchLiftieData(resortKey) {
  const slug = LIFTIE_SLUGS[resortKey];
  if (!slug) return null;

  try {
    const data = await fetchJson(`https://liftie.info/api/resort/${slug}`);
    const stats = data?.lifts?.stats || {};
    const liftStatus = data?.lifts?.status || {};

    let liftsOpen = 0;
    let liftsTotal = 0;

    if (typeof stats.open === 'number') {
      liftsOpen = stats.open;
      liftsTotal = stats.open + (stats.closed || 0) + (stats.hold || 0);
    } else if (typeof stats.open === 'object') {
      liftsOpen = stats.open?.count || 0;
      liftsTotal = liftsOpen + (stats.closed?.count || 0) + (stats.hold?.count || 0);
    } else {
      // Count from individual lift statuses
      for (const status of Object.values(liftStatus)) {
        liftsTotal += 1;
        if (status === 'open') liftsOpen += 1;
      }
    }

    return { liftsOpen, liftsTotal: liftsTotal || null };
  } catch {
    return null;
  }
}

function enrichWithTerrain(result, resortKey, liftieData) {
  const terrain = TERRAIN_TOTALS[resortKey];
  if (!terrain) return result;

  result.metrics.runsTotal = terrain.runsTotal;

  if (liftieData && liftieData.liftsTotal > 0) {
    // Use lift open ratio to estimate runs open
    const liftRatio = liftieData.liftsOpen / liftieData.liftsTotal;
    // Runs open typically tracks slightly below lift ratio
    const runsRatio = Math.max(0, liftRatio * 0.9);
    result.metrics.runsOpen = Math.round(terrain.runsTotal * runsRatio);
    result.metrics.groomedRuns = Math.round(result.metrics.runsOpen * 0.45);
    result.metrics.liftsOpen = liftieData.liftsOpen;
    result.metrics.liftsTotal = liftieData.liftsTotal;
    result.sources.liftie = `https://liftie.info/api/resort/${LIFTIE_SLUGS[resortKey]}`;
  } else {
    // No live lift data — estimate from season and weather
    // If there's recent snow, assume more terrain is open
    const snow24h = result.metrics.snow24h || 0;
    const baseRatio = 0.65; // mid-season default
    const snowBonus = Math.min(snow24h * 0.02, 0.15);
    const ratio = Math.min(baseRatio + snowBonus, 0.95);
    result.metrics.runsOpen = Math.round(terrain.runsTotal * ratio);
    result.metrics.groomedRuns = Math.round(result.metrics.runsOpen * 0.4);
  }

  return result;
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

async function parseTelluride(entry) {
  const html = await fetchText(entry.reportUrl);

  const snow24hMatch = html.match(/Last 24 hours[\s\S]{0,200}?<strong>(\d+(?:\.\d+)?)["″]/i)
    || html.match(/24 hours[\s\S]{0,100}?(\d+(?:\.\d+)?)["″]/i);
  const snow48hMatch = html.match(/Last 48 hours[\s\S]{0,200}?<strong>(\d+(?:\.\d+)?)["″]/i)
    || html.match(/48 hours[\s\S]{0,100}?(\d+(?:\.\d+)?)["″]/i);
  const baseMatch = html.match(/Snow depth[\s\S]{0,80}?<strong>(\d+(?:\.\d+)?)["″]/i);
  const trailMatch = html.match(/Trail Status[\s\S]{0,500}?Open[\s\S]{0,100}?<strong>(\d+)\s*\/\s*(\d+)/i);
  const groomedMatch = html.match(/Groomed[\s\S]{0,100}?<strong>(\d+)\s*\/\s*(\d+)/i);

  const snow24h = parseNumber(snow24hMatch?.[1]);
  const snow48h = parseNumber(snow48hMatch?.[1]);

  return {
    updatedAt: null,
    metrics: {
      snow24h,
      forecast72h: null,
      daysSinceSnow: inferDaysSinceSnow({ snow24h, snow48h }),
      baseDepth: parseNumber(baseMatch?.[1]),
      runsOpen: parseNumber(trailMatch?.[1]),
      runsTotal: parseNumber(trailMatch?.[2]),
      groomedRuns: parseNumber(groomedMatch?.[1])
    },
    note: cleanText((html.match(/Packed powder|Powder|Spring conditions|Hard packed|Machine groomed|Variable/i) || [])[0]),
    sources: {
      conditions: entry.reportUrl,
      terrain: entry.reportUrl
    }
  };
}

async function parseJacksonHole(entry) {
  const html = await fetchText(entry.reportUrl);

  function extractTotalSmall(label) {
    const pattern = new RegExp(label + '[\\s\\S]{0,200}?class="total-small"[^>]*>\\s*(\\d+(?:\\.\\d+)?)', 'i');
    const match = html.match(pattern);
    return parseNumber(match?.[1]);
  }

  const snow24h = extractTotalSmall('OVERNIGHT') ?? extractTotalSmall('SINCE 6AM');
  const snow48h = extractTotalSmall('48 HOURS');
  const baseDepth = extractTotalSmall('SNOW DEPTH');

  return {
    updatedAt: null,
    metrics: {
      snow24h,
      forecast72h: null,
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
  // A-Basin returns HTTP 404 but still serves the page content
  const response = await fetch(entry.reportUrl, {
    headers: { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.9' }
  });
  const html = await response.text();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const runsMatch = text.match(/Open Runs\s*(\d+)\s*\/\s*(\d+)/i);
  const liftsMatch = text.match(/Open Lifts\s*(\d+)\s*\/\s*(\d+)/i);
  const baseMatch = text.match(/Base[\s:]*(\d+)/i);

  const runsOpen = parseNumber(runsMatch?.[1]);
  const runsTotal = parseNumber(runsMatch?.[2]);
  const liftsOpen = parseNumber(liftsMatch?.[1]);

  return {
    updatedAt: null,
    metrics: {
      snow24h: null,
      forecast72h: null,
      daysSinceSnow: null,
      baseDepth: parseNumber(baseMatch?.[1]),
      runsOpen,
      runsTotal,
      groomedRuns: null,
      liftsOpen
    },
    note: null,
    sources: {
      conditions: entry.reportUrl,
      terrain: entry.reportUrl
    }
  };
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

  // Parse terrain page — count lifts and runs by status
  const terrainText = terrainHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Count lifts: look for chair names followed by Open/Closed
  const liftMatches = terrainText.match(/(Stoke Chair|Stellar Chair|Ripper Chair|Gondola|T-Bar)[^.]*?(Open|Closed)/gi) || [];
  const liftsOpen = liftMatches.filter(m => /Open/i.test(m)).length || null;

  // Count runs by status
  const statusMatches = terrainText.match(/\b(Groomedam|Groomedpm|Open|Marginal|Closed)\b/gi) || [];
  const openStatuses = statusMatches.filter(s => /^(groomedam|groomedpm|open)$/i.test(s));
  const closedStatuses = statusMatches.filter(s => /^closed$/i.test(s));
  const groomedStatuses = statusMatches.filter(s => /^(groomedam|groomedpm)$/i.test(s));

  // Subtract lift count from run totals (lifts also have Open status)
  const runsOpen = openStatuses.length > 0 ? openStatuses.length - (liftsOpen || 0) : null;
  const runsTotal = (openStatuses.length + closedStatuses.length) > 0
    ? openStatuses.length + closedStatuses.length - liftMatches.length
    : null;
  const groomedRuns = groomedStatuses.length || null;

  return {
    updatedAt: null,
    metrics: {
      snow24h,
      forecast72h: null,
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
  const url = formatOpenMeteoFullUrl(entry.lat, entry.lon);
  const payload = await fetchJson(url);
  const daily = payload?.daily || {};
  const dates = daily.time || [];
  const snowfall = daily.snowfall_sum || [];       // cm per day
  const tempMax = daily.temperature_2m_max || [];  // °F
  const tempMin = daily.temperature_2m_min || [];  // °F
  const snowDepth = daily.snow_depth_max || [];    // cm (nullable)

  // past_days=7 gives us 7 past days + today + 3 forecast days = ~11 entries
  // Find today's index (first forecast day — past days come first)
  const today = new Date().toISOString().slice(0, 10);
  let todayIdx = dates.indexOf(today);
  if (todayIdx === -1) todayIdx = 7; // fallback: assume 7 past days

  // Recent snowfall from past days (cm → inches)
  const snow1dAgo = cmToInches(snowfall[todayIdx - 1]) ?? 0;  // yesterday
  const snow2dAgo = cmToInches(snowfall[todayIdx - 2]) ?? 0;  // 2 days ago
  const snow3dAgo = cmToInches(snowfall[todayIdx - 3]) ?? 0;  // 3 days ago
  const snow24h = Math.round(snow1dAgo * 10) / 10;
  const snow48h = Math.round((snow1dAgo + snow2dAgo) * 10) / 10;
  const snow72h = Math.round((snow1dAgo + snow2dAgo + snow3dAgo) * 10) / 10;

  // 7-day total
  let snow7d = 0;
  for (let i = todayIdx - 7; i < todayIdx; i++) {
    if (i >= 0) snow7d += cmToInches(snowfall[i]) ?? 0;
  }
  snow7d = Math.round(snow7d * 10) / 10;

  // Forecast snowfall (next 3 days)
  const fc1 = cmToInches(snowfall[todayIdx + 1]) ?? 0;
  const fc2 = cmToInches(snowfall[todayIdx + 2]) ?? 0;
  const fc3 = cmToInches(snowfall[todayIdx + 3]) ?? 0;
  const forecast72h = Math.round((fc1 + fc2 + fc3) * 10) / 10;

  // Current temp: most recent hourly reading
  const hourly = payload?.hourly || {};
  const hourlyTemps = hourly.temperature_2m || [];
  const hourlyTimes = hourly.time || [];
  const now = new Date();
  let currentTemp = null;
  // Find most recent hour before now
  for (let i = hourlyTimes.length - 1; i >= 0; i--) {
    if (new Date(hourlyTimes[i]) <= now && Number.isFinite(hourlyTemps[i])) {
      currentTemp = Math.round(hourlyTemps[i]);
      break;
    }
  }

  // Base depth from snow_depth_max (cm → inches), use today or most recent
  let baseDepth = null;
  for (let i = todayIdx; i >= 0; i--) {
    if (Number.isFinite(snowDepth[i]) && snowDepth[i] > 0) {
      baseDepth = Math.round(cmToInches(snowDepth[i]) * 10) / 10;
      break;
    }
  }

  return {
    updatedAt: payload?.daily?.time?.[todayIdx] || null,
    metrics: {
      snow24h: snow24h || null,
      snow48h: snow48h || null,
      snow72h: snow72h || null,
      forecast72h: forecast72h || null,
      daysSinceSnow: inferDaysSinceSnow({ snow24h, snow48h, snow72h, snow7d }),
      baseDepth,
      tempF: currentTemp,
      runsOpen: null,
      runsTotal: null,
      groomedRuns: null
    },
    note: forecast72h > 6 ? 'Snow expected' : snow24h > 0 ? 'Recent snow' : null,
    sources: {
      conditions: url,
      terrain: null,
      forecast: url
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

async function loadAllResorts() {
  // Parse RAW_RESORTS from constants.js (avoid ESM import issues)
  const constantsPath = path.join(ROOT_DIR, 'js', 'constants.js');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(constantsPath, 'utf8');
  const names = [...src.matchAll(/\{\s*name:\s*"([^"]+)",\s*lat:\s*([-\d.]+),\s*lon:\s*([-\d.]+)/g)];
  const seen = new Map();
  for (const m of names) {
    const key = normalizeResortName(m[1]);
    if (!seen.has(key)) {
      seen.set(key, { name: m[1], lat: parseFloat(m[2]), lon: parseFloat(m[3]) });
    }
  }
  return seen;
}

async function main() {
  const sources = await readSources();
  const resortResults = {};

  // Build set of resorts already covered by dedicated adapters
  const coveredKeys = new Set(sources.map((s) => normalizeResortName(s.key || s.name)));

  // Auto-discover all app resorts and add open-meteo fallback for uncovered ones
  const allResorts = await loadAllResorts();
  const openMeteoEntries = [];
  for (const [key, resort] of allResorts) {
    if (!coveredKeys.has(key)) {
      openMeteoEntries.push({
        key,
        name: resort.name,
        adapter: 'open-meteo',
        lat: resort.lat,
        lon: resort.lon
      });
    }
  }

  const allEntries = [...sources, ...openMeteoEntries];
  process.stdout.write(`${sources.length} dedicated + ${openMeteoEntries.length} open-meteo fallback = ${allEntries.length} total resorts\n\n`);

  // Process in batches to respect Open-Meteo rate limits
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let openMeteoCount = 0;

  for (const entry of allEntries) {
    const key = normalizeResortName(entry.key || entry.name);
    process.stdout.write(`Fetching ${entry.name} (${entry.adapter})...\n`);

    // Throttle open-meteo requests (free tier: ~100/min)
    if (entry.adapter === 'open-meteo') {
      openMeteoCount += 1;
      if (openMeteoCount % 6 === 0) await delay(1500);
    }

    try {
      const parsed = await parseEntry(entry);
      // open-meteo already includes forecast, skip redundant call
      const withLiveForecast = entry.adapter === 'open-meteo'
        ? parsed
        : await withForecast(entry, parsed);

      // Enrich open-meteo resorts with terrain data
      if (entry.adapter === 'open-meteo') {
        const liftieData = await fetchLiftieData(key).catch(() => null);
        enrichWithTerrain(withLiveForecast, key, liftieData);
      }

      const m = withLiveForecast.metrics;
      resortResults[key] = {
        status: 'ok',
        resort: entry.name,
        adapter: entry.adapter,
        updatedAt: withLiveForecast.updatedAt,
        note: withLiveForecast.note,
        metrics: {
          snow24h: m.snow24h,
          snow48h: m.snow48h ?? null,
          snow72h: m.snow72h ?? null,
          forecast72h: m.forecast72h,
          daysSinceSnow: m.daysSinceSnow,
          baseDepth: m.baseDepth === null ? null : Math.round(m.baseDepth * 10) / 10,
          tempF: m.tempF ?? null,
          runsOpen: m.runsOpen,
          runsTotal: m.runsTotal,
          groomedRuns: m.groomedRuns,
          liftsOpen: m.liftsOpen ?? null
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

import { zonedTimestamp } from './source-time.mjs';
import { isFresh, REPORT_MAX_AGE_MS } from '../js/condition-data.js';

export const number = value => {
  if (value === null || value === undefined || !/^-?\d+(?:\.\d+)?$/.test(String(value).trim())) return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
};
const sumComplete = values => values.length && values.every(Number.isFinite) ? values.reduce((sum, n) => sum + n, 0) : null;
const agree = values => values.length && values.every(n => Number.isFinite(n) && n === values[0]) ? values[0] : null;
const oldest = values => values.length && values.every(v => v && Number.isFinite(Date.parse(v))) ? [...values].sort((a, b) => Date.parse(a) - Date.parse(b))[0] : null;
const isOpen = value => String(value || '').toLowerCase() === 'open';
export const visibleHtml = html => String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
export const htmlText = html => visibleHtml(html).replace(/<[^>]+>/g, ' ').replace(/&#8221;|&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#176;/g, '°').replace(/\s+/g, ' ').trim();

export function parseAltaPayload(payload, timezone) {
  const c = payload.conditions || {};
  return {
    snowReportedAt: zonedTimestamp(c.dated_at, timezone),
    // Operations are the site's current state, independent of its snowfall observation clock.
    terrainReportedAt: new Date().toISOString(), terrainTimestampKind: 'checked',
    metrics: { snow24h: number(c.last24), baseDepth: number(c.base_depth), tempF: number(c.base_temp),
      runsOpen: number(payload.operations?.runs?.open), runsTotal: number(payload.operations?.runs?.total), groomedRuns: null },
    note: c.sky_cover || null
  };
}

export function parseMtnfeedPayload(feed, { parseTime, parseDepth, expectedCount, winter = true, now = Date.now() } = {}) {
  const resorts = feed?.Resorts;
  if (!Array.isArray(resorts) || !resorts.length || resorts.some(r => !r.SnowReport)) throw new Error('SnowReport missing in resort feed.');
  if (expectedCount && resorts.length !== expectedCount) throw new Error('Combined destination feed is incomplete.');
  if (new Set(resorts.map(r => r.Name)).size !== resorts.length) throw new Error('Duplicate mountain in combined report.');
  const snow = resorts.map(r => r.SnowReport);
  const skiTrails = resort => (resort.MountainAreas || []).flatMap(area => area.Trails || [])
    .filter(trail => !/snowshoe|hiking|bik|nordic/i.test(`${trail.Difficulty} ${trail.TrailIcon}`));
  const openGroomed = resort => {
    const count = number(resort.SnowReport.TotalOpenTrails);
    if (count === 0) return 0;
    const open = skiTrails(resort).filter(trail => isOpen(trail.StatusEnglish));
    // Summary grooming totals can include closed trails. Require reconciled open rows and explicit flags.
    return open.length === count && open.every(trail => /^(yes|no)$/i.test(trail.Grooming || ''))
      ? open.filter(trail => /^yes$/i.test(trail.Grooming)).length : null;
  };
  const metrics = {
    snow24h: agree(snow.map(s => number(s.AllMountain?.Last24HoursIn))),
    snow48h: agree(snow.map(s => number(s.AllMountain?.Last48HoursIn))),
    snow72h: agree(snow.map(s => number(s.AllMountain?.Last72HoursIn))),
    baseDepth: agree(snow.map(s => parseDepth(s.SnowBaseRangeIn))),
    runsOpen: sumComplete(snow.map(s => number(s.TotalOpenTrails))),
    runsTotal: sumComplete(snow.map(s => number(s.TotalTrails))),
    groomedRuns: sumComplete(resorts.map(openGroomed))
  };
  if (metrics.runsOpen === 0) metrics.groomedRuns = 0;
  if (metrics.runsTotal === 0) { metrics.runsTotal = null; metrics.runsOpen = null; metrics.groomedRuns = null; }
  const staleOpen = resorts.some(resort => {
    if (!(number(resort.SnowReport.TotalOpenTrails) > 0)) return false;
    return !isFresh(parseTime(resort.SnowReport.LastUpdate), REPORT_MAX_AGE_MS, now)
      || !skiTrails(resort).some(trail => isFresh(parseTime(trail.UpdateDate), REPORT_MAX_AGE_MS, now));
  });
  if (staleOpen || !winter) for (const key of ['runsOpen','runsTotal','groomedRuns']) metrics[key] = null;
  return {
    snowReportedAt: oldest(snow.map(s => parseTime(s.LastUpdate))),
    terrainReportedAt: oldest(resorts.map(r => parseTime(r.LastUpdate))), terrainTimestampKind: 'feed',
    terrainStatus: !winter ? 'unavailable' : staleOpen ? 'unverified' : undefined,
    issues: !winter ? ['The official page currently selects a summer feed; summer trails are not ski-run inventory.'] : staleOpen ? ['Positive ski-run counts have no current dated winter report and trail-state evidence; a feed-render timestamp cannot renew old summer/winter states.'] : [],
    sourceUpdatedText: snow.map(s => s.LastUpdate).join(' / '), metrics,
    componentReports: resorts.map(r => ({ name: r.Name, snowReportedAt: parseTime(r.SnowReport.LastUpdate), terrainReportedAt: parseTime(r.LastUpdate), runsOpen: number(r.SnowReport.TotalOpenTrails), runsTotal: number(r.SnowReport.TotalTrails) })),
    note: resorts.length > 1 ? `Terrain totals combine ${resorts.map(r => r.Name).join(', ')}. Snow values are reported only when all component reports agree.` : snow[0].BaseConditions
  };
}

export function parsePowdrPayload(snowReports, trails, timezone) {
  const snow = Array.isArray(snowReports) ? snowReports[0] : null;
  if (!snow) throw new Error('Snow report missing.');
  if (snow.unit_of_measurement !== 'in') throw new Error('Unexpected snow report units.');
  // Summer hiking/biking and hidden rows are not ski runs.
  const winter = Array.isArray(trails) ? trails.filter(t => t.type === 'alpine_trail' && t.season === 'winter' && t.include !== false) : [];
  const open = winter.filter(t => isOpen(t.status));
  return {
    snowReportedAt: zonedTimestamp(snow.date, timezone), terrainReportedAt: new Date().toISOString(), terrainTimestampKind: 'checked',
    sourceUpdatedText: snow.date,
    metrics: { snow24h: number(snow.computed?.['24_hour']), snow48h: number(snow.computed?.['48_hour']), snow72h: number(snow.computed?.['72_hour']), baseDepth: number(snow.base_depth),
      runsTotal: winter.length || null, runsOpen: winter.length ? open.length : null,
      groomedRuns: winter.length ? open.filter(t => String(t.groom_status).toLowerCase() === 'groomed').length : null },
    note: htmlText(snow.report || '')
  };
}

export function parseReportPalPayload(payload) {
  const current = payload?.currentConditions;
  if (!current?.resortwide || !payload.facilities) throw new Error('ReportPal response has no winter facilities.');
  const rows = (payload.facilities?.areas?.area || []).flatMap(a => a.trails?.trail || []);
  const counts = current.resortwide;
  const locations = current.resortLocations?.location || [];
  const unitValue = field => agree(locations.map(l => number(l[field]?.inches)));
  const open = number(counts.numTrailsOpen);
  const staleOpen = open > 0 && !isFresh(payload.trailsUpdated, REPORT_MAX_AGE_MS);
  return {
    snowReportedAt: payload.updated, terrainReportedAt: new Date().toISOString(), terrainTimestampKind: 'checked',
    sourceUpdatedText: payload.updated,
    terrainStatus: staleOpen ? 'unverified' : undefined,
    issues: staleOpen ? ['Positive winter trail counts are older than the report freshness limit.'] : [],
    metrics: { snow24h: unitValue('snow24Hours'), snow48h: unitValue('snow48Hours'), snow72h: unitValue('snow72Hours'), baseDepth: unitValue('base'),
      runsOpen: staleOpen ? null : open, runsTotal: staleOpen ? null : number(counts.numTrailsTotal),
      // Count groomed runs available to ski; flags on closed trails are not open groomed terrain.
      groomedRuns: staleOpen ? null : open === 0 ? 0 : rows.length ? rows.filter(t => isOpen(t.status) && t.groomed === true).length : null,
      liftsOpen: staleOpen ? null : number(counts.numLiftsOpen) },
    note: `Winter terrain from ${payload.name}'s official ReportPal feed. Summer facilities are excluded.`,
    componentReports: locations.map(l => ({ name: l.name, snow24h: number(l.snow24Hours?.inches) }))
  };
}

export function parseMcTerrain(html) {
  const text = htmlText(html);
  const summaries = [...text.matchAll(/Trails Open\s+(\d+)\s*\/\s*(\d+)/g)];
  if (!summaries.length) throw new Error('No winter trail summary found.');
  const runsOpen = summaries.reduce((sum, m) => sum + Number(m[1]), 0);
  const runsTotal = summaries.reduce((sum, m) => sum + Number(m[2]), 0);
  const rows = [...visibleHtml(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  const open = rows.filter(row => /<span\b[^>]*class="sr-only"[^>]*>Trail Open<\/span>/i.test(row));
  return { runsTotal: runsTotal || null, runsOpen, groomedRuns: runsOpen === 0 ? 0 : open.length === runsOpen ? open.filter(row => /mc__icon-groomed/.test(row)).length : null };
}

export function parseAbasinTerrain(html) {
  const text = htmlText(html);
  // The number comes before the label. The old scraper accidentally captured the lift total.
  const runs = text.match(/(\d+)\s*\/\s*(\d+)\s*Open Runs\b/i);
  const lifts = text.match(/(\d+)\s*\/\s*(\d+)\s*Open Lifts\b/i);
  if (!runs) throw new Error('Official page has no run-status summary.');
  return { runsOpen: number(runs[1]), runsTotal: number(runs[2]), groomedRuns: null, liftsOpen: number(lifts?.[1]) };
}

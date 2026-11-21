// ERA5 snowfall estimates are inches internally; missing model days are never zero.
export function snowfallKey(name) {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function seasonLabel(startYear, southern = false) {
  return southern ? String(startYear) : `${startYear}/${String(startYear + 1).slice(-2)}`;
}

export function currentSeason(resort, now = new Date()) {
  const year = now.getUTCFullYear();
  return seasonLabel(resort.lat < 0 ? year : year - (now.getUTCMonth() < 6 ? 1 : 0), resort.lat < 0);
}

// Resort-reported season totals. A report must be dated inside the current season and be
// recent; old counters left over from last season are screened by the collector.
export const SEASON_REPORT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function seasonStart(resort, now = new Date()) {
  const label = currentSeason(resort, now);
  return resort.lat < 0 ? Date.UTC(Number(label), 0, 1) : Date.UTC(Number(label.slice(0, 4)), 6, 1);
}

// A leftover counter from last season is far above any plausible model total. Real reports
// ran 1.1-3x the model's 92-day snowfall at the resort terrain point (Nov 2026 check).
export function plausibleSeasonTotal(inches, modelInches) {
  return Number.isFinite(inches) && inches >= 0 && Number.isFinite(modelInches) && modelInches >= 0
    && inches <= modelInches * 4 + 12;
}

export function reportedSeasonTotal(report, resort, now = new Date()) {
  const reportedAt = Date.parse(report?.reportedAt);
  const age = Number(now) - reportedAt;
  if (!Number.isFinite(report?.inches) || report.inches < 0 || !Number.isFinite(reportedAt)) return null;
  if (age < -5 * 60 * 1000 || age > SEASON_REPORT_MAX_AGE_MS || reportedAt < seasonStart(resort, now)) return null;
  return { total: report.inches, reportedAt: report.reportedAt };
}

// One short provenance line for a currentSnowfall() result.
export function seasonSourceText(item) {
  if (item.kind === 'reported') return `Resort report · ${new Date(item.reportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  if (item.kind === 'model') return `Model estimate (ERA5)${item.record?.through ? ' · through ' + item.record.through : ''}`;
  return 'No estimate';
}

// Season-to-date snowfall: the resort's own current report when valid, otherwise the ERA5
// model estimate. kind says which one it is.
export function currentSnowfall(resort, catalog, now = new Date()) {
  const season = currentSeason(resort, now);
  const entry = catalog?.resorts?.[snowfallKey(resort.name)];
  const record = entry?.seasons?.find((item) => item.season === season);
  const reported = reportedSeasonTotal(resort.liveSeasonSnowfall, resort, now);
  if (reported) return { season, total: reported.total, kind: 'reported', reportedAt: reported.reportedAt, entry, record };
  const total = Number.isFinite(record?.total) ? record.total : null;
  return { season, total, kind: total === null ? null : 'model', entry, record };
}

export function rankedSnowfall(resorts, catalog, now = new Date()) {
  return resorts.map((resort) => ({ resort, ...currentSnowfall(resort, catalog, now) }))
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.resort.name.localeCompare(b.resort.name));
}

export function historyRecords(resorts, catalog, { pass = 'all', query = '', season = 'all', min = 0, max = Infinity } = {}, now = new Date()) {
  const records = [];
  for (const resort of resorts) {
    if (pass !== 'all' && !resort.passes.includes(pass)) continue;
    if (!resort.name.toLowerCase().includes(query.toLowerCase().trim())) continue;
    const entry = catalog?.resorts?.[snowfallKey(resort.name)];
    const currentStart = Number(currentSeason(resort, now).slice(0, 4));
    for (const record of entry?.seasons || []) {
      // Compare complete past seasons only, across the full archive.
      const start = Number(record.season.slice(0, 4));
      if (!record.complete || start >= currentStart) continue;
      if (!Number.isFinite(record.total) || record.total < min || record.total > max) continue;
      if (season !== 'all' && record.season !== season) continue;
      records.push({ resort, ...record, sourceUrl: entry.sourceUrl, retrievedAt: entry.retrievedAt });
    }
  }
  return records.sort((a, b) => b.total - a.total || a.resort.name.localeCompare(b.resort.name) || b.season.localeCompare(a.season));
}

export async function fetchSnowfallCatalog() {
  const response = await fetch('./data/resort-snowfall.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Snowfall records could not load (HTTP ${response.status}).`);
  const catalog = await response.json();
  if (catalog.units !== 'in' || catalog.model !== 'era5' || !catalog.resorts || !catalog.generatedAt) {
    throw new Error('Snowfall records have an invalid format.');
  }
  return catalog;
}

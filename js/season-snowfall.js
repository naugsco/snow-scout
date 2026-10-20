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

export function currentSnowfall(resort, catalog, now = new Date()) {
  const season = currentSeason(resort, now);
  const entry = catalog?.resorts?.[snowfallKey(resort.name)];
  const record = entry?.seasons?.find((item) => item.season === season);
  return { season, total: Number.isFinite(record?.total) ? record.total : null, entry, record };
}

export function rankedSnowfall(resorts, catalog, now = new Date()) {
  return resorts.map((resort) => ({ resort, ...currentSnowfall(resort, catalog, now) }))
    .sort((a, b) => (a.total ?? -1) - (b.total ?? -1) || a.resort.name.localeCompare(b.resort.name));
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

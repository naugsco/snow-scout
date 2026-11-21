#!/usr/bin/env node
// Build crawlable static pages (one per resort, a resort index, sitemap.xml and
// robots.txt) from the committed forecast snapshot. The interactive app keeps
// using hash routes; these pages exist so search engines can index each resort.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resorts } from '../js/resorts.js';
import { getSourceKeyForResort, normalizeResortName, formatPassLabel } from '../js/utils.js';
import { subregionsFor } from '../js/resort-regions.js';
import { forecastIsCurrent } from '../js/weather-data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_URL = 'https://snowscout.ski';
const CM_PER_INCH = 2.54;
const NEARBY_LIMIT = 8;
// Cloudflare Web Analytics site token for snowscout.ski (public by design).
export const ANALYTICS_SNIPPET = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "4d1c2398ed95451baef2883f23227184"}'></script><!-- End Cloudflare Web Analytics -->`;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Readable ASCII slug for page URLs: "Kitzbühel" -> "kitzbuhel".
export function pageSlug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Slug understood by js/router.js for the live app's #resort= deep link.
export const appSlug = (name) => normalizeResortName(name).replace(/\s+/g, '-');

const inches = (value) => `${value.toFixed(1)} in`;
const centimetres = (value) => `${Math.round(value * CM_PER_INCH)} cm`;
const both = (value) => `${inches(value)} (${centimetres(value)})`;

function formatIssued(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid timestamp: ${iso}`);
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}, `
    + `${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}

function formatDay(localDate) {
  const date = new Date(`${localDate}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function placeLabel(resort) {
  return [...subregionsFor(resort), resort.regionLabel].join(' · ');
}

// Returns the usable forecast for a resort at build time, or null.
function currentForecast(resort, forecasts, now) {
  const forecast = forecasts[getSourceKeyForResort(resort.name)];
  if (!forecast) throw new Error(`No forecast entry for ${resort.name}.`);
  return forecastIsCurrent(forecast, now) ? forecast : null;
}

function nearbyResorts(resort, all) {
  const subregions = subregionsFor(resort);
  const sameSubregion = all.filter((other) => other !== resort
    && subregionsFor(other).some((name) => subregions.includes(name)));
  const sameRegion = all.filter((other) => other !== resort && other.region === resort.region
    && !sameSubregion.includes(other));
  return [...sameSubregion, ...sameRegion].slice(0, NEARBY_LIMIT);
}

function pageShell({ title, description, canonicalPath, depth, body }) {
  const up = '../'.repeat(depth);
  const canonical = `${SITE_URL}/${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Snow Scout">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <link rel="stylesheet" href="${up}resort-page.css?v=20261121-seo">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${up}">Snow Scout</a>
    <nav aria-label="Site"><a href="${up}resorts/">All resorts</a><a href="${up}">Live heatmap</a></nav>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <p>Forecasts are weather-model estimates, not resort snow reports. Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a> (CC BY 4.0).</p>
    <p><a href="${up}">Snow Scout</a> · <a href="${up}resorts/">All resorts</a> · <a href="${up}history.html">Snowfall history</a></p>
  </footer>
  ${ANALYTICS_SNIPPET}
</body>
</html>
`;
}

export function resortPage(resort, forecast, issuedAt, nearby) {
  const slug = pageSlug(resort.name);
  const passes = formatPassLabel(resort);
  const place = placeLabel(resort);
  const liveLink = `../../#resort=${encodeURIComponent(appSlug(resort.name))}`;
  let description;
  let summary;
  let outlook;
  if (forecast) {
    const days = forecast.dailySnowfall;
    const total = days.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    const finiteDays = days.filter(Number.isFinite).length;
    // Trailing empty days (the model horizon) are normal; only gaps inside the
    // forecast period deserve a note.
    const lastFinite = days.findLastIndex(Number.isFinite);
    const gaps = days.slice(0, lastFinite + 1).some((value) => !Number.isFinite(value));
    description = `${resort.name} snow forecast: ${both(forecast.forecast72h)} expected in the next 72 hours`
      + ` and ${inches(total)} over ${finiteDays} days. ${place}. ${passes}. Updated ${formatIssued(forecast.updatedAt)}.`;
    const peak = Math.max(...days.filter(Number.isFinite), 0);
    const rows = forecast.dailyTime.map((date, i) => {
      const value = days[i];
      const amount = Number.isFinite(value)
        ? `<td>${inches(value)}</td><td>${centimetres(value)}</td>`
        : '<td colspan="2">No data</td>';
      const width = Number.isFinite(value) && peak > 0 ? Math.round((value / peak) * 100) : 0;
      return `          <tr><th scope="row">${formatDay(date)}</th>${amount}<td class="bar-cell" aria-hidden="true"><span style="width:${width}%"></span></td></tr>`;
    }).join('\n');
    summary = `      <dl class="stats">
        <div><dt>Next 72 hours</dt><dd>${inches(forecast.forecast72h)}<small>${centimetres(forecast.forecast72h)}</small></dd></div>
        <div><dt>${finiteDays}-day total</dt><dd>${inches(total)}<small>${centimetres(total)}${gaps ? ' · some days missing' : ''}</small></dd></div>
      </dl>
      <p class="issued">Forecast issued ${formatIssued(forecast.updatedAt)}. Dates are local to the resort.</p>`;
    outlook = `    <section>
      <h2>${days.length}-day snowfall outlook</h2>
      <table class="outlook">
        <thead><tr><th scope="col">Day</th><th scope="col">Snow</th><th scope="col">cm</th><th scope="col"><span class="visually-hidden">Relative amount</span></th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </section>`;
  } else {
    description = `${resort.name} snow forecast, conditions, webcams and trip planning. ${place}. ${passes}.`;
    summary = `      <p class="issued">No current forecast was available when this page was built (${formatIssued(issuedAt)}). The live view fetches a fresh one.</p>`;
    outlook = '';
  }
  const location = forecast?.weatherLocation;
  const locationText = location
    ? `The forecast point is on mapped ski terrain at ${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
      + (Number.isFinite(location.elevationM) ? `, ${Math.round(location.elevationM).toLocaleString('en-US')} m (${Math.round(location.elevationM * 3.28084).toLocaleString('en-US')} ft)` : '')
      + '. It is a model grid estimate, not a resort snow stake, and conditions vary across the mountain.'
    : 'Forecasts use a weather-model point on mapped ski terrain, not a resort snow stake.';
  const nearbyList = nearby.map((other) => `        <li><a href="../${pageSlug(other.name)}/">${escapeHtml(other.name)}</a></li>`).join('\n');
  const body = `    <nav class="crumbs" aria-label="Breadcrumb"><a href="../">Resorts</a> › <span>${escapeHtml(resort.regionLabel)}</span></nav>
    <section class="hero">
      <h1>${escapeHtml(resort.name)} snow forecast</h1>
      <p class="place">${escapeHtml(place)} · ${escapeHtml(passes)}</p>
${summary}
      <a class="cta" href="${liveLink}">Open live forecast, webcams &amp; trip planner</a>
    </section>
${outlook}
    <section>
      <h2>About this forecast</h2>
      <p>${escapeHtml(locationText)}</p>
      <p>The live view adds current resort reports where available, webcams, a 3D trail map and flight and lodging search.</p>
    </section>
${nearby.length ? `    <section>
      <h2>Nearby resorts</h2>
      <ul class="nearby">
${nearbyList}
      </ul>
    </section>` : ''}`;
  return {
    path: `resorts/${slug}/index.html`,
    html: pageShell({
      title: `${resort.name} Snow Forecast & Conditions | Snow Scout`,
      description, canonicalPath: `resorts/${slug}/`, depth: 2, body,
    }),
  };
}

export function indexPage(entries, issuedAt) {
  const groups = new Map();
  for (const { resort, forecast } of entries) {
    const key = resort.regionLabel;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ resort, forecast });
  }
  const sections = [...groups.entries()].map(([label, items]) => {
    const list = items
      .sort((a, b) => a.resort.name.localeCompare(b.resort.name))
      .map(({ resort, forecast }) => `        <li><a href="${pageSlug(resort.name)}/">${escapeHtml(resort.name)}</a>`
        + `<span>${forecast ? `${inches(forecast.forecast72h)} next 72h` : 'Forecast unavailable'}</span></li>`)
      .join('\n');
    return `    <section>
      <h2>${escapeHtml(label)}</h2>
      <ul class="resort-list">
${list}
      </ul>
    </section>`;
  }).join('\n');
  const body = `    <section class="hero">
      <h1>Ski resort snow forecasts</h1>
      <p class="place">${entries.length} resorts across North America, the Alps, Japan and the Southern Hemisphere · Epic, Ikon and Mountain Collective</p>
      <p class="issued">Built from forecasts issued up to ${formatIssued(issuedAt)}.</p>
      <a class="cta" href="../">Compare them on the live heatmap</a>
    </section>
${sections}`;
  return {
    path: 'resorts/index.html',
    html: pageShell({
      title: 'Ski Resort Snow Forecasts – Epic, Ikon & Mountain Collective | Snow Scout',
      description: `16-day snow forecasts for ${entries.length} ski resorts on the Epic, Ikon and Mountain Collective passes, updated several times a day.`,
      canonicalPath: 'resorts/', depth: 1, body,
    }),
  };
}

export function sitemap(pagePaths, lastmod) {
  const urls = ['', 'resorts/', 'history.html', ...pagePaths]
    .map((p) => `  <url><loc>${SITE_URL}/${p}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

export async function buildSeoPages(outputDir, { now = Date.now() } = {}) {
  const snapshot = JSON.parse(await readFile(path.join(ROOT, 'data/resort-forecasts.json'), 'utf8'));
  if (!snapshot.resorts || !snapshot.generatedAt) throw new Error('resort-forecasts.json is missing resorts or generatedAt.');
  const slugs = new Map();
  for (const resort of resorts) {
    const slug = pageSlug(resort.name);
    if (!slug) throw new Error(`Empty page slug for ${resort.name}.`);
    if (slugs.has(slug)) throw new Error(`Duplicate page slug "${slug}" for ${resort.name} and ${slugs.get(slug)}.`);
    slugs.set(slug, resort.name);
  }
  const entries = resorts.map((resort) => ({ resort, forecast: currentForecast(resort, snapshot.resorts, now) }));
  const files = entries.map(({ resort, forecast }) => resortPage(resort, forecast, snapshot.generatedAt, nearbyResorts(resort, resorts)));
  files.push(indexPage(entries, snapshot.generatedAt));
  const pagePaths = files.filter((f) => f.path !== 'resorts/index.html').map((f) => f.path.replace(/index\.html$/, ''));
  files.push({ path: 'sitemap.xml', html: sitemap(pagePaths, snapshot.generatedAt.slice(0, 10)) });
  files.push({ path: 'robots.txt', html: robots() });
  for (const file of files) {
    const destination = path.join(outputDir, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.html);
  }
  return { pages: entries.length, current: entries.filter((e) => e.forecast).length, files: files.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output) throw new Error('Usage: node scripts/build_seo_pages.mjs <output-dir>');
  const result = await buildSeoPages(path.resolve(output));
  process.stdout.write(`Built ${result.pages} resort pages (${result.current} with a current forecast), ${result.files} files.\n`);
}

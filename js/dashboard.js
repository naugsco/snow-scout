import { PASS_FILTERS, REGION_FILTERS } from './constants.js?v=20261021-sources-verified';
import { state, saveFavorites } from './state.js?v=20261021-sources-verified';
import { resorts } from './resorts.js?v=20261021-sources-verified';
import { formatInches, formatRunAccess, formatPassLabel } from './utils.js?v=20261106-mountain-weather';
import { fetchSnowfallCatalog, currentSnowfall } from './season-snowfall.js?v=20261021-sources-verified';
import { HEATMAP_METRICS, rankResorts, heatColor, layoutHeatmap } from './heatmap-metrics.js?v=20261021-sources-verified';
import { icon } from './ui-icons.js?v=20261021-sources-verified';
import { currentSnowStatus, loadCurrentSnow } from './current-snow.js?v=20261106-mountain-weather';
import { weatherLocationLabel } from './weather-location.js?v=20261106-mountain-weather';

const root = document.getElementById('resort-list');
const preview = document.getElementById('heatmap-preview');
let catalog = null;
let seasonError = null;
let onResortClick = null;
let onCompareToggle = null;
let visibleRows = [];
let hoveredId = null;
let forecastUpdated = false;
let showTimer;
let hideTimer;
const CAP = 20;
// Visual experiment only; this flag does not indicate actual resort weather.
const snowDemo = new URLSearchParams(window.location.search).get('snowDemo') === '1';
const snowDemoWhite = snowDemo && new URLSearchParams(window.location.search).get('snowBackground') === 'white';
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const metric = () => HEATMAP_METRICS.find((item) => item.id === state.sortMode) || HEATMAP_METRICS[3];

function snowMarkup() {
  // Three vector crystals, each assembled from six identical radial arms.
  const arms = [
    'M0 0V-10M0-6L-3-9M0-6L3-9M0-3L-2-5M0-3L2-5',
    'M0 0V-10M0-5L-4-8M0-5L4-8M0-8L-2-10M0-8L2-10',
    'M0 0V-10M0-4L-3-7M0-4L3-7M0-7L-3-10M0-7L3-10M0-2L-2-3M0-2L2-3'
  ];
  return `<span class="heat-snow" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => {
    const size = [12, 18, 14, 24, 16, 20][i % 6];
    const duration = 6 + (i * 7 % 9);
    const crystal = Array.from({ length: 6 }, (_, arm) => `<path d="${arms[i % arms.length]}" transform="rotate(${arm * 60})"/>`).join('');
    return `<span class="heat-snow-flake" style="--flake-left:${(i * 37 + 7) % 100}%;--flake-size:${size}px;--flake-duration:${duration}s;--flake-delay:-${(i * 2.7 + 1) % duration}s;--flake-opacity:${.3 + (i % 4) * .15};--flake-turn:${i % 2 ? -90 : 90}deg;--flake-drift:${i % 2 ? -12 : 12}px"><svg viewBox="-12 -12 24 24" fill="none" stroke="white" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" focusable="false"><g class="heat-snow-outline">${crystal}</g><g>${crystal}</g></svg></span>`;
  }).join('')}</span>`;
}

function applyTileColor(tile, color) {
  // The white background override is restricted to the explicitly labeled demo.
  if (tile.classList.contains('snow-demo-white')) color = heatColor(0, 0, 0);
  tile.style.setProperty('--tile-bg', color.background);
  tile.style.setProperty('--tile-fg', color.foreground);
  // Use the palette's text-contrast choice to strengthen outlines on pale tiles.
  tile.style.setProperty('--snow-outline-opacity', color.foreground === '#0b1b35' ? '.75' : '.25');
}

function updateTileSnow(tile, resort) {
  const demo = snowDemo && tile.dataset.resortId === visibleRows[0]?.resort.id;
  const snowing = currentSnowStatus(resort.currentSnow) === 'snowing';
  if ((demo || snowing) && !tile.querySelector('.heat-snow')) tile.insertAdjacentHTML('afterbegin', snowMarkup());
  if (!demo && !snowing) tile.querySelector('.heat-snow')?.remove();
  tile.querySelector('.heat-snow-label')?.remove();
  if (demo || snowing) {
    const label = document.createElement('span');
    label.className = 'heat-snow-label';
    label.textContent = demo ? 'Snow animation demo' : 'Snowing · model';
    if (!demo) label.title = `Open-Meteo model · ${weatherLocationLabel(resort,{weatherLocation:{elevationM:resort.currentSnow.elevationM}})} · ${new Date(resort.currentSnow.validAt).toLocaleString()}. Not a live observation.`;
    tile.appendChild(label);
  }
  const row = visibleRows.find(row => row.resort.id === resort.id);
  if (row) tile.setAttribute('aria-label', `${resort.name}, ${metric().label}: ${row.value === null ? 'Unavailable' : amount(row.value)}. Open resort details.${demo ? ' Snow animation demo.' : snowing ? ' Snowing now, weather-model estimate.' : ''}`);
}

function updateSnowTiles() {
  root.querySelectorAll('.heat-tile').forEach(tile => {
    const row = visibleRows.find(row => row.resort.id === tile.dataset.resortId);
    if (row) updateTileSnow(tile, row.resort);
  });
}

export function refreshCurrentSnow() {
  updateSnowTiles();
  loadCurrentSnow(visibleRows.map(row => row.resort), updateSnowTiles)
    .catch(error => console.error('Current snowfall:', error.message));
}

export function baseFilteredResorts() {
  const query = state.searchQuery.toLowerCase().trim();
  const list = resorts.filter((resort) => {
    if (query && !resort.name.toLowerCase().includes(query)) return false;
    if (state.passFilter === 'favorites' && !state.favorites.has(resort.id)) return false;
    if (!['all', 'favorites'].includes(state.passFilter) && !resort.passes.includes(state.passFilter)) return false;
    return state.regionFilter === 'all' || resort.region === state.regionFilter;
  });
  if (state.sortMode === 'alpha') return list.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sortMode === 'daysSinceSnow') return list.sort((a, b) => (a.metrics.daysSinceSnow ?? Infinity) - (b.metrics.daysSinceSnow ?? Infinity));
  return rankResorts(list, metric().id, catalog).map((row) => row.resort);
}

export function applyStatusFilter(list) {
  if (state.statusFilter === 'all') return list;
  if (state.statusFilter === 'fresh' && state.freshMode === '48h') return list.filter((resort) => Number.isFinite(resort.metrics.snow48h) && resort.metrics.snow48h >= 7);
  return list.filter((resort) => resort.status === state.statusFilter);
}
export function filteredResorts() { return applyStatusFilter(baseFilteredResorts()); }
export function selectedResort() { return resorts.find((resort) => resort.id === state.selectedId) || null; }
export function ensureSelectionVisible() {
  if (state.selectedId && !filteredResorts().some((resort) => resort.id === state.selectedId)) state.selectedId = null;
}
export function favoriteGlyph(id) { return state.favorites.has(id) ? '★' : '☆'; }
export function toggleFavorite(id) {
  if (!id) return;
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveFavorites();
}
export function setOnResortClick(handler) { onResortClick = handler; }
export function setOnCompareToggle(handler) { onCompareToggle = handler; }

export function renderFilters(selectPassFilter, selectRegionFilter) {
  const passSelect = document.getElementById('pass-select');
  const regionSelect = document.getElementById('region-select');
  if (!passSelect.options.length) {
    for (const filter of PASS_FILTERS.filter((item) => item.id !== 'favorites')) passSelect.add(new Option(filter.id === 'all' ? 'All passes' : filter.label.replace(/^[^A-Za-z]+/, ''), filter.id));
    for (const filter of REGION_FILTERS) regionSelect.add(new Option(filter.id === 'all' ? 'Worldwide' : filter.label.replace(/^[^A-Za-z]+/, ''), filter.id));
    passSelect.addEventListener('change', () => selectPassFilter(passSelect.value));
    regionSelect.addEventListener('change', () => selectRegionFilter(regionSelect.value));
    document.getElementById('saved-view').addEventListener('click', () => selectPassFilter('favorites'));
    document.getElementById('explore-view').addEventListener('click', () => selectPassFilter('all'));
  }
  passSelect.value = state.passFilter === 'favorites' ? 'all' : state.passFilter;
  regionSelect.value = state.regionFilter;
  document.getElementById('saved-view').classList.toggle('active', state.passFilter === 'favorites');
  document.getElementById('explore-view').classList.toggle('active', state.passFilter !== 'favorites');
  document.getElementById('saved-view').setAttribute('aria-pressed', String(state.passFilter === 'favorites'));
  document.getElementById('explore-view').setAttribute('aria-pressed', String(state.passFilter !== 'favorites'));
}

function amount(value, id = metric().id) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (id === 'runsOpen') return String(Math.round(value));
  if (id === 'score') return value.toFixed(1);
  return formatInches(value).replace(/cm$/, ' cm');
}

function provenance(resort, id = metric().id) {
  if (id === 'season') {
    const entry = currentSnowfall(resort, catalog);
    return `ERA5 estimate${entry.record?.through ? ' · through ' + entry.record.through : ''}`;
  }
  if (id === 'forecast72h') return resort.liveForecastStatus === 'ready' ? 'Model forecast' : `Forecast ${resort.liveForecastStatus || 'unavailable'}`;
  const status = id === 'runsOpen' ? resort.liveTerrainStatus : resort.liveSnowStatus;
  if (status !== 'ready') return status === 'stale' ? 'Stale report withheld' : `Report ${status || 'unavailable'}`;
  if (id === 'runsOpen') return 'Resort report';
  return resort.liveConditionsKind === 'model' ? 'Model estimate' : 'Resort report';
}

function heatmapRows(list) {
  return rankResorts(list, metric().id, catalog).map((row) => {
    if (metric().id === 'runsOpen' && !row.resort.liveRunsReported) return { ...row, value: null };
    return row;
  }).sort((a, b) => (a.value === null) - (b.value === null) || (b.value ?? 0) - (a.value ?? 0) || a.resort.name.localeCompare(b.resort.name));
}

export function hideHeatmapPreview({ refresh = true } = {}) {
  const updateRanking = forecastUpdated;
  forecastUpdated = false;
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  preview.classList.remove('visible');
  preview.setAttribute('aria-hidden', 'true');
  hoveredId = null;
  root.querySelectorAll('.previewing').forEach((tile) => tile.classList.remove('previewing'));
  if (refresh && updateRanking) renderDashboard();
}

function positionPreview(tile) {
  const rect = tile.getBoundingClientRect();
  const width = Math.min(365, innerWidth - 24);
  preview.style.width = `${width}px`;
  let left = rect.left + rect.width * 0.6;
  if (left + width > innerWidth - 12) left = rect.right - width - rect.width * 0.25;
  const top = Math.max(12, Math.min(rect.top + rect.height * 0.62, innerHeight - preview.offsetHeight - 12));
  preview.style.left = `${Math.max(12, Math.min(left, innerWidth - width - 12))}px`;
  preview.style.top = `${top}px`;
}

function previewBars(resort) {
  const days = resort.liveForecast?.dailySnowfall?.slice(0, 3) || [null, null, null];
  const max = Math.max(...days.filter(Number.isFinite), 1);
  return days.map((value, i) => `<div><strong>${formatInches(value)}</strong><span class="preview-bar"><i style="height:${Number.isFinite(value) ? Math.max(2, value / max * 40) : 0}px"></i></span><span>D${i + 1}</span></div>`).join('');
}

function previewSource(resort) {
  const updatedAt = metric().id === 'forecast72h' && resort.liveForecast?.updatedAt ? resort.liveForecast.updatedAt : metric().id === 'runsOpen' ? resort.liveTerrainReportedAt : resort.liveUpdatedAt;
  return `${provenance(resort)}${updatedAt ? ` · ${new Date(updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}`;
}

function showPreview(resort, tile, fromPointer = false) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  if (fromPointer && preview.matches(':hover')) return;
  hoveredId = resort.id;
  preview.dataset.resortId = resort.id;
  root.querySelectorAll('.previewing').forEach((item) => item.classList.remove('previewing'));
  tile.classList.add('previewing');
  const m = resort.metrics;
  const runs = resort.liveRunsReported ? formatRunAccess(m, true) : '—';
  preview.innerHTML = `
    <div class="preview-head"><div><h2>${escape(resort.name)}</h2><p>${escape(resort.regionLabel)} · ${escape(formatPassLabel(resort))}</p></div>
      <button class="preview-favorite ${state.favorites.has(resort.id) ? 'is-saved' : ''}" aria-label="${state.favorites.has(resort.id) ? 'Unsave' : 'Save'} ${escape(resort.name)}">${icon('star')}</button></div>
    <div class="preview-stats">${[
      ['snowflake', 'Fresh 24h', formatInches(m.snow24h), 'snow24h'], ['snowflake', 'Fresh 48h', formatInches(m.snow48h), 'snow48h'],
      ['cloud', 'Forecast 72h', formatInches(m.forecast72h), 'forecast72h'], ['mountain', 'Runs open', runs, 'runsOpen']
    ].map(([symbol, label, value, key]) => `<div>${icon(symbol)}<span>${label}</span><strong data-preview-stat="${key}">${escape(value)}</strong></div>`).join('')}</div>
    <div class="preview-forecast"><p>Daily forecast (${state.useMetric ? 'cm' : 'in'})</p><div class="preview-bars">${previewBars(resort)}</div></div>
    <p class="preview-source">${escape(previewSource(resort))}</p>
    <div id="preview-travel"></div>
    <div class="preview-footer"><button class="preview-open">Full resort details ${icon('arrow-right')}</button><button class="preview-compare" title="Add resort to comparison" aria-label="Compare ${escape(resort.name)}">${icon('sliders-horizontal')}</button></div>`;
  preview.querySelector('.preview-favorite').addEventListener('click', () => {
    toggleFavorite(resort.id);
    const button = preview.querySelector('.preview-favorite');
    button.classList.toggle('is-saved', state.favorites.has(resort.id));
    button.setAttribute('aria-label', `${state.favorites.has(resort.id) ? 'Unsave' : 'Save'} ${resort.name}`);
    if (state.passFilter === 'favorites' && !state.favorites.has(resort.id)) renderDashboard();
  });
  preview.querySelector('.preview-open').addEventListener('click', () => { hideHeatmapPreview(); onResortClick?.(resort); });
  preview.querySelector('.preview-compare').addEventListener('click', () => onCompareToggle?.(resort.id));
  preview.dispatchEvent(new CustomEvent('preview-ready', { detail: { resort } }));
  preview.setAttribute('aria-hidden', 'false');
  positionPreview(tile);
  preview.classList.add('visible');
}

export function refreshHeatmapPreview(resort) {
  const updated = heatmapRows(filteredResorts());
  const byId = new Map(updated.map((row) => [row.resort.id, row]));
  const values = updated.map((row) => row.value).filter(Number.isFinite);
  visibleRows = visibleRows.map((row) => byId.get(row.resort.id) || row);
  root.querySelectorAll('.heat-tile').forEach((tile) => {
    const row = byId.get(tile.dataset.resortId);
    if (!row) return;
    const color = heatColor(row.value, Math.min(...values), Math.max(...values));
    applyTileColor(tile, color);
    tile.querySelector('.heat-value').textContent = amount(row.value);
    tile.querySelector('.heat-source').textContent = provenance(row.resort);
    updateTileSnow(tile, row.resort);
  });
  const tile = [...root.querySelectorAll('.heat-tile')].find((item) => item.dataset.resortId === resort.id);
  if (hoveredId === resort.id && tile) {
    // Update only data, preserving interactive buttons, focus and pointer targets.
    preview.querySelector('[data-preview-stat="forecast72h"]').textContent = formatInches(resort.metrics.forecast72h);
    preview.querySelector('.preview-bars').innerHTML = previewBars(resort);
    preview.querySelector('.preview-source').textContent = previewSource(resort);
    // Keep tiles still under the pointer; apply the new ranking on dismissal.
    forecastUpdated = true;
  } else if (!hoveredId) renderDashboard();
  else forecastUpdated = true;
}

export function reportPreviewForecastError(resort) {
  if (hoveredId === resort.id) preview.querySelector('.preview-source').textContent = 'Daily forecast unavailable. Try the resort’s full forecast.';
}

preview.addEventListener('pointerenter', () => { clearTimeout(showTimer); clearTimeout(hideTimer); });
preview.addEventListener('focusin', () => { clearTimeout(showTimer); clearTimeout(hideTimer); });
preview.addEventListener('pointerleave', () => { hideTimer = setTimeout(hideHeatmapPreview, 100); });
preview.addEventListener('focusout', (event) => { if (!preview.contains(event.relatedTarget)) hideHeatmapPreview(); });
window.addEventListener('scroll', hideHeatmapPreview, true);

function positionTiles() {
  const width = root.clientWidth;
  // ResizeObserver can run while a viewport/navigation transition temporarily
  // gives the canvas no width. Wait for its next non-zero measurement.
  if (!root.isConnected || width <= 0 || !visibleRows.length) return;
  const height = Math.max(innerWidth <= 600 ? Math.max(720, visibleRows.length * 48) : 430, Math.min(820, innerHeight - 350), state.showAllResorts ? visibleRows.length * (innerWidth <= 600 ? 60 : 16) : 0);
  root.style.height = `${height}px`;
  const rects = layoutHeatmap(visibleRows, width, height);
  root.querySelectorAll('.heat-tile').forEach((tile, i) => {
    const rect = rects[i];
    tile.style.left = `${rect.x}px`;
    tile.style.top = `${rect.y}px`;
    tile.style.width = `${rect.width}px`;
    tile.style.height = `${rect.height}px`;
    const compact = rect.width < 150 || rect.height < 170;
    tile.classList.toggle('compact', compact);
    tile.style.setProperty('--tile-name-size', `${Math.max(12, Math.min(compact ? 26 : 32, rect.width / 9, rect.height / (compact ? 6.6 : 4.8)))}px`);
    tile.style.setProperty('--tile-value-size', `${Math.max(20, Math.min(compact ? 40 : 50, rect.width / 5.8, rect.height / (compact ? 3.8 : 3)))}px`);
  });
}
new ResizeObserver(() => { if (visibleRows.length) positionTiles(); }).observe(root);

export function renderDashboard() {
  hideHeatmapPreview({ refresh: false });
  const visible = filteredResorts();
  const allRows = heatmapRows(visible);
  const capped = !state.showAllResorts && !state.searchQuery && allRows.length > CAP;
  visibleRows = capped ? allRows.slice(0, CAP) : allRows;
  const values = allRows.map((row) => row.value).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  root.replaceChildren();
  document.getElementById('metric-description').textContent = `Showing ${metric().description}`;
  document.getElementById('metric-size-note').textContent = metric().id === 'season' && seasonError ? seasonError : 'Larger tile = higher value';
  document.getElementById('resort-count').textContent = capped ? `${CAP} of ${visible.length} resorts` : `${visible.length} resorts`;
  document.getElementById('show-all-resorts').hidden = !capped;
  document.getElementById('show-all-resorts').textContent = `Show all ${visible.length}`;
  document.querySelectorAll('.metric-button').forEach((button) => {
    const active = button.dataset.metric === metric().id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('legend-high').textContent = metric().id === 'runsOpen' ? 'More runs open' : metric().id === 'score' ? 'Higher snow score' : metric().id === 'forecast72h' ? 'Higher forecast' : 'More snowfall';
  document.getElementById('legend-low').textContent = metric().id === 'runsOpen' ? 'Fewer runs open' : metric().id === 'score' ? 'Lower snow score' : metric().id === 'forecast72h' ? 'Lower forecast' : 'Less snowfall';
  if (!visible.length) {
    root.style.height = '430px';
    const empty = document.createElement('div');
    empty.className = 'heatmap-empty';
    empty.textContent = state.passFilter === 'favorites' ? 'No saved resorts yet. Explore the heatmap and save a resort from its preview or full details.' : 'No resorts match these filters. Try another region, pass, or search.';
    root.appendChild(empty);
    return;
  }
  for (const row of visibleRows) {
    const { resort, value } = row;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `heat-tile${value === null ? ' is-missing' : ''}${state.selectedId === resort.id ? ' selected' : ''}`;
    tile.dataset.resortId = resort.id;
    tile.classList.toggle('snow-demo-white', snowDemoWhite && row === visibleRows[0]);
    const color = heatColor(value, min, max);
    applyTileColor(tile, color);
    tile.setAttribute('aria-label', `${resort.name}, ${metric().label}: ${value === null ? 'Unavailable' : amount(value)}. Open resort details.`);
    tile.innerHTML = `<strong class="heat-name">${escape(resort.name)}</strong><span class="heat-value">${amount(value)}</span><span class="heat-period">${value === null ? 'Not available' : metric().caption}</span><span class="heat-source">${escape(provenance(resort))}</span>`;
    updateTileSnow(tile, resort);
    tile.addEventListener('pointerenter', (event) => { if (event.pointerType === 'touch' || preview.matches(':hover')) return; clearTimeout(showTimer); clearTimeout(hideTimer); showTimer = setTimeout(() => showPreview(resort, tile, true), 120); });
    tile.addEventListener('pointerleave', (event) => { clearTimeout(showTimer); if (!preview.contains(event.relatedTarget)) hideTimer = setTimeout(hideHeatmapPreview, 110); });
    tile.addEventListener('focus', () => showPreview(resort, tile));
    tile.addEventListener('blur', (event) => { if (!preview.contains(event.relatedTarget)) hideHeatmapPreview(); });
    tile.addEventListener('click', () => { hideHeatmapPreview(); onResortClick?.(resort); });
    root.appendChild(tile);
  }
  positionTiles();
  refreshCurrentSnow();
}

export async function loadHeatmapSeason() {
  try { catalog = await fetchSnowfallCatalog(); }
  catch (error) { seasonError = error.message; console.error('Season snowfall:', error); }
  renderDashboard();
}

export function renderUpdatedAt() {
  const element = document.getElementById('updated-at');
  if (!state.conditionsGeneratedAt) {
    element.textContent = state.conditionsLoadStatus === 'error' ? 'Conditions could not load · Unverified values withheld' : 'Conditions loading…';
    return;
  }
  const date = new Date(state.conditionsGeneratedAt);
  element.textContent = `${state.conditionsLoadStatus === 'stale' ? 'Resort snapshot stale · check source times' : 'Sources checked ' + date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${resorts.some(r => r.liveConditionsKind === 'model') ? ` · ${resorts.filter(r => r.liveSnowStatus === 'ready' && r.liveConditionsKind === 'model').length} model estimates` : ''}${resorts.some(r => r.liveTerrainStatus !== 'ready') ? ` · ${resorts.filter(r => r.liveTerrainStatus !== 'ready').length} terrain reports unavailable` : ''}`;
}

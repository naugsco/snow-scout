import { DEFAULT_WEBCAM_PAGES } from './constants.js?v=20261021-sources-verified';
import { state, setUseMetric, setTheme } from './state.js?v=20261021-sources-verified';
import { normalizeResortName, getSourceKeyForResort, webcamPages, withCacheBust } from './utils.js?v=20261021-sources-verified';
import { resorts } from './resorts.js?v=20261021-sources-verified';
import {
  viewer, createMarkerEntity, updateMarkerVisibility, updateMarkerStyles,
  syncHoverCardToEntity, screenSpaceHandler, resortForScreenPosition,
  flyToResort, updateZoomReadout, setAutoRotate
} from './cesium-map.js?v=20261021-sources-verified';
import { loadOptionalSourceData, loadLiveForecastForResort, expireStaleWeather } from './data-loader.js?v=20261021-sources-verified';
import {
  renderDashboard, renderFilters, renderUpdatedAt, filteredResorts,
  ensureSelectionVisible, toggleFavorite, setOnResortClick,
  setOnCompareToggle, loadHeatmapSeason, hideHeatmapPreview, refreshHeatmapPreview, reportPreviewForecastError
} from './dashboard.js?v=20261021-sources-verified';
import { HEATMAP_METRICS } from './heatmap-metrics.js?v=20261021-sources-verified';
import { icon, hydrateIcons } from './ui-icons.js?v=20261021-sources-verified';
import { renderDetailPanel, setActiveTab } from './detail-panel.js?v=20261021-sources-verified';
import { parseHash, updateHash, initRouter } from './router.js?v=20261021-sources-verified';
import { toggleCompareResort, refreshComparison } from './comparison.js?v=20261021-sources-verified';
import {
  toggleLayer, addLayer, setLayerOpacity, getActiveLayerIds, isLayerActive,
  toggleRadarAnimation, stopRadarAnimation, isAnimating, showRadarFrame, getRadarFrames,
  getRadarFrameIndex, formatRadarTime, setOnFrameChange, setOnLayerError
} from './weather-layers.js?v=20261021-sources-verified';

Object.assign(webcamPages, DEFAULT_WEBCAM_PAGES);
hydrateIcons();
resorts.forEach(createMarkerEntity);
viewer.useDefaultRenderLoop = false;
setAutoRotate(false);
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-115, 28, 18500000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-86), roll: 0 }
});

const searchInput = document.getElementById('search-input');
const mapDialog = document.getElementById('map-dialog');
const mapButton = document.getElementById('map-toggle');
const weatherPanel = document.getElementById('weather-panel');
const radarControls = document.getElementById('radar-controls');
const radarPlay = document.getElementById('radar-play');
const radarScrubber = document.getElementById('radar-scrubber');
const weatherStatus = document.getElementById('weather-status');
const weatherError = document.getElementById('owm-toast');
const hoverCard = document.getElementById('hover-card');
const dashboard = document.getElementById('dashboard');
let mapOpened = false;
let lastDetailTrigger = null;
let returnFromMap = null;
const syncHash = () => updateHash(state, resorts);
const visibleIds = () => new Set(filteredResorts().map((resort) => resort.id));

function focusResort(resort, { fly = !mapDialog.hidden } = {}) {
  lastDetailTrigger = document.activeElement;
  hideHeatmapPreview();
  state.selectedId = resort.id;
  renderDashboard();
  updateMarkerStyles();
  renderDetailPanel();
  document.getElementById('detail-close').focus({ preventScroll: true });
  syncHash();
  loadLiveForecastForResort(resort, onDataReady).catch((error) => console.error('Resort forecast:', error.message));
  if (fly && !mapDialog.hidden) flyToResort(resort);
}
function closeDetails() {
  state.selectedId = null;
  renderDashboard();
  updateMarkerStyles();
  renderDetailPanel();
  syncHash();
  if (lastDetailTrigger?.isConnected) lastDetailTrigger.focus({ preventScroll: true });
  else (mapDialog.hidden ? searchInput : document.getElementById('map-close')).focus({ preventScroll: true });
}
function onDataReady() {
  renderUpdatedAt();
  refreshComparison();
  renderDashboard();
  updateMarkerStyles();
  updateMarkerVisibility(visibleIds());
  renderDetailPanel();
}
function applyFilters() {
  ensureSelectionVisible();
  hideHeatmapPreview();
  renderFilters(selectPassFilter, selectRegionFilter);
  renderDashboard();
  updateMarkerVisibility(visibleIds());
  updateMarkerStyles();
  renderDetailPanel();
  syncHash();
}
function selectPassFilter(id) { state.passFilter = id; state.showAllResorts = false; applyFilters(); }
function selectRegionFilter(id) { state.regionFilter = id; state.showAllResorts = false; applyFilters(); }
setOnResortClick(focusResort);
setOnCompareToggle(toggleCompareResort);

const metricRoot = document.getElementById('metric-filters');
HEATMAP_METRICS.forEach((metric) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'metric-button';
  button.dataset.metric = metric.id;
  button.innerHTML = `${icon(metric.icon)}<span><strong>${metric.label}</strong><small>${metric.period}</small></span>`;
  if (metric.id === 'score') button.title = 'Existing snow score: 1.1 × 72h forecast + 1.35 × 24h snowfall − 0.8 × days since snow. Snow amounts are in inches.';
  button.addEventListener('click', () => { state.sortMode = metric.id; state.showAllResorts = false; applyFilters(); });
  metricRoot.appendChild(button);
});
searchInput.addEventListener('input', () => { state.searchQuery = searchInput.value; state.showAllResorts = false; applyFilters(); });
document.getElementById('show-all-resorts').addEventListener('click', () => { state.showAllResorts = true; renderDashboard(); });

const themeButton = document.getElementById('theme-toggle');
function updateThemeButton() { themeButton.innerHTML = icon(state.theme === 'light' ? 'sun' : 'moon'); }
if (state.theme === 'light') document.body.setAttribute('data-theme', 'light');
updateThemeButton();
themeButton.addEventListener('click', () => { setTheme(state.theme === 'light' ? 'dark' : 'light'); updateThemeButton(); });
const unitsButton = document.getElementById('unit-toggle');
function updateUnitsButton() { unitsButton.textContent = state.useMetric ? 'cm / °C' : 'in / °F'; }
updateUnitsButton();
unitsButton.addEventListener('click', () => { setUseMetric(!state.useMetric); updateUnitsButton(); renderDashboard(); if (state.selectedId) renderDetailPanel(); });

// An airport preference is saved locally; no illustrative fare is presented as live.
const airportRoot = document.getElementById('airport-control');
airportRoot.hidden = false;
airportRoot.innerHTML = `<label class="airport-preference">${icon('plane')}<span>From</span><input id="airport-input" maxlength="3" pattern="[A-Za-z]{3}" placeholder="IATA" aria-label="Departure airport, three-letter code" title="Set your departure airport (for example YVR)"></label>`;
const airportInput = document.getElementById('airport-input');
airportInput.value = localStorage.getItem('snow-scout-airport') || '';
function updateTravelPreview() {
  const root = document.getElementById('preview-travel');
  if (!root) return;
  root.className = 'preview-travel';
  root.innerHTML = `${icon('plane')}<div><span></span><strong>Flight prices coming soon</strong></div>`;
  root.querySelector('span').textContent = airportInput.value ? `From ${airportInput.value.toUpperCase()}` : 'Set your departure airport above';
}
airportInput.addEventListener('input', () => {
  airportInput.value = airportInput.value.toUpperCase().replace(/[^A-Z]/g, '');
  if (!airportInput.value || airportInput.value.length === 3) {
    localStorage.setItem('snow-scout-airport', airportInput.value);
    updateTravelPreview();
  }
});
airportInput.addEventListener('change', () => {
  if (airportInput.value && !airportInput.checkValidity()) { airportInput.reportValidity(); return; }
  localStorage.setItem('snow-scout-airport', airportInput.value);
  updateTravelPreview();
});
document.getElementById('heatmap-preview').addEventListener('preview-ready', (event) => {
  updateTravelPreview();
  const resort = event.detail.resort;
  if (resort.liveForecastStatus === 'ready' || resort.liveForecastStatus === 'loading') return;
  loadLiveForecastForResort(resort)
    .then(() => refreshHeatmapPreview(resort))
    .catch((error) => { reportPreviewForecastError(resort); console.error('Resort forecast:', error.message); });
});

document.getElementById('detail-favorite').addEventListener('click', () => { toggleFavorite(state.selectedId); renderDashboard(); renderDetailPanel(); });
document.getElementById('detail-close').addEventListener('click', closeDetails);
document.getElementById('detail-overlay').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeDetails(); });
document.querySelectorAll('.tab-btn').forEach((button) => button.addEventListener('click', () => { setActiveTab(button.dataset.tab); syncHash(); }));

function reportWeatherError(message) {
  weatherError.textContent = message;
  weatherError.style.display = 'block';
  weatherStatus.textContent = '';
}
setOnLayerError(reportWeatherError);
function updateWeatherUI() {
  const ids = getActiveLayerIds();
  document.querySelectorAll('.weather-layer-btn').forEach((button) => {
    const active = ids.has(button.dataset.layer);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  radarControls.style.display = isLayerActive('radar') ? 'flex' : 'none';
  document.getElementById('weather-toggle').classList.toggle('active', ids.size > 0);
  const frames = getRadarFrames();
  const index = getRadarFrameIndex();
  if (index >= 0 && frames[index]) {
    radarScrubber.max = frames.length - 1;
    radarScrubber.value = index;
    document.getElementById('radar-time').textContent = formatRadarTime(frames[index].time);
    document.getElementById('radar-badge').textContent = frames[index].forecast ? 'Forecast' : 'Observed · Past 2 hours';
  }
  radarPlay.innerHTML = icon(isAnimating() ? 'pause' : 'play');
  radarPlay.setAttribute('aria-label', isAnimating() ? 'Pause radar' : 'Play radar');
}
setOnFrameChange(updateWeatherUI);
async function changeLayer(id, enable = false) {
  const button = document.querySelector(`[data-layer="${id}"]`);
  button.disabled = true;
  weatherError.style.display = 'none';
  weatherStatus.textContent = 'Loading weather layer…';
  try {
    if (enable) await addLayer(id); else await toggleLayer(id);
    const labels = { clouds: 'Cloud', precipitation: 'Precipitation', temp: 'Temperature' };
    const active = [...getActiveLayerIds()];
    weatherStatus.textContent = isLayerActive('radar')
      ? 'Radar shows observed precipitation, not forecast snowfall. Coverage varies by region.'
      : active.length ? `${active.map((layer) => labels[layer]).join(', ')} overlay. Adjust opacity to compare with terrain.` : 'Choose a weather layer. Coverage varies by region.';
  } catch (error) { reportWeatherError(error.message); }
  finally { button.disabled = false; updateWeatherUI(); }
}
function mapAnimation() {
  if (mapDialog.hidden) return;
  updateMarkerStyles();
  syncHoverCardToEntity();
  requestAnimationFrame(mapAnimation);
}
async function openMap() {
  returnFromMap = document.activeElement;
  hideHeatmapPreview();
  mapDialog.hidden = false;
  document.body.classList.add('map-open');
  document.querySelector('.heatmap-app').inert = true;
  mapButton.setAttribute('aria-expanded', 'true');
  viewer.useDefaultRenderLoop = true;
  viewer.resize();
  viewer.scene.requestRender();
  updateZoomReadout();
  document.getElementById('map-close').focus();
  mapAnimation();
  weatherPanel.classList.add('visible');
  if (!mapOpened) {
    mapOpened = true;
    await changeLayer('radar', true);
    if (!isLayerActive('radar')) mapOpened = false; // allow an explicit reopen to retry.
  }
  updateWeatherUI();
}
function closeMap() {
  mapDialog.hidden = true;
  stopRadarAnimation();
  viewer.useDefaultRenderLoop = false;
  document.body.classList.remove('map-open');
  document.querySelector('.heatmap-app').inert = false;
  mapButton.setAttribute('aria-expanded', 'false');
  state.hoveredId = null;
  hoverCard.style.display = 'none';
  updateWeatherUI();
  (returnFromMap?.isConnected ? returnFromMap : mapButton).focus();
}
mapButton.addEventListener('click', openMap);
document.getElementById('map-close').addEventListener('click', closeMap);
mapDialog.addEventListener('click', (event) => { if (event.target === mapDialog) closeMap(); });
document.getElementById('weather-toggle').addEventListener('click', () => weatherPanel.classList.toggle('visible'));
document.getElementById('weather-close').addEventListener('click', () => weatherPanel.classList.remove('visible'));
document.querySelectorAll('.weather-layer-btn').forEach((button) => button.addEventListener('click', () => changeLayer(button.dataset.layer)));
document.getElementById('weather-opacity').addEventListener('input', (event) => setLayerOpacity(Number(event.target.value) / 100));
radarPlay.addEventListener('click', () => { toggleRadarAnimation(); updateWeatherUI(); });
radarScrubber.addEventListener('input', () => showRadarFrame(Number(radarScrubber.value)));

screenSpaceHandler.setInputAction((movement) => {
  if (state.isFlying) return;
  const resort = resortForScreenPosition(movement.endPosition);
  if (!resort) { state.hoveredId = null; hoverCard.style.display = 'none'; viewer.scene.canvas.style.cursor = 'grab'; return; }
  state.hoveredId = resort.id;
  viewer.scene.canvas.style.cursor = 'pointer';
  updateMarkerStyles();
  syncHoverCardToEntity();
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
viewer.scene.canvas.addEventListener('mouseleave', () => { state.hoveredId = null; hoverCard.style.display = 'none'; updateMarkerStyles(); });
screenSpaceHandler.setInputAction((movement) => {
  if (state.isFlying) return;
  const resort = resortForScreenPosition(movement.position);
  if (resort) focusResort(resort, { fly: true });
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
viewer.camera.moveStart.addEventListener(() => { hoverCard.style.display = 'none'; });
window.addEventListener('resize', () => { if (!mapDialog.hidden) { viewer.resize(); viewer.scene.requestRender(); updateZoomReadout(); } });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideHeatmapPreview();
    if (state.selectedId) closeDetails();
    else if (!mapDialog.hidden) closeMap();
    else if (searchInput.value) { searchInput.value = ''; state.searchQuery = ''; applyFilters(); }
    return;
  }
  const editing = event.target.closest('input, select, textarea');
  if (event.key === '/' && !editing && mapDialog.hidden) { event.preventDefault(); searchInput.focus(); }
  if (event.key === 'Tab') {
    const overlay = state.selectedId ? document.getElementById('detail-panel') : !mapDialog.hidden ? mapDialog : null;
    if (!overlay) return;
    const controls = [...overlay.querySelectorAll('button:not(:disabled), a[href], input, select, [tabindex="0"]')].filter((element) => element.getClientRects().length);
    if (!controls.length) return;
    if (event.shiftKey && (document.activeElement === controls[0] || !overlay.contains(document.activeElement))) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }
});
setInterval(() => {
  if (state.currentTab !== 'webcams') return;
  document.querySelectorAll('.webcam-media img[data-refreshable="true"]').forEach((image) => { if (image.dataset.baseUrl) image.src = withCacheBust(image.dataset.baseUrl); });
}, 45000);

const hashState = parseHash(resorts);
Object.assign(state, hashState);
if (!hashState.sortMode) state.sortMode = 'forecast72h';
renderFilters(selectPassFilter, selectRegionFilter);
renderDashboard();
updateMarkerVisibility(visibleIds());
if (state.selectedId) {
  const initial = resorts.find((resort) => resort.id === state.selectedId);
  if (initial) focusResort(initial, { fly: false });
  if (state.currentTab !== 'overview') setActiveTab(state.currentTab);
}
loadHeatmapSeason();
loadOptionalSourceData(onDataReady);
setInterval(() => expireStaleWeather(onDataReady), 60000);
setInterval(() => loadOptionalSourceData(onDataReady), 15 * 60000);
initRouter(resorts, (parsed) => {
  Object.assign(state, parsed);
  applyFilters();
  if (parsed.currentTab) setActiveTab(parsed.currentTab);
});
window.__SNOW_SCOUT__ = {
  getResorts: () => resorts,
  focusResortByName: (name, fly = false) => {
    const requested = normalizeResortName(name);
    const resort = resorts.find((item) => normalizeResortName(item.name) === requested || getSourceKeyForResort(item.name) === getSourceKeyForResort(name));
    if (!resort) return false;
    focusResort(resort, { fly });
    return true;
  }
};

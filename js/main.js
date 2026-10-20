import { DEFAULT_WEBCAM_PAGES } from './constants.js?v=20261020-painted-mountains';
import { loadSeasonChart, renderSeasonChart, setOnSeasonResortClick } from './season-chart.js?v=20261020-painted-mountains';
import { state, setUseMetric, setTheme } from './state.js?v=20261020-painted-mountains';
import { normalizeResortName, getSourceKeyForResort, webcamPages, withCacheBust } from './utils.js?v=20261020-painted-mountains';
import { resorts } from './resorts.js?v=20261020-painted-mountains';
import {
  viewer, createMarkerEntity, updateMarkerVisibility, updateMarkerStyles,
  syncHoverCardToEntity, screenSpaceHandler, resortForScreenPosition,
  flyToResort, updateZoomReadout, autoRotate, setAutoRotate
} from './cesium-map.js?v=20261020-painted-mountains';
import { loadOptionalSourceData, loadLiveForecastForResort } from './data-loader.js?v=20261020-painted-mountains';
import {
  renderDashboard, renderFilters, renderUpdatedAt, renderStormBanner,
  filteredResorts, ensureSelectionVisible, toggleFavorite, setOnResortClick,
  setOnCompareToggle, baseFilteredResorts, applyStatusFilter
} from './dashboard.js?v=20261020-painted-mountains';
import { renderDetailPanel, setActiveTab } from './detail-panel.js?v=20261020-painted-mountains';
import { parseHash, updateHash, initRouter } from './router.js?v=20261020-painted-mountains';
import { toggleCompareResort, clearCompare } from './comparison.js?v=20261020-painted-mountains';
import {
  toggleLayer, removeAllLayers, setLayerOpacity, getActiveLayerIds, isLayerActive,
  toggleRadarAnimation, isAnimating, showRadarFrame, getRadarFrames,
  getRadarFrameIndex, formatRadarTime, setOnFrameChange, getLayerOpacity
} from './weather-layers.js?v=20261020-painted-mountains';

// Initialize webcamPages with defaults
Object.assign(webcamPages, DEFAULT_WEBCAM_PAGES);

// Create markers for all resorts
resorts.forEach((resort) => createMarkerEntity(resort));

// Set initial camera view
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-115, 28, 18500000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-86), roll: 0 }
});
updateZoomReadout();

// Public API
window.__SNOW_SCOUT__ = {
  getResorts: () => resorts,
  focusResortByName: (name, fly = false) => {
    const requestedName = normalizeResortName(name);
    const sourceKey = getSourceKeyForResort(name);
    const resort = resorts.find((item) => {
      const resortName = normalizeResortName(item.name);
      return resortName === requestedName || resortName === sourceKey || getSourceKeyForResort(item.name) === sourceKey;
    });
    if (!resort) return false;
    focusResort(resort, { fly, openPanel: true });
    return true;
  }
};

// Core orchestration
function syncHash() {
  updateHash(state, resorts);
}

function focusResort(resort, options = {}) {
  state.highlightedResortId = null;
  state.selectedId = resort.id;
  renderDashboard();
  updateMarkerStyles();
  renderDetailPanel();
  syncHash();
  loadLiveForecastForResort(resort, onDataReady).catch(() => null);
  if (options.fly) flyToResort(resort);
}

function onDataReady() {
  renderUpdatedAt();
  renderStormBanner();
  updateMarkerStyles();
  renderDashboard();
  updateMarkerVisibility(new Set(filteredResorts().map((r) => r.id)));
  renderDetailPanel();
}

function getFilteredVisibleIds() {
  return new Set(filteredResorts().map((r) => r.id));
}

// Wire dashboard resort clicks
setOnResortClick((resort) => focusResort(resort, { fly: true, openPanel: true }));
setOnCompareToggle((id) => toggleCompareResort(id));
setOnSeasonResortClick((resort) => {
  // The chart includes every resort, even those hidden by the current filters.
  if (!filteredResorts().some((item) => item.id === resort.id)) {
    state.passFilter = 'all';
    state.regionFilter = 'all';
    state.statusFilter = 'all';
    state.searchQuery = '';
    searchInput.value = '';
  }
  state.showAllResorts = true;
  state.highlightedResortId = resort.id;
  renderFilters(selectPassFilter, selectRegionFilter);
  renderDashboard();
  updateMarkerVisibility(getFilteredVisibleIds());
  syncHash();
  const card = document.querySelector('.resort-item.chart-highlighted');
  card.focus({ preventScroll: true });
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});


// Filter actions
function selectPassFilter(id) {
  state.passFilter = id;
  ensureSelectionVisible();
  renderFilters(selectPassFilter, selectRegionFilter);
  renderDashboard();
  updateMarkerVisibility(getFilteredVisibleIds());
  updateMarkerStyles();
  renderDetailPanel();
  syncHash();
}

function selectRegionFilter(id) {
  state.regionFilter = id;
  ensureSelectionVisible();
  renderFilters(selectPassFilter, selectRegionFilter);
  renderDashboard();
  updateMarkerVisibility(getFilteredVisibleIds());
  updateMarkerStyles();
  renderDetailPanel();
  syncHash();
}

function selectStatusFilter(id) {
  state.statusFilter = state.statusFilter === id ? 'all' : id;
  state.selectedId = null;
  renderFilters(selectPassFilter, selectRegionFilter);
  renderDashboard();
  updateMarkerVisibility(getFilteredVisibleIds());
  updateMarkerStyles();
  renderDetailPanel();
  syncHash();
}

// Event listeners
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const hoverCard = document.getElementById('hover-card');

document.getElementById('focus-top-btn').addEventListener('click', () => {
  const resort = filteredResorts()[0];
  if (resort) focusResort(resort, { fly: true, openPanel: true });
});

// Theme toggle (dark ↔ light)
const themeToggleBtn = document.getElementById('theme-toggle');
if (state.theme === 'light') document.body.setAttribute('data-theme', 'light');
themeToggleBtn.textContent = state.theme === 'light' ? '☀' : '☾';
themeToggleBtn.addEventListener('click', () => {
  const newTheme = state.theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  themeToggleBtn.textContent = newTheme === 'light' ? '☀' : '☾';
});

// Unit toggle (imperial ↔ metric)
const unitToggleBtn = document.getElementById('unit-toggle');
unitToggleBtn.textContent = state.useMetric ? '°C' : '°F';
unitToggleBtn.addEventListener('click', () => {
  setUseMetric(!state.useMetric);
  unitToggleBtn.textContent = state.useMetric ? '°C' : '°F';
  renderSeasonChart();
  renderDashboard();
  renderStormBanner();
  if (state.selectedId) renderDetailPanel();
});

document.getElementById('incoming-filter').addEventListener('click', () => {
  selectStatusFilter('incoming');
});

document.getElementById('fresh-filter').addEventListener('click', () => {
  if (state.statusFilter === 'fresh') {
    // Cycle: 24h → 48h → 24h
    state.freshMode = state.freshMode === '24h' ? '48h' : '24h';
    state.selectedId = null;
    renderFilters(selectPassFilter, selectRegionFilter);
    renderDashboard();
    updateMarkerVisibility(getFilteredVisibleIds());
    updateMarkerStyles();
    renderDetailPanel();
    syncHash();
  } else {
    state.freshMode = '24h';
    selectStatusFilter('fresh');
  }
});

document.getElementById('dry-filter').addEventListener('click', () => {
  selectStatusFilter('dry');
});

document.getElementById('detail-favorite').addEventListener('click', () => {
  toggleFavorite(state.selectedId);
  renderDashboard();
  renderDetailPanel();
});

document.getElementById('detail-close').addEventListener('click', () => {
  state.selectedId = null;
  renderDashboard();
  updateMarkerStyles();
  renderDetailPanel();
  syncHash();
});

document.getElementById('detail-overlay').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) {
    state.selectedId = null;
    renderDashboard();
    updateMarkerStyles();
    renderDetailPanel();
    syncHash();
  }
});

document.querySelectorAll('.tab-btn').forEach((button) => {
  button.addEventListener('click', () => { setActiveTab(button.dataset.tab); syncHash(); });
});

searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value;
  state.showAllResorts = false;
  ensureSelectionVisible();
  renderDashboard();
  updateMarkerVisibility(getFilteredVisibleIds());
});

sortSelect.addEventListener('change', () => {
  state.sortMode = sortSelect.value;
  renderDashboard();
  syncHash();
});

document.getElementById('storm-banner-dismiss').addEventListener('click', () => {
  state.stormBannerDismissed = true;
  document.getElementById('storm-banner').style.display = 'none';
});

// Weather overlay controls
const weatherPanel = document.getElementById('weather-panel');
const weatherToggleBtn = document.getElementById('weather-toggle');
const radarControlsEl = document.getElementById('radar-controls');
const radarPlayBtn = document.getElementById('radar-play');
const radarScrubber = document.getElementById('radar-scrubber');
const radarTimeEl = document.getElementById('radar-time');
const radarBadgeEl = document.getElementById('radar-badge');
const weatherOpacityInput = document.getElementById('weather-opacity');

function updateWeatherBtnStates() {
  const activeIds = getActiveLayerIds();
  document.querySelectorAll('.weather-layer-btn').forEach((btn) => {
    btn.classList.toggle('active', activeIds.has(btn.dataset.layer));
  });
  radarControlsEl.style.display = isLayerActive('radar') ? 'flex' : 'none';
  weatherToggleBtn.classList.toggle('active', activeIds.size > 0);
}

function updateRadarUI() {
  const frames = getRadarFrames();
  const idx = getRadarFrameIndex();
  if (!frames.length || idx < 0) return;
  radarScrubber.max = frames.length - 1;
  radarScrubber.value = idx;
  radarTimeEl.textContent = formatRadarTime(frames[idx].time);
  const frame = frames[idx];
  radarBadgeEl.textContent = frame.forecast ? 'Forecast' : 'Observed';
  radarPlayBtn.classList.toggle('playing', isAnimating());
  radarPlayBtn.innerHTML = isAnimating() ? '&#9646;&#9646;' : '&#9654;';
}

setOnFrameChange(() => {
  updateRadarUI();
  updateWeatherBtnStates();
});

weatherToggleBtn.addEventListener('click', () => {
  const isOpen = weatherPanel.classList.contains('visible');
  if (isOpen) {
    weatherPanel.classList.remove('visible');
    removeAllLayers();
    updateWeatherBtnStates();
  } else {
    weatherPanel.classList.add('visible');
  }
});

document.getElementById('weather-close').addEventListener('click', () => {
  weatherPanel.classList.remove('visible');
  removeAllLayers();
  updateWeatherBtnStates();
});

document.querySelectorAll('.weather-layer-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    toggleLayer(btn.dataset.layer).then(() => updateWeatherBtnStates());
  });
});

weatherOpacityInput.addEventListener('input', () => {
  setLayerOpacity(Number(weatherOpacityInput.value) / 100);
});

radarPlayBtn.addEventListener('click', () => {
  toggleRadarAnimation();
  updateRadarUI();
});

radarScrubber.addEventListener('input', () => {
  showRadarFrame(Number(radarScrubber.value));
});

// Mobile map toggle
const mobileMapToggle = document.getElementById('mobile-map-toggle');
const mapArea = document.querySelector('.map-area');
mobileMapToggle.addEventListener('click', () => {
  const showing = mapArea.classList.toggle('mobile-visible');
  mobileMapToggle.classList.toggle('active', showing);
  document.getElementById('mobile-map-toggle-label').textContent = showing ? 'Hide Map' : 'Show Map';
  if (showing) {
    // Cesium needs a resize nudge after becoming visible
    setTimeout(() => viewer.resize(), 50);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.target.closest('#season-chart')) return;
  if (event.key === '/' && document.activeElement !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape') {
    if (document.activeElement === searchInput) {
      searchInput.value = '';
      state.searchQuery = '';
      searchInput.blur();
      renderDashboard();
      updateMarkerVisibility(getFilteredVisibleIds());
    } else if (state.selectedId) {
      state.selectedId = null;
      renderDashboard();
      updateMarkerStyles();
      renderDetailPanel();
      syncHash();
    }
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const visible = filteredResorts();
    if (!visible.length) return;
    const currentIndex = visible.findIndex((r) => r.id === state.selectedId);
    let nextIndex;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < visible.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : visible.length - 1;
    }
    event.preventDefault();
    focusResort(visible[nextIndex], { fly: false, openPanel: true });
  }
  if (event.key === 'Enter' && state.selectedId) {
    const resort = resorts.find((r) => r.id === state.selectedId);
    if (resort) focusResort(resort, { fly: true, openPanel: true });
  }
});

// Cesium interaction handlers
screenSpaceHandler.setInputAction((movement) => {
  if (state.isFlying) return;
  const resort = resortForScreenPosition(movement.endPosition);
  if (!resort) {
    if (state.hoveredId !== null) {
      state.hoveredId = null;
      updateMarkerStyles();
    }
    hoverCard.style.display = 'none';
    viewer.scene.canvas.style.cursor = 'grab';
    return;
  }
  if (state.hoveredId !== resort.id) {
    state.hoveredId = resort.id;
    updateMarkerStyles();
  }
  document.getElementById('hover-name').textContent = resort.name;
  document.getElementById('hover-copy').textContent = resort.statusText;
  hoverCard.style.display = 'block';
  hoverCard.style.left = `${movement.endPosition.x}px`;
  hoverCard.style.top = `${movement.endPosition.y}px`;
  viewer.scene.canvas.style.cursor = 'pointer';
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

viewer.scene.canvas.addEventListener('mouseleave', () => {
  state.hoveredId = null;
  hoverCard.style.display = 'none';
  viewer.scene.canvas.style.cursor = 'grab';
  updateMarkerStyles();
});

screenSpaceHandler.setInputAction((movement) => {
  if (state.isFlying) return;
  const resort = resortForScreenPosition(movement.position);
  if (!resort) return;
  focusResort(resort, { fly: true, openPanel: true });
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

viewer.camera.moveStart.addEventListener(() => {
  setAutoRotate(false);
  hoverCard.style.display = 'none';
});

addEventListener('resize', () => {
  viewer.scene.requestRender();
  updateZoomReadout();
});

// Webcam image refresh timer
setInterval(() => {
  if (state.currentTab !== 'webcams') return;
  document.querySelectorAll('.webcam-media img[data-refreshable="true"]').forEach((image) => {
    const baseUrl = image.dataset.baseUrl;
    if (baseUrl) image.src = withCacheBust(baseUrl);
  });
}, 45000);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (autoRotate && !state.isFlying && !state.selectedId) {
    viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.00018);
  }
  updateMarkerStyles();
  syncHoverCardToEntity();
}

// Apply URL hash state before initial render
const hashState = parseHash(resorts);
if (hashState.passFilter) state.passFilter = hashState.passFilter;
if (hashState.regionFilter) state.regionFilter = hashState.regionFilter;
if (hashState.sortMode) state.sortMode = hashState.sortMode;
if (hashState.statusFilter) state.statusFilter = hashState.statusFilter;
if (hashState.currentTab) state.currentTab = hashState.currentTab;
if (hashState.selectedId) state.selectedId = hashState.selectedId;

// Sync sort select to state
sortSelect.value = state.sortMode;

// Initial render
loadSeasonChart();
renderFilters(selectPassFilter, selectRegionFilter);
renderDashboard();
if (state.selectedId) {
  renderDetailPanel();
  if (state.currentTab !== 'overview') setActiveTab(state.currentTab);
  const initResort = resorts.find((r) => r.id === state.selectedId);
  if (initResort) {
    loadLiveForecastForResort(initResort, onDataReady).catch(() => null);
    flyToResort(initResort);
  }
} else {
  document.getElementById('detail-overlay').style.display = 'none';
}
updateMarkerVisibility(getFilteredVisibleIds());
loadOptionalSourceData(onDataReady);

// Listen for hash changes
initRouter(resorts, (parsed) => {
  if (parsed.passFilter) state.passFilter = parsed.passFilter;
  if (parsed.regionFilter) state.regionFilter = parsed.regionFilter;
  if (parsed.sortMode) { state.sortMode = parsed.sortMode; sortSelect.value = parsed.sortMode; }
  if (parsed.statusFilter) state.statusFilter = parsed.statusFilter;
  if (parsed.currentTab) setActiveTab(parsed.currentTab);
  if (parsed.selectedId) {
    const resort = resorts.find((r) => r.id === parsed.selectedId);
    if (resort) focusResort(resort, { fly: true, openPanel: true });
  }
  renderFilters(selectPassFilter, selectRegionFilter);
  renderDashboard();
  updateMarkerVisibility(getFilteredVisibleIds());
  updateMarkerStyles();
  renderDetailPanel();
});

animate();

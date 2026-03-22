import { DEFAULT_WEBCAM_PAGES } from './constants.js';
import { state } from './state.js';
import { normalizeResortName, getSourceKeyForResort, webcamPages, withCacheBust } from './utils.js';
import { resorts } from './resorts.js';
import {
  viewer, createMarkerEntity, updateMarkerVisibility, updateMarkerStyles,
  syncHoverCardToEntity, screenSpaceHandler, resortForScreenPosition,
  flyToResort, updateZoomReadout, autoRotate, setAutoRotate
} from './cesium-map.js';
import { loadOptionalSourceData, loadLiveForecastForResort } from './data-loader.js';
import {
  renderDashboard, renderFilters, renderUpdatedAt, renderStormBanner,
  filteredResorts, ensureSelectionVisible, toggleFavorite, setOnResortClick,
  setOnCompareToggle, baseFilteredResorts, applyStatusFilter
} from './dashboard.js';
import { renderDetailPanel, setActiveTab } from './detail-panel.js';
import { parseHash, updateHash, initRouter } from './router.js';
import { toggleCompareResort, clearCompare } from './comparison.js';

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

document.getElementById('detail-sources').addEventListener('click', (event) => {
  const button = event.target.closest('.source-link');
  if (!button?.dataset.tab) return;
  setActiveTab(button.dataset.tab);
  syncHash();
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

document.addEventListener('keydown', (event) => {
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
import { viewer } from './cesium-map.js?v=20261020-painted-mountains';

// ============================================================
// Weather layer state — supports multiple simultaneous layers
// ============================================================
const activeLayers = new Map();   // layerId → Cesium ImageryLayer (for OWM layers)
let layerOpacity = 0.6;
let radarFrames = [];         // [{time, path, forecast?}]
let radarFrameIndex = -1;
let radarAnimTimer = null;
let radarHost = '';
let onFrameChange = null;     // callback for UI updates
let owmKey = null;            // loaded from config.json
let owmKeyLoaded = false;

// Pre-cached radar imagery layers for smooth animation (no blinking)
let radarLayers = [];         // parallel array to radarFrames

// ============================================================
// Config loader — fetch API key from gitignored config
// ============================================================
async function ensureOwmKey() {
  if (owmKeyLoaded) return owmKey;
  owmKeyLoaded = true;
  try {
    const res = await fetch('./data/config.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const config = await res.json();
    owmKey = config.owmApiKey || null;
  } catch {
    owmKey = null;
  }
  return owmKey;
}

// ============================================================
// RainViewer radar
// ============================================================
async function fetchRadarFrames() {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  const data = await res.json();
  radarHost = data.host || 'https://tilecache.rainviewer.com';
  radarFrames = (data.radar?.past || []).map((f) => ({
    time: f.time,
    path: f.path
  }));
  // Add nowcast frames if available
  if (data.radar?.nowcast?.length) {
    data.radar.nowcast.forEach((f) => radarFrames.push({ time: f.time, path: f.path, forecast: true }));
  }
  return radarFrames;
}

function createRadarProvider(frame) {
  // color 6 = universal blue, smooth 1, snow 1
  const url = `${radarHost}${frame.path}/256/{z}/{x}/{y}/6/1_1.png`;
  return new Cesium.UrlTemplateImageryProvider({
    url,
    minimumLevel: 0,
    maximumLevel: 7,
    credit: new Cesium.Credit('<a href="https://www.rainviewer.com" target="_blank">RainViewer</a>')
  });
}

/**
 * Pre-add all radar frames as hidden imagery layers so we can
 * swap between them instantly (toggle show/alpha) without the
 * add-remove cycle that causes blinking.
 */
function buildRadarLayerCache() {
  // Remove any existing cached layers
  clearRadarLayerCache();
  radarLayers = radarFrames.map((frame) => {
    const provider = createRadarProvider(frame);
    const layer = viewer.imageryLayers.addImageryProvider(provider);
    layer.alpha = 0;   // hidden initially
    layer.show = false;
    return layer;
  });
}

function clearRadarLayerCache() {
  radarLayers.forEach((layer) => {
    try { viewer.imageryLayers.remove(layer, false); } catch { /* already removed */ }
  });
  radarLayers = [];
}

// ============================================================
// OpenWeatherMap layers (cached providers to avoid redundant tile fetches)
// ============================================================
const owmProviderCache = new Map();

function createOwmProvider(layer, key) {
  if (owmProviderCache.has(layer)) return owmProviderCache.get(layer);
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${key}`,
    minimumLevel: 0,
    maximumLevel: 6,
    credit: new Cesium.Credit('<a href="https://openweathermap.org" target="_blank">OpenWeatherMap</a>')
  });
  owmProviderCache.set(layer, provider);
  return provider;
}

const OWM_LAYERS = {
  clouds: 'clouds_new',
  precipitation: 'precipitation_new',
  temp: 'temp_new'
};

// ============================================================
// Public API
// ============================================================
export function setOnFrameChange(cb) {
  onFrameChange = cb;
}

export function getLayerOpacity() {
  return layerOpacity;
}

export function getActiveLayerId() {
  // Return first active layer for backwards compat, or null
  if (activeLayers.size === 0 && !radarLayers.length) return null;
  // Check radar first
  if (radarLayers.length) return 'radar';
  const ids = Array.from(activeLayers.keys());
  return ids[0] || null;
}

export function getActiveLayerIds() {
  const ids = new Set(activeLayers.keys());
  if (radarLayers.length) ids.add('radar');
  return ids;
}

export function getRadarFrames() {
  return radarFrames;
}

export function getRadarFrameIndex() {
  return radarFrameIndex;
}

export function isAnimating() {
  return radarAnimTimer !== null;
}

export function isLayerActive(id) {
  if (id === 'radar') return radarLayers.length > 0;
  return activeLayers.has(id);
}

export function removeLayer(id) {
  if (id === 'radar') {
    stopRadarAnimation();
    clearRadarLayerCache();
    radarFrameIndex = -1;
  } else if (activeLayers.has(id)) {
    const layer = activeLayers.get(id);
    viewer.imageryLayers.remove(layer, false);
    activeLayers.delete(id);
  }
}

export function removeAllLayers() {
  // Remove all OWM layers
  activeLayers.forEach((layer) => {
    viewer.imageryLayers.remove(layer, false);
  });
  activeLayers.clear();
  // Clear radar
  stopRadarAnimation();
  clearRadarLayerCache();
  radarFrameIndex = -1;
}

export async function toggleLayer(id) {
  if (isLayerActive(id)) {
    removeLayer(id);
    return;
  }
  await addLayer(id);
}

export async function addLayer(id) {
  if (isLayerActive(id)) return;

  if (id === 'radar') {
    if (!radarFrames.length) await fetchRadarFrames();
    if (!radarFrames.length) return;
    buildRadarLayerCache();
    radarFrameIndex = radarFrames.length - 1;
    radarLayers[radarFrameIndex].show = true;
    radarLayers[radarFrameIndex].alpha = layerOpacity;
    if (onFrameChange) onFrameChange();
  } else if (OWM_LAYERS[id]) {
    const key = await ensureOwmKey();
    if (!key) return;
    const provider = createOwmProvider(OWM_LAYERS[id], key);
    const layer = viewer.imageryLayers.addImageryProvider(provider);
    layer.alpha = layerOpacity;
    activeLayers.set(id, layer);
  }
}

// Legacy single-layer API (kept for backwards compat)
export function removeActiveLayer() {
  removeAllLayers();
}

export async function showLayer(id) {
  await toggleLayer(id);
}

export function setLayerOpacity(value) {
  layerOpacity = value;
  // Update all active OWM layers
  activeLayers.forEach((layer) => {
    layer.alpha = value;
  });
  // Also update the currently visible radar frame
  if (radarLayers.length && radarFrameIndex >= 0 && radarFrameIndex < radarLayers.length) {
    radarLayers[radarFrameIndex].alpha = value;
  }
}

// ============================================================
// Radar animation — smooth frame swapping via show/hide
// ============================================================
export function showRadarFrame(index) {
  if (!radarLayers.length || index < 0 || index >= radarLayers.length) return;
  // Hide current frame
  if (radarFrameIndex >= 0 && radarFrameIndex < radarLayers.length) {
    radarLayers[radarFrameIndex].show = false;
    radarLayers[radarFrameIndex].alpha = 0;
  }
  // Show new frame
  radarFrameIndex = index;
  radarLayers[index].show = true;
  radarLayers[index].alpha = layerOpacity;
  if (onFrameChange) onFrameChange();
}

export function startRadarAnimation(intervalMs = 500) {
  if (radarAnimTimer) return;
  if (!radarLayers.length) return;
  radarAnimTimer = setInterval(() => {
    const next = (radarFrameIndex + 1) % radarLayers.length;
    showRadarFrame(next);
  }, intervalMs);
}

export function stopRadarAnimation() {
  if (radarAnimTimer) {
    clearInterval(radarAnimTimer);
    radarAnimTimer = null;
  }
}

export function toggleRadarAnimation() {
  if (radarAnimTimer) stopRadarAnimation();
  else startRadarAnimation();
}

export function formatRadarTime(unixTime) {
  const d = new Date(unixTime * 1000);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

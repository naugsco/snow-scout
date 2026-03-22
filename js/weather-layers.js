import { viewer } from './cesium-map.js';

// ============================================================
// Weather layer state
// ============================================================
let activeLayer = null;       // current Cesium ImageryLayer
let activeLayerId = null;     // 'radar' | 'clouds' | 'precipitation' | 'snow' | 'temp'
let layerOpacity = 0.6;
let radarFrames = [];         // [{time, path}]
let radarFrameIndex = -1;
let radarAnimTimer = null;
let radarHost = '';
let onFrameChange = null;     // callback for UI updates
let owmKey = null;            // loaded from config.json
let owmKeyLoaded = false;

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
  return activeLayerId;
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

export function removeActiveLayer() {
  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer, false);
    activeLayer = null;
  }
  stopRadarAnimation();
  activeLayerId = null;
  radarFrameIndex = -1;
}

export async function showLayer(id) {
  removeActiveLayer();
  activeLayerId = id;

  if (id === 'radar') {
    if (!radarFrames.length) await fetchRadarFrames();
    if (!radarFrames.length) return;
    radarFrameIndex = radarFrames.length - 1; // start at most recent
    const provider = createRadarProvider(radarFrames[radarFrameIndex]);
    activeLayer = viewer.imageryLayers.addImageryProvider(provider);
    activeLayer.alpha = layerOpacity;
    if (onFrameChange) onFrameChange();
  } else if (OWM_LAYERS[id]) {
    const key = await ensureOwmKey();
    if (!key) {
      activeLayerId = null;
      return;
    }
    const provider = createOwmProvider(OWM_LAYERS[id], key);
    activeLayer = viewer.imageryLayers.addImageryProvider(provider);
    activeLayer.alpha = layerOpacity;
  }
}

export function setLayerOpacity(value) {
  layerOpacity = value;
  if (activeLayer) activeLayer.alpha = value;
}

// ============================================================
// Radar animation
// ============================================================
export function showRadarFrame(index) {
  if (!radarFrames.length || index < 0 || index >= radarFrames.length) return;
  radarFrameIndex = index;
  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer, false);
  }
  const provider = createRadarProvider(radarFrames[index]);
  activeLayer = viewer.imageryLayers.addImageryProvider(provider);
  activeLayer.alpha = layerOpacity;
  if (onFrameChange) onFrameChange();
}

export function startRadarAnimation(intervalMs = 500) {
  if (radarAnimTimer) return;
  if (!radarFrames.length) return;
  radarAnimTimer = setInterval(() => {
    const next = (radarFrameIndex + 1) % radarFrames.length;
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

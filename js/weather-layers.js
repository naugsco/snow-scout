export function createWeatherLayers(viewer) {
  // ============================================================
  // Weather layer state — supports multiple simultaneous layers
  // ============================================================
  const activeLayers = new Map();   // layerId → Cesium ImageryLayer (for OWM layers)
  let layerOpacity = 0.6;
  let disposed = false;
  let radarFrames = [];         // [{time, path}]
  let radarFrameIndex = -1;
  let radarAnimTimer = null;
  let radarHost = '';
  let onFrameChange = null;     // callback for UI updates
  let owmKey = null;            // loaded from config.json
  let owmKeyLoaded = false;
  const pendingLayers = new Map();
  let onLayerError = null;
  const observedProviders = new WeakSet();
  function setOnLayerError(callback) { onLayerError = callback; }

  // Sparse cache: at most three radar frames are retained.
  let radarLayers = [];         // parallel array to radarFrames

  // ============================================================
  // Config loader — fetch API key from gitignored config
  // ============================================================
  async function ensureOwmKey() {
    if (owmKeyLoaded) return owmKey;
    const res = await fetch('./data/config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Cloud, precipitation and temperature layers need the OpenWeather configuration.');
    const config = await res.json();
    owmKey = config.owmApiKey || null;
    if (!owmKey) throw new Error('An OpenWeather API key is required for this weather layer.');
    owmKeyLoaded = true;
    return owmKey;
  }

  // ============================================================
  // RainViewer radar
  // ============================================================
  async function fetchRadarFrames() {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!res.ok) throw new Error(`Radar is unavailable (HTTP ${res.status}).`);
    const data = await res.json();
    if (!data.host || !Array.isArray(data.radar?.past) || !data.radar.past.length) throw new Error('Radar returned no observed frames.');
    radarHost = data.host;
    radarFrames = (data.radar?.past || []).map((f) => ({
      time: f.time,
      path: f.path
    }));
    // The public API supplies observed radar, not snowfall forecasts.
    return radarFrames;
  }

  function createRadarProvider(frame) {
    // color 6 = universal blue, smooth 1, snow 1
    const url = `${radarHost}${frame.path}/256/{z}/{x}/{y}/6/1_1.png`;
    return new Cesium.UrlTemplateImageryProvider({
      url,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      minimumLevel: 0,
      maximumLevel: 7,
      credit: new Cesium.Credit('<a href="https://www.rainviewer.com" target="_blank">RainViewer</a>')
    });
  }

  /**
   * Create radar layers on demand instead of retaining the entire timeline.
   */
  function radarLayerAt(index) {
    if (!radarLayers[index]) {
      const provider = createRadarProvider(radarFrames[index]);
      observeProvider(provider, 'Radar');
      const layer = viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha = 0;
      layer.show = false;
      radarLayers[index] = layer;
    }
    return radarLayers[index];
  }

  function buildRadarLayerCache() {
    clearRadarLayerCache();
    radarLayerAt(radarFrames.length - 1);
  }

  function clearRadarLayerCache() {
    radarLayers.forEach(layer => viewer.imageryLayers.remove(layer, true));
    radarLayers = [];
  }

  // ============================================================
  // OpenWeatherMap layers (cached providers to avoid redundant tile fetches)
  // ============================================================
  const owmProviderCache = new Map();

  function createOwmProvider(layer, key) {
    if (owmProviderCache.has(layer)) return owmProviderCache.get(layer);
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${encodeURIComponent(key)}`,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      minimumLevel: 0,
      maximumLevel: 6,
      credit: new Cesium.Credit('<a href="https://openweathermap.org" target="_blank">OpenWeatherMap</a>')
    });
    owmProviderCache.set(layer, provider);
    return provider;
  }

  async function verifyTile(url, label) {
    let response;
    try { response = await fetch(url); }
    catch { throw new Error(`${label} could not connect to its weather provider. Please retry.`); }
    if (!response.ok) throw new Error(`${label} is unavailable (HTTP ${response.status}). Check the provider configuration.`);
    if (!response.headers.get('content-type')?.includes('image/')) throw new Error(`${label} returned an invalid weather tile.`);
  }

  function observeProvider(provider, label) {
    if (observedProviders.has(provider)) return;
    observedProviders.add(provider);
    provider.errorEvent.addEventListener(() => {
      if (disposed) return;
      onLayerError?.(`${label} could not load a map tile. Try again or check the provider configuration.`);
    });
  }

  const OWM_LAYERS = {
    clouds: 'clouds_new',
    precipitation: 'precipitation_new',
    temp: 'temp_new'
  };

  // ============================================================
  // Public API
  // ============================================================
  function setOnFrameChange(cb) {
    onFrameChange = cb;
  }

  function getLayerOpacity() {
    return layerOpacity;
  }

  function getActiveLayerId() {
    // Return first active layer for backwards compat, or null
    if (activeLayers.size === 0 && !radarLayers.length) return null;
    // Check radar first
    if (radarLayers.length) return 'radar';
    const ids = Array.from(activeLayers.keys());
    return ids[0] || null;
  }

  function getActiveLayerIds() {
    const ids = new Set(activeLayers.keys());
    if (radarLayers.length) ids.add('radar');
    return ids;
  }

  function getRadarFrames() {
    return radarFrames;
  }

  function getRadarFrameIndex() {
    return radarFrameIndex;
  }

  function isAnimating() {
    return radarAnimTimer !== null;
  }

  function isLayerActive(id) {
    if (id === 'radar') return radarLayers.length > 0;
    return activeLayers.has(id);
  }

  function removeLayer(id) {
    if (id === 'radar') {
      stopRadarAnimation();
      clearRadarLayerCache();
      radarFrameIndex = -1;
    } else if (activeLayers.has(id)) {
      const layer = activeLayers.get(id);
      viewer.imageryLayers.remove(layer, true);
      activeLayers.delete(id);
    }
  }

  function destroy() { disposed = true; removeAllLayers(); }

  function removeAllLayers() {
    // Remove all OWM layers
    activeLayers.forEach((layer) => {
      viewer.imageryLayers.remove(layer, true);
    });
    activeLayers.clear();
    // Clear radar
    stopRadarAnimation();
    clearRadarLayerCache();
    radarFrameIndex = -1;
  }

  async function toggleLayer(id) {
    if (isLayerActive(id)) {
      removeLayer(id);
      return;
    }
    await addLayer(id);
  }

  async function addLayer(id) {
    if (disposed) throw new Error('Weather map has been closed.');
    if (isLayerActive(id)) {
      if (id !== 'radar' || Date.now() / 1000 - radarFrames.at(-1).time <= 900) return;
      removeLayer(id);
    }
    if (pendingLayers.has(id)) return pendingLayers.get(id);
    const task = (async () => {
      if (id === 'radar') {
        if (!radarFrames.length || Date.now() / 1000 - radarFrames[radarFrames.length - 1].time > 900) await fetchRadarFrames();
        const latest = radarFrames[radarFrames.length - 1];
        if (Date.now() / 1000 - latest.time > 1800) throw new Error('Radar observations are more than 30 minutes old. Please retry later.');
        await verifyTile(`${radarHost}${latest.path}/256/0/0/0/6/1_1.png`, 'Radar');
        if (disposed) return;
        buildRadarLayerCache();
        radarFrameIndex = radarFrames.length - 1;
        radarLayers[radarFrameIndex].show = true;
        radarLayers[radarFrameIndex].alpha = layerOpacity;
        if (onFrameChange) onFrameChange();
      } else if (OWM_LAYERS[id]) {
        const key = await ensureOwmKey();
        const label = { clouds: 'Clouds', precipitation: 'Precipitation', temp: 'Temperature' }[id];
        await verifyTile(`https://tile.openweathermap.org/map/${OWM_LAYERS[id]}/0/0/0.png?appid=${encodeURIComponent(key)}`, label);
        if (disposed) return;
        const provider = createOwmProvider(OWM_LAYERS[id], key);
        observeProvider(provider, label);
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = layerOpacity;
        activeLayers.set(id, layer);
      } else throw new Error(`Unknown weather layer: ${id}`);
    })();
    pendingLayers.set(id, task);
    try { await task; }
    finally { pendingLayers.delete(id); }
  }

  // Legacy single-layer API (kept for backwards compat)
  function removeActiveLayer() {
    removeAllLayers();
  }

  async function showLayer(id) {
    await toggleLayer(id);
  }

  function setLayerOpacity(value) {
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
  function showRadarFrame(index) {
    if (!radarLayers.length || index < 0 || index >= radarFrames.length) return;
    // Hide current frame
    if (radarFrameIndex >= 0 && radarFrameIndex < radarLayers.length) {
      radarLayers[radarFrameIndex].show = false;
      radarLayers[radarFrameIndex].alpha = 0;
    }
    // Show new frame
    radarFrameIndex = index;
    const layer = radarLayerAt(index);
    layer.show = true;
    layer.alpha = layerOpacity;
    // Retain only the current, previous, and next frames on mobile and desktop.
    const keep = new Set([index, (index + 1) % radarFrames.length, (index - 1 + radarFrames.length) % radarFrames.length]);
    radarLayers.forEach((cached, frameIndex) => {
      if (!keep.has(frameIndex)) {
        viewer.imageryLayers.remove(cached, true);
        delete radarLayers[frameIndex];
      }
    });
    if (onFrameChange) onFrameChange();
  }

  function startRadarAnimation(intervalMs = 1200) {
    if (radarAnimTimer) return;
    if (!radarLayers.length) return;
    radarAnimTimer = setInterval(() => {
      const next = (radarFrameIndex + 1) % radarFrames.length;
      showRadarFrame(next);
    }, intervalMs);
  }

  function stopRadarAnimation() {
    if (radarAnimTimer) {
      clearInterval(radarAnimTimer);
      radarAnimTimer = null;
    }
  }

  function toggleRadarAnimation() {
    if (radarAnimTimer) stopRadarAnimation();
    else startRadarAnimation();
  }

  function formatRadarTime(unixTime) {
    const d = new Date(unixTime * 1000);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return {
    destroy, setOnLayerError, setOnFrameChange, getLayerOpacity, getActiveLayerId,
    getActiveLayerIds, getRadarFrames, getRadarFrameIndex, isAnimating,
    isLayerActive, removeLayer, removeAllLayers, toggleLayer, addLayer,
    removeActiveLayer, showLayer, setLayerOpacity, showRadarFrame,
    startRadarAnimation, stopRadarAnimation, toggleRadarAnimation, formatRadarTime
  };
}

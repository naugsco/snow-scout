import { icon } from './ui-icons.js?v=20261021-sources-verified';

export function bindWeatherControls(weather, root = document, onChange = () => {}) {
  const {
    toggleLayer, addLayer, setLayerOpacity, getActiveLayerIds, isLayerActive,
    toggleRadarAnimation, isAnimating, showRadarFrame, getRadarFrames,
    getRadarFrameIndex, formatRadarTime, setOnFrameChange, setOnLayerError
  } = weather;
  const el = id => root.querySelector('#' + id);
  const weatherPanel = el('weather-panel');
  const radarControls = el('radar-controls');
  const radarPlay = el('radar-play');
  const radarScrubber = el('radar-scrubber');
  const weatherStatus = el('weather-status');
  const weatherError = el('owm-toast');
  function reportWeatherError(message) {
    weatherError.textContent = message;
    weatherError.style.display = 'block';
    weatherStatus.textContent = '';
  }
  setOnLayerError(reportWeatherError);
  function updateWeatherUI() {
    const ids = getActiveLayerIds();
    onChange(ids);
    root.querySelectorAll('.weather-layer-btn').forEach((button) => {
      const active = ids.has(button.dataset.layer);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    radarControls.style.display = isLayerActive('radar') ? 'flex' : 'none';
    el('weather-toggle').classList.toggle('active', ids.size > 0);
    const frames = getRadarFrames();
    const index = getRadarFrameIndex();
    if (index >= 0 && frames[index]) {
      radarScrubber.max = frames.length - 1;
      radarScrubber.value = index;
      el('radar-time').textContent = formatRadarTime(frames[index].time);
      el('radar-badge').textContent = 'Observed · ' + new Date(frames[index].time * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    radarPlay.innerHTML = icon(isAnimating() ? 'pause' : 'play');
    radarPlay.setAttribute('aria-label', isAnimating() ? 'Pause radar' : 'Play radar');
  }
  setOnFrameChange(updateWeatherUI);
  async function changeLayer(id, enable = false) {
    const button = root.querySelector(`[data-layer="${id}"]`);
    button.disabled = true;
    weatherError.style.display = 'none';
    weatherStatus.textContent = 'Loading weather layer…';
    try {
      if (enable) await addLayer(id); else await toggleLayer(id);
      const labels = { clouds: 'Cloud', precipitation: 'Precipitation', temp: 'Temperature' };
      const active = [...getActiveLayerIds()];
      weatherStatus.textContent = isLayerActive('radar')
        ? 'Observed radar · Regional resolution, not trail-level snowfall. Coverage varies by region.'
        : active.length ? `${active.map((layer) => labels[layer]).join(', ')} overlay. Adjust opacity to compare with terrain.` : 'Choose a weather layer. Coverage varies by region.';
    } catch (error) { reportWeatherError(error.message); }
    finally { button.disabled = false; updateWeatherUI(); }
  }
  el('weather-toggle').addEventListener('click', () => weatherPanel.classList.toggle('visible'));
  el('weather-close').addEventListener('click', () => weatherPanel.classList.remove('visible'));
  root.querySelectorAll('.weather-layer-btn').forEach((button) => button.addEventListener('click', () => changeLayer(button.dataset.layer)));
  el('weather-opacity').addEventListener('input', (event) => {
    setLayerOpacity(Number(event.target.value) / 100);
    updateWeatherUI();
  });
  radarPlay.addEventListener('click', () => { toggleRadarAnimation(); updateWeatherUI(); });
  radarScrubber.addEventListener('input', () => showRadarFrame(Number(radarScrubber.value)));

  updateWeatherUI();
  return { changeLayer, updateWeatherUI, reportWeatherError };
}

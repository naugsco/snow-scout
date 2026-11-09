import { selectWebcams, attachCameraError, webcamCatalogState } from './webcams.js?v=20261109-audit';
import { potentialPowderDays } from './forecast-planning.js?v=20261109-16day';
import { preservationExplanation } from './snow-preservation.js?v=20261109-preservation';
import './detail-card.js?v=20261109-selectable-bars';
import { state } from './state.js?v=20261021-sources-verified';
import {
  formatInches, formatTemperature, formatRunAccess, formatPassLabel,
  getPassTone, getSourceKeyForResort, getConditionsPageForResort, getWebcamPageForResort,
  withCacheBust, webcamStreams
} from './utils.js?v=20261106-mountain-weather';
import { resorts } from './resorts.js?v=20261021-sources-verified';
import { weatherLocation, weatherLocationLabel } from './weather-location.js?v=20261106-mountain-weather';
import { createSnowfallChart } from './snowfall-chart.js?v=20261109-selectable-bars';
import { TRAIL_MAP_VIEWPORTS } from './trail-map-viewports.js?v=20261021-sources-verified';
import { mountainUrl } from './mountain-config.js?v=20261021-sources-verified';
import { renderTravelPanel } from './travel-panel.js?v=20261109-selectable-bars';

const selectedResort = () => resorts.find(resort => resort.id === state.selectedId);
const favoriteGlyph = id => state.favorites.has(id) ? '★' : '☆';

const detailOverlay = document.getElementById('detail-overlay');
const detailPanel = document.getElementById('detail-panel');
const detailName = document.getElementById('detail-name');
const detailMeta = document.getElementById('detail-meta');
const detailFavorite = document.getElementById('detail-favorite');
const runOpenCopy = document.getElementById('run-open-copy');
const runOpenBar = document.getElementById('run-open-bar');
const detailNote = document.getElementById('detail-note');
const forecastDayDetails = document.getElementById('forecast-day-details');
let forecastSelection = {resortId:null,date:null};
const forecastActions = document.getElementById('forecast-actions');
const webcamList = document.getElementById('webcam-list');
const webcamCount = document.getElementById('webcam-count');
const trailMapFrame = document.getElementById('trail-map-frame');
const trailMapActions = document.getElementById('trail-map-actions');
const trailMapNote = document.getElementById('trail-map-note');
const trailMapCopy = document.getElementById('trail-map-copy');

function getTrailMapViewport(resort) {
  return TRAIL_MAP_VIEWPORTS[resort.name] || null;
}

function buildOpenSkiMapUrl(resort, zoom = 13.7) {
  const viewport = getTrailMapViewport(resort);
  if (viewport) {
    const [lon, lat] = viewport.center;
    const bearing = Number.isFinite(viewport.bearing) ? viewport.bearing : 0;
    const targetZoom = Number.isFinite(viewport.zoom) ? viewport.zoom : zoom;
    const params = new URLSearchParams({
      obj: viewport.id,
      obj_type: 'openskimap'
    });
    return `https://openskimap.org/?${params.toString()}#${targetZoom.toFixed(2)}/${lat.toFixed(6)}/${lon.toFixed(6)}/${bearing.toFixed(2)}/0`;
  }
  return `https://openskimap.org/#${zoom.toFixed(2)}/${Number(resort.lat).toFixed(5)}/${Number(resort.lon).toFixed(5)}`;
}

function summarizeConditionSnapshot(resort) {
  return `${formatInches(resort.metrics.snow24h)} / 24h · ${formatInches(resort.metrics.baseDepth)} base`;
}

function summarizeOperationsSnapshot(resort) {
  const parts = [];
  if (Number.isFinite(resort.metrics.runsOpen) || Number.isFinite(resort.metrics.runsTotal)) {
    parts.push(formatRunAccess(resort.metrics));
  }
  if (Number.isFinite(resort.metrics.groomedRuns)) {
    parts.push(`${resort.metrics.groomedRuns} groomed`);
  }
  if (resort.liveUpdatedAt) {
    parts.push(/^updated\b/i.test(resort.liveUpdatedAt) ? resort.liveUpdatedAt : `Updated ${resort.liveUpdatedAt}`);
  }
  return parts.join(' · ');
}

function summarizeForecastBreakdown(resort) {
  const daily = resort.liveForecast?.dailySnowfall;
  if (!daily?.length) return null;
  return daily
    .slice(0, 3)
    .map((amount, index) => `D${index + 1} ${formatInches(amount)}`)
    .join(' · ');
}

function buildSourceLinks(resort) {
  const liveSources = resort.liveSources || {};
  const webcamPage = getWebcamPageForResort(resort);
  const conditionsUrl = getConditionsPageForResort(resort);
  const forecastUrl = liveSources.forecastPage || conditionsUrl || null;
  const webcamUrl = webcamPage || liveSources.conditions || liveSources.terrain || null;
  const forecastBreakdown = summarizeForecastBreakdown(resort);
  const links = [
    {
      id: 'forecast', tab: 'forecast', title: 'Forecast',
      subtitle: `${formatInches(resort.metrics.forecast72h)} next 72h`,
      hint: forecastBreakdown || (resort.liveForecastStatus === 'loading' ? 'Updating live forecast model…' : 'Modeled snowfall via Open-Meteo'),
      url: forecastUrl
    }
  ];
  if (conditionsUrl) {
    links.unshift({
      id: 'conditions', tab: 'conditions', title: 'Conditions',
      subtitle: summarizeConditionSnapshot(resort),
      hint: summarizeOperationsSnapshot(resort) || 'Official mountain report / source page',
      url: conditionsUrl, isStatic: false
    });
  } else {
    links.unshift({
      id: 'conditions', tab: 'conditions', title: 'Conditions',
      subtitle: summarizeConditionSnapshot(resort),
      hint: 'Official conditions source is not wired for this resort yet. Unverified values are not displayed.',
      url: null, isStatic: true
    });
  }
  if (webcamUrl) {
    links.push({
      id: 'webcams', tab: 'webcams', title: 'Webcams',
      subtitle: webcamStreams.get(getSourceKeyForResort(resort.name))?.length
        ? `${webcamStreams.get(getSourceKeyForResort(resort.name)).length} local feeds`
        : 'Official page',
      hint: 'Local extractor and fallback page',
      url: webcamUrl, isStatic: false
    });
  }
  return links;
}

function buildWebcams(resort) {
  return selectWebcams(webcamStreams.get(getSourceKeyForResort(resort.name)), getWebcamPageForResort(resort));
}
let webcamRenderKey = null;
function clearWebcams() {
  webcamList.querySelectorAll('video').forEach(video => { video._snowScoutHls?.destroy(); video.pause(); video.removeAttribute('src'); video.load(); });
  webcamList.replaceChildren();
  webcamRenderKey = null;
}

function renderWebcamPreview(webcam) {
  if (webcam.kind === 'iframe') {
    const frame = document.createElement('iframe');
    frame.src = webcam.url;
    frame.loading = 'lazy';
    attachCameraError(frame, 'Camera player unavailable. Open the official camera page below.');
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.title = webcam.title;
    return frame;
  }
  if (webcam.kind === 'video') {
    const video = document.createElement('video');
    attachCameraError(video);
    video.src = webcam.url;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = true;
    return video;
  }
  if (webcam.kind === 'hls') {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = true;
    if (window.Hls?.isSupported()) {
      const hls = new window.Hls({ enableWorker: true, lowLatencyMode: false });
      const fail = attachCameraError(video);
      hls.on(window.Hls.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
      hls.loadSource(webcam.url);
      hls.attachMedia(video);
      video._snowScoutHls = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      attachCameraError(video);
      video.src = webcam.url;
    } else {
      return null;
    }
    return video;
  }
  if (webcam.kind === 'image' || webcam.kind === 'mjpeg') {
    const image = document.createElement('img');
    attachCameraError(image);
    image.referrerPolicy = 'no-referrer';
    image.src = webcam.url;
    image.alt = webcam.title;
    image.loading = 'lazy';
    image.dataset.baseUrl = webcam.url;
    image.dataset.refreshable = 'true';
    return image;
  }
  return null;
}

export function setActiveTab(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
  if (tabName === 'travel') renderTravelPanel(selectedResort());
}

export function renderDetailPanel() {
  const resort = selectedResort();
  if (!resort) {
    clearWebcams();
    renderTravelPanel(null);
    detailOverlay.style.display = 'none';
    return;
  }

  detailOverlay.style.display = 'flex';
  if (state.currentTab === 'travel' || (document.body.classList.contains('mountain-details') && matchMedia('(min-width: 1100px)').matches)) renderTravelPanel(resort);
  detailName.textContent = resort.name;
  document.getElementById('detail-preservation').textContent = preservationExplanation(resort.liveForecast, state.useMetric);
  document.getElementById('detail-mountain').href = mountainUrl(resort);
  detailFavorite.textContent = favoriteGlyph(resort.id);
  detailFavorite.classList.toggle('primary', state.favorites.has(resort.id));

  const pass = document.getElementById('detail-pass');
  pass.className = `pass-tag ${getPassTone(resort)}`;
  pass.textContent = formatPassLabel(resort);
  const point = resort.liveForecast?.weatherLocation;
  const elevation = point?.elevationM ?? weatherLocation(resort).elevationM;
  const modelLocation = Number.isFinite(elevation)
    ? `Weather model at ${Math.round(elevation).toLocaleString()} m elevation`
    : 'Weather model at ski-area coordinates · elevation unavailable';
  document.getElementById('conditions-location').textContent = resort.liveConditionsKind === 'model'
    ? modelLocation : 'Resort report · reporting elevation not supplied';
  document.getElementById('forecast-location').textContent = modelLocation;
  detailMeta.innerHTML = '';
  [
    { label: formatTemperature(resort.metrics.tempF), className: 'pill' },
    { label: Number.isFinite(resort.metrics.daysSinceSnow) ? `${resort.metrics.daysSinceSnow}d since snow` : 'Snow gap unknown', className: 'pill' }
  ].forEach((item) => {
    const chip = document.createElement('span');
    chip.className = item.className;
    chip.textContent = item.label;
    detailMeta.appendChild(chip);
  });

  // === CURRENT TEMP ===
  const visualGrid = document.getElementById('detail-visual-grid');
  const temp = resort.metrics.tempF;
  const tempColor = temp <= 20 ? 'var(--fresh)' : temp <= 32 ? 'var(--steady)' : 'var(--dry)';
  visualGrid.innerHTML = `
    <div class="current-temp">
      <span class="current-temp-value" style="color:${tempColor}">${formatTemperature(temp)}</span>
      <span class="current-temp-label">${resort.liveTemperatureKind === 'model' ? 'Modeled now' : 'Now'}</span>
    </div>
  `;

  // Cumulative reporting windows, not invented calendar-day totals.
  const snowBars = document.getElementById('detail-snow-bars');
  const recent = [resort.metrics.snow24h, resort.metrics.snow48h, resort.metrics.snow72h];
  const recentMax = Math.max(...recent.filter(Number.isFinite), 1);
  snowBars.innerHTML = `
    <span class="detail-snow-bars-label">Recent snowfall <em class="bars-total">${resort.liveConditionsKind === 'model' ? 'Model estimate' : 'Resort report'} · cumulative</em></span>
    <div class="detail-snow-bars-row">${recent.map((amount, index) => `
      <div class="detail-snow-bar-col">
        <div class="detail-snow-bar"><div class="detail-snow-bar-fill recent-bar" style="height:${Number.isFinite(amount) ? amount / recentMax * 100 : 0}%"></div></div>
        <strong>${formatInches(amount)}</strong><span>Last ${(index + 1) * 24}h</span>
      </div>`).join('')}
    </div>`;

  // === 3-DAY FORECAST with temps ===
  const forecastBars = document.getElementById('detail-forecast-bars');
  const ds = resort.liveForecast?.dailySnowfall;
  const dt = resort.liveForecast?.dailyTime;
  const tMax = resort.liveForecast?.tempMax;
  const tMin = resort.liveForecast?.tempMin;
  const d1 = ds?.[0] ?? null;
  const d2 = ds?.[1] ?? null;
  const d3 = ds?.[2] ?? null;
  const fMax = Math.max(...[d1, d2, d3].filter(Number.isFinite), 1);
  const forecastTotal = resort.metrics.forecast72h;

  function dayLabel(idx) {
    const dateStr = dt?.[idx];
    if (dateStr) {
      return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
    }
    return `D${idx + 1}`;
  }

  function tempRange(idx) {
    const lo = tMin?.[idx];
    const hi = tMax?.[idx];
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      return formatTemperature(hi);
    }
    return '';
  }

  forecastBars.innerHTML = `
    <span class="detail-snow-bars-label">\u26C8 Daily model forecast <em class="bars-total">${formatInches(forecastTotal)} next 72h</em></span>
    <div class="detail-snow-bars-row forecast-with-temps">
      <div class="detail-snow-bar-col">
        <span class="bar-temp">${tempRange(0)}</span>
        <div class="detail-snow-bar"><div class="detail-snow-bar-fill forecast-bar" style="height:${(d1 / fMax) * 100}%"></div></div>
        <strong>${formatInches(d1)}</strong><span>${dayLabel(0)}</span>
      </div>
      <div class="detail-snow-bar-col">
        <span class="bar-temp">${tempRange(1)}</span>
        <div class="detail-snow-bar"><div class="detail-snow-bar-fill forecast-bar" style="height:${(d2 / fMax) * 100}%"></div></div>
        <strong>${formatInches(d2)}</strong><span>${dayLabel(1)}</span>
      </div>
      <div class="detail-snow-bar-col">
        <span class="bar-temp">${tempRange(2)}</span>
        <div class="detail-snow-bar"><div class="detail-snow-bar-fill forecast-bar" style="height:${(d3 / fMax) * 100}%"></div></div>
        <strong>${formatInches(d3)}</strong><span>${dayLabel(2)}</span>
      </div>
    </div>
  `;

  // === BASE DEPTH (above terrain) ===
  const base = resort.metrics.baseDepth;
  const baseEl = document.getElementById('detail-base-depth');
  baseEl.innerHTML = `
    <span class="base-depth-icon">\u26F0</span>
    <span class="base-depth-value">${formatInches(base)}</span>
    <span class="base-depth-label">base depth</span>
  `;

  // === TERRAIN ===
  const openPercent = Number.isFinite(resort.metrics.runsOpen) && Number.isFinite(resort.metrics.runsTotal) && resort.metrics.runsTotal > 0
    ? (resort.metrics.runsOpen / resort.metrics.runsTotal) * 100
    : 0;
  runOpenCopy.textContent = formatRunAccess(resort.metrics);
  runOpenBar.style.width = `${openPercent}%`;

  const terrainStats = document.getElementById('detail-terrain-stats');
  terrainStats.innerHTML = `
    <span><strong>${resort.metrics.runsOpen ?? '—'}</strong> of ${resort.metrics.runsTotal ?? '—'} runs</span>
    <span><strong>${resort.metrics.groomedRuns ?? '—'}</strong> open groomed</span>
  `;

  // === CONDITIONS ACTIONS (external links) ===
  const conditionsActions = document.getElementById('conditions-actions');
  conditionsActions.innerHTML = '';
  [
    { label: '\uD83D\uDCCB Conditions report', url: getConditionsPageForResort(resort) },
    { label: 'Weather model data', url: resort.liveConditionsKind === 'model' ? resort.liveSources?.weatherModel || resort.liveSources?.conditions : null },
    { label: '\uD83D\uDDFA Terrain status', url: resort.liveSources?.terrain || null }
  ].filter((item) => item.url).forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.label;
    conditionsActions.appendChild(link);
  });

  // === NOTE ===
  detailNote.textContent = resort.liveNote || 'Current snow and terrain data are unavailable until a source report can be verified.';

  // === FORECAST TAB ===
  const powder = potentialPowderDays(resort.liveForecast);
  const dates = resort.liveForecast?.dailyTime?.slice(0,16) || [];
  const daily = resort.liveForecast?.dailySnowfall?.slice(0,16) || [];
  const forecastChartEl = document.getElementById('forecast-chart');
  const sameResort = forecastSelection.resortId === resort.id;
  const previousScroll = sameResort ? forecastChartEl.scrollLeft : 0;
  const selectedIndex = sameResort ? Math.max(0,dates.indexOf(forecastSelection.date)) : 0;
  const powderIndices = powder.status === 'ok' ? powder.days.map(day=>day.index) : [];
  const showDay = index => {
    const date = dates[index];
    forecastSelection = {resortId:resort.id,date};
    const label = date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}) : `Day ${index+1}`;
    forecastDayDetails.innerHTML = `
      <h4>${label}</h4>
      <div class="selected-day-stats"><div><span>Snowfall</span><strong>${formatInches(daily[index])}</strong></div>
      <div><span>Temperature</span><strong>${formatTemperature(resort.liveForecast?.tempMin?.[index])} to ${formatTemperature(resort.liveForecast?.tempMax?.[index])}</strong></div></div>
      ${powderIndices.includes(index) ? '<p class="powder-badge">Potential powder day · 6″ / approximately 15 cm or more</p>' : ''}
      ${index===0 ? '<p class="detail-note">Today’s daily total includes snow that may already have fallen.</p>' : ''}
      ${index>=7 ? '<p class="detail-note">Longer-range outlook · This forecast may change substantially.</p>' : ''}`;
  };
  forecastChartEl.replaceChildren();
  forecastChartEl.setAttribute('role','region');
  forecastChartEl.setAttribute('aria-label','Scrollable daily snowfall forecast');
  forecastChartEl.removeAttribute('tabindex');
  if(daily.length){
    forecastChartEl.appendChild(createSnowfallChart(daily,dates,{selectedIndex,powderIndices,onSelect:showDay}));
    showDay(selectedIndex);
    forecastChartEl.scrollLeft=previousScroll;
  } else forecastDayDetails.textContent='Daily forecast unavailable.';
  document.getElementById('forecast-horizon').textContent = daily.length
    ? `${daily.length} days · Scroll sideways and select a bar. Pulsing bars mark potential powder days.`
    : 'Forecast unavailable.';

  forecastActions.innerHTML = '';
  [
    { label: '\uD83D\uDCCA Resort weather page', url: resort.liveSources?.forecastPage || getConditionsPageForResort(resort) || null },
    { label: '\uD83D\uDD17 Model API', url: resort.liveSources?.forecastModel || null }
  ].filter((item) => item.url).forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.label;
    forecastActions.appendChild(link);
  });

  const forecastNote = document.createElement('p');
  forecastNote.className = 'detail-note';
  forecastNote.textContent = resort.liveForecast
    ? `Open-Meteo model · ${weatherLocationLabel(resort)}. One terrain sample, not conditions across every elevation or mountain in this destination. Fetched ${new Date(resort.liveForecast.updatedAt).toLocaleString()}. Daily bars use resort-local calendar dates; the 72-hour total starts ${new Date(resort.liveForecast.periodStart).toLocaleString()}. Current snowfall is modeled, not a live observation, and can miss snow happening now.`
    : resort.liveForecastStatus === 'loading' ? 'Loading the weather-model forecast…' : 'Current forecast unavailable. Unverified forecast values are withheld.';
  forecastActions.appendChild(forecastNote);

  // === TRAIL MAP TAB ===
  const trailMapViewport = getTrailMapViewport(resort);
  const trailMapUrl = buildOpenSkiMapUrl(resort);
  trailMapCopy.textContent = trailMapViewport?.proxyName
    ? `${resort.name} preview via ${trailMapViewport.proxyName} on OpenSkiMap`
    : `${resort.name} runs and lifts via OpenSkiMap`;
  if (trailMapFrame.dataset.url !== trailMapUrl) {
    trailMapFrame.src = trailMapUrl;
    trailMapFrame.dataset.url = trailMapUrl;
  }

  trailMapActions.innerHTML = '';
  [
    { label: '\uD83D\uDDFA Open trail map', url: trailMapUrl },
    { label: '\uD83D\uDD17 OpenSkiMap home', url: 'https://openskimap.org/' }
  ].forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.label;
    trailMapActions.appendChild(link);
  });
  trailMapNote.textContent = trailMapViewport?.proxyName
    ? `${resort.name} is represented in this preview by ${trailMapViewport.proxyName}, the closest mapped OpenSkiMap ski area. Use the open button to keep exploring from there.`
    : 'OpenSkiMap coverage depends on community-mapped run and lift data. Use the open button if the embedded map is blocked or incomplete for this resort.';

  // === WEBCAMS TAB ===
  const webcams = buildWebcams(resort);
  const nextWebcamKey = JSON.stringify([resort.id, webcams, webcamCatalogState.status]);
  if (webcamRenderKey === nextWebcamKey) return;
  clearWebcams();
  webcamRenderKey = nextWebcamKey;
  if (!webcams.length) {
    webcamCount.textContent = '0 feeds';
    const empty = document.createElement('div');
    empty.className = 'webcam-empty';
    empty.textContent = webcamCatalogState.status === 'error'
      ? 'The webcam catalog could not be loaded. Please try again later.'
      : 'No verified webcam feed is available for this resort.';
    webcamList.appendChild(empty);
  } else {
    const count = webcams.filter(cam => cam.kind !== 'page').length;
    webcamCount.textContent = webcamCatalogState.status === 'loading' ? 'Loading cameras…' : webcamCatalogState.status === 'error' ? 'Catalog unavailable' : count ? `${count} camera${count === 1 ? '' : 's'}` : 'Official page only';
    webcams.forEach((webcam) => {
      const card = document.createElement('div');
      const preview = renderWebcamPreview(webcam);
      card.className = preview ? 'webcam-card is-embed' : 'webcam-card';
      if (preview) {
        const media = document.createElement('div');
        media.className = 'webcam-media';
        const tag = document.createElement('span');
        tag.className = 'webcam-tag';
        tag.textContent = webcam.kind === 'iframe' ? 'Camera player' : ['video', 'hls'].includes(webcam.kind) ? 'Video feed' : 'Snapshot';
        media.appendChild(tag);
        media.appendChild(preview);
        if (webcam.playerUrl) {
          const play = document.createElement('button');
          play.className = 'webcam-play';
          play.textContent = 'Watch live video';
          play.addEventListener('click', () => {
            const player = renderWebcamPreview({...webcam, kind: 'iframe', url: webcam.playerUrl});
            tag.textContent = 'Live video';
            media.replaceChildren(tag, player);
            card.querySelector('.webcam-body p').textContent = 'Live camera player · availability is controlled by the resort.';
          }, {once: true});
          media.appendChild(play);
        }
        card.appendChild(media);
      }
      const body = document.createElement('div');
      body.className = 'webcam-body';
      const title = document.createElement('strong');
      title.textContent = webcam.title;
      body.appendChild(title);
      const copy = document.createElement('p');
      copy.textContent = webcamCatalogState.status === 'error'
        ? 'The webcam catalog could not be loaded. Try the official page.'
        : webcamCatalogState.status === 'loading' ? 'Loading the camera catalog…'
        : !preview && webcam.kind !== 'page' ? 'This browser cannot play this feed. Open the official camera page.' : webcam.description;
      body.appendChild(copy);
      const link = document.createElement('a');
      link.href = webcam.sourceUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Open official camera page';
      body.appendChild(link);
      card.appendChild(body);
      webcamList.appendChild(card);
    });
  }
}

// Shared by the globe and mountain pages. Refresh visible snapshots without rebuilding players.
setInterval(() => {
  if (document.hidden) return;
  webcamList.querySelectorAll('img[data-refreshable="true"]').forEach(image => {
    if (image.getClientRects().length && image.dataset.baseUrl) image.src = withCacheBust(image.dataset.baseUrl);
  });
}, 45000);

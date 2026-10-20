import { state } from './state.js?v=20261019-snowfall';
import {
  formatInches, formatTemperature, formatRunAccess, formatPassLabel,
  getPassTone, getSourceKeyForResort, getConditionsPageForResort, getWebcamPageForResort,
  withCacheBust, webcamStreams
} from './utils.js?v=20261019-snowfall';
import { selectedResort, favoriteGlyph } from './dashboard.js?v=20261019-snowfall';
import { createSnowfallChart } from './snowfall-chart.js?v=20261019-snowfall';
import { TRAIL_MAP_VIEWPORTS } from './trail-map-viewports.js?v=20261019-snowfall';

const detailOverlay = document.getElementById('detail-overlay');
const detailPanel = document.getElementById('detail-panel');
const detailName = document.getElementById('detail-name');
const detailSubtitle = document.getElementById('detail-subtitle');
const detailMeta = document.getElementById('detail-meta');
const detailFavorite = document.getElementById('detail-favorite');
const runOpenCopy = document.getElementById('run-open-copy');
const runOpenBar = document.getElementById('run-open-bar');
const detailNote = document.getElementById('detail-note');
const forecastGrid = document.getElementById('forecast-grid');
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
    .map((amount, index) => `D${index + 1} ${formatInches(amount, '0"')}`)
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
      hint: 'Official conditions source is not wired for this resort yet. Current values may still be estimated.',
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
  const sourceKey = getSourceKeyForResort(resort.name);
  const webcamPage = getWebcamPageForResort(resort);
  const feeds = (webcamStreams.get(sourceKey) || []).slice().sort((a, b) => {
    const rank = { iframe: 0, video: 1, mjpeg: 2, image: 3, hls: 4, page: 5 };
    return (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9);
  });
  if (feeds.length) {
    return feeds.slice(0, 8).map((feed, index) => {
      const kindLabel =
        feed.kind === 'iframe' ? 'Embedded live view'
        : feed.kind === 'video' ? 'Direct video feed'
        : feed.kind === 'image' || feed.kind === 'mjpeg' ? 'Refreshable live snapshot'
        : 'Official camera source';
      return { title: feed.title || `Live camera ${index + 1}`, description: kindLabel, url: feed.url, kind: feed.kind || 'page' };
    });
  }
  if (!webcamPage) return [];
  return [
    { title: 'Official webcam page', description: 'Open the resort camera hub for the latest live views.', url: webcamPage, kind: 'page' },
    { title: 'Base area cam', description: 'Jump into the official camera page and select the lower mountain feed.', url: webcamPage, kind: 'page' },
    { title: 'Summit cam', description: 'Use the official camera page to inspect wind, visibility, and upper mountain coverage.', url: webcamPage, kind: 'page' }
  ];
}

function renderWebcamPreview(webcam) {
  if (webcam.kind === 'iframe') {
    const frame = document.createElement('iframe');
    frame.src = webcam.url;
    frame.loading = 'lazy';
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.title = webcam.title;
    return frame;
  }
  if (webcam.kind === 'video') {
    const video = document.createElement('video');
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
      hls.loadSource(webcam.url);
      hls.attachMedia(video);
      video._snowScoutHls = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = webcam.url;
    } else {
      return null;
    }
    return video;
  }
  if (webcam.kind === 'image' || webcam.kind === 'mjpeg') {
    const image = document.createElement('img');
    image.src = withCacheBust(webcam.url);
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
}

export function renderDetailPanel() {
  const resort = selectedResort();
  if (!resort) {
    detailOverlay.style.display = 'none';
    return;
  }

  detailOverlay.style.display = 'flex';
  detailName.textContent = resort.name;
  const updateSuffix = resort.liveUpdatedAt
    ? ` · ${/^updated\b/i.test(resort.liveUpdatedAt) ? resort.liveUpdatedAt : `Updated ${resort.liveUpdatedAt}`}`
    : '';
  detailSubtitle.textContent = `${formatPassLabel(resort)} · ${resort.regionLabel} · ${resort.statusText}${updateSuffix}`;
  detailFavorite.textContent = favoriteGlyph(resort.id);
  detailFavorite.classList.toggle('primary', state.favorites.has(resort.id));

  detailMeta.innerHTML = '';
  [
    { label: formatPassLabel(resort), className: `pass-tag ${getPassTone(resort)}` },
    { label: resort.regionLabel, className: 'pill' },
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
      <span class="current-temp-label">Now</span>
    </div>
  `;

  // === RECENT SNOW (discrete daily, past 3 days) ===
  const snowBars = document.getElementById('detail-snow-bars');
  const r1 = resort.metrics.recentDay1 ?? resort.metrics.snow24h;
  const r2 = resort.metrics.recentDay2 ?? Math.max((resort.metrics.snow48h ?? 0) - (resort.metrics.snow24h ?? 0), 0);
  const r3 = resort.metrics.recentDay3 ?? 0;
  const recentMax = Math.max(r1, r2, r3, 1);
  const recentTotal = r1 + r2 + r3;
  snowBars.innerHTML = `
    <span class="detail-snow-bars-label">\u2744 Last 3 Days <em class="bars-total">${formatInches(recentTotal)} total</em></span>
    <div class="detail-snow-bars-row">
      <div class="detail-snow-bar-col">
        <div class="detail-snow-bar"><div class="detail-snow-bar-fill recent-bar" style="height:${(r1 / recentMax) * 100}%"></div></div>
        <strong>${formatInches(r1)}</strong><span>Yesterday</span>
      </div>
      <div class="detail-snow-bar-col">
        <div class="detail-snow-bar"><div class="detail-snow-bar-fill recent-bar" style="height:${(r2 / recentMax) * 100}%"></div></div>
        <strong>${formatInches(r2)}</strong><span>2 days</span>
      </div>
      <div class="detail-snow-bar-col">
        <div class="detail-snow-bar"><div class="detail-snow-bar-fill recent-bar" style="height:${(r3 / recentMax) * 100}%"></div></div>
        <strong>${formatInches(r3)}</strong><span>3 days</span>
      </div>
    </div>
  `;

  // === 3-DAY FORECAST with temps ===
  const forecastBars = document.getElementById('detail-forecast-bars');
  const ds = resort.liveForecast?.dailySnowfall;
  const dt = resort.liveForecast?.dailyTime;
  const tMax = resort.liveForecast?.tempMax;
  const tMin = resort.liveForecast?.tempMin;
  const d1 = ds?.[0] ?? resort.metrics.forecastDay1 ?? 0;
  const d2 = ds?.[1] ?? resort.metrics.forecastDay2 ?? 0;
  const d3 = ds?.[2] ?? resort.metrics.forecastDay3 ?? 0;
  const fMax = Math.max(d1, d2, d3, 1);
  const forecastTotal = d1 + d2 + d3;

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
    <span class="detail-snow-bars-label">\u26C8 3-Day Forecast <em class="bars-total">${formatInches(forecastTotal)} total</em></span>
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
    <span><strong>${resort.metrics.runsOpen}</strong> of ${resort.metrics.runsTotal} runs</span>
    <span><strong>${resort.metrics.groomedRuns}</strong> groomed</span>
  `;

  // === CONDITIONS ACTIONS (external links) ===
  const conditionsActions = document.getElementById('conditions-actions');
  conditionsActions.innerHTML = '';
  [
    { label: '\uD83D\uDCCB Conditions report', url: getConditionsPageForResort(resort) },
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
  detailNote.textContent =
    resort.status === 'incoming'
      ? `${resort.name} is on storm watch \u2014 forecast momentum is strongest here.`
      : resort.status === 'fresh'
        ? `${resort.name} got fresh snow \u2014 one of the best plays right now.`
        : resort.status === 'dry'
          ? `${resort.name} has the longest dry streak in the current view.`
          : `${resort.name} is holding steady with reliable base.`;

  // === FORECAST TAB ===
  const forecastCards = resort.liveForecast?.dailySnowfall?.length
    ? resort.liveForecast.dailySnowfall.slice(0, 6).map((amount, index) => ({
        date: resort.liveForecast.dailyTime?.[index] || null,
        amount,
        tempMax: resort.liveForecast.tempMax?.[index],
        tempMin: resort.liveForecast.tempMin?.[index]
      }))
    : [];
  const forecastChartEl = document.getElementById('forecast-chart');
  forecastChartEl.innerHTML = '';
  if (resort.liveForecast?.dailySnowfall?.length) {
    const chart = createSnowfallChart(resort.liveForecast.dailySnowfall, resort.liveForecast.dailyTime);
    if (chart) forecastChartEl.appendChild(chart);
  }

  forecastGrid.innerHTML = '';
  if (forecastCards.length) {
    forecastCards.forEach((day) => {
      const card = document.createElement('div');
      const label = day.date
        ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        : 'Day';
      card.className = 'forecast-day';
      card.innerHTML = `
        <span>${label}</span>
        <strong>${formatInches(day.amount, '0"')} snow</strong>
        <em>${formatTemperature(day.tempMin)} to ${formatTemperature(day.tempMax)}</em>
      `;
      forecastGrid.appendChild(card);
    });
  }

  forecastActions.innerHTML = '';
  [
    { label: '\uD83D\uDCCA Official forecast', url: resort.liveSources?.forecastPage || getConditionsPageForResort(resort) || null },
    { label: '\uD83D\uDD17 Model API', url: resort.liveSources?.forecastModel || null }
  ].filter((item) => item.url).forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.label;
    forecastActions.appendChild(link);
  });

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
  webcamList.innerHTML = '';
  if (!webcams.length) {
    webcamCount.textContent = '0 feeds';
    const empty = document.createElement('div');
    empty.className = 'webcam-empty';
    empty.textContent = 'No webcam feeds loaded for this resort yet.';
    webcamList.appendChild(empty);
  } else {
    webcamCount.textContent = `${webcams.length} feeds`;
    webcams.forEach((webcam) => {
      const card = document.createElement('div');
      const preview = renderWebcamPreview(webcam);
      card.className = preview ? 'webcam-card is-embed' : 'webcam-card';
      if (preview) {
        const media = document.createElement('div');
        media.className = 'webcam-media';
        const tag = document.createElement('span');
        tag.className = 'webcam-tag';
        tag.textContent = webcam.kind === 'iframe' ? 'Live Embed' : webcam.kind === 'video' ? 'Video Feed' : 'Live Snapshot';
        media.appendChild(tag);
        media.appendChild(preview);
        card.appendChild(media);
      }
      const body = document.createElement('div');
      body.className = 'webcam-body';
      const title = document.createElement('strong');
      title.textContent = webcam.title;
      body.appendChild(title);
      const copy = document.createElement('p');
      copy.textContent = webcam.description;
      body.appendChild(copy);
      const link = document.createElement('a');
      link.href = webcam.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = preview ? 'Open source' : 'Open camera page';
      body.appendChild(link);
      card.appendChild(body);
      webcamList.appendChild(card);
    });
  }
}

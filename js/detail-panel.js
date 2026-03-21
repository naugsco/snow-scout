import { state } from './state.js';
import {
  formatInches, formatTemperature, formatRunAccess, formatPassLabel, formatUpdateLabel,
  getPassTone, getSourceKeyForResort, getConditionsPageForResort, getWebcamPageForResort,
  getConditionsReliability, withCacheBust, webcamStreams
} from './utils.js';
import { selectedResort, favoriteGlyph } from './dashboard.js';
import { createSnowfallChart } from './snowfall-chart.js';

const detailPanel = document.getElementById('detail-panel');
const detailName = document.getElementById('detail-name');
const detailSubtitle = document.getElementById('detail-subtitle');
const detailMeta = document.getElementById('detail-meta');
const detailSources = document.getElementById('detail-sources');
const detailFavorite = document.getElementById('detail-favorite');
const detailStatGrid = document.getElementById('detail-stat-grid');
const runOpenCopy = document.getElementById('run-open-copy');
const runOpenBar = document.getElementById('run-open-bar');
const detailNote = document.getElementById('detail-note');
const conditionsGrid = document.getElementById('conditions-grid');
const conditionsCopy = document.getElementById('conditions-copy');
const conditionsActions = document.getElementById('conditions-actions');
const conditionsStatusChip = document.getElementById('conditions-status-chip');
const conditionsSourceState = document.getElementById('conditions-source-state');
const forecastCopy = document.getElementById('forecast-copy');
const forecastGrid = document.getElementById('forecast-grid');
const forecastActions = document.getElementById('forecast-actions');
const forecastStatusChip = document.getElementById('forecast-status-chip');
const forecastSourceState = document.getElementById('forecast-source-state');
const webcamList = document.getElementById('webcam-list');
const webcamCount = document.getElementById('webcam-count');

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
  detailSources.querySelectorAll('.source-link').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

export function renderDetailPanel() {
  const resort = selectedResort();
  if (!resort) {
    detailPanel.classList.remove('visible');
    return;
  }

  detailPanel.classList.add('visible');
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
    { label: `${resort.metrics.tempF}°F`, className: 'pill' },
    { label: Number.isFinite(resort.metrics.daysSinceSnow) ? `${resort.metrics.daysSinceSnow}d since snow` : 'Snow gap unknown', className: 'pill' }
  ].forEach((item) => {
    const chip = document.createElement('span');
    chip.className = item.className;
    chip.textContent = item.label;
    detailMeta.appendChild(chip);
  });

  detailSources.innerHTML = '';
  buildSourceLinks(resort).forEach((source) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `source-link${source.isStatic ? ' is-static' : ''}${state.currentTab === source.tab ? ' active' : ''}`;
    card.dataset.tab = source.tab;
    card.innerHTML = `
      <span>${source.title}</span>
      <strong>${source.subtitle}</strong>
      <em>${source.hint}</em>
    `;
    detailSources.appendChild(card);
  });

  const stats = [
    { label: 'Fresh Snow', value: `${formatInches(resort.metrics.snow24h)} / 24h` },
    { label: 'Forecast', value: `${formatInches(resort.metrics.forecast72h)} / 72h` },
    { label: 'Base Depth', value: formatInches(resort.metrics.baseDepth) },
    { label: 'Groomed', value: Number.isFinite(resort.metrics.groomedRuns) ? `${resort.metrics.groomedRuns} runs` : '—' }
  ];
  detailStatGrid.innerHTML = '';
  stats.forEach((stat) => {
    const card = document.createElement('div');
    card.className = 'detail-stat';
    card.innerHTML = `<span>${stat.label}</span><strong>${stat.value}</strong>`;
    detailStatGrid.appendChild(card);
  });

  const openPercent = Number.isFinite(resort.metrics.runsOpen) && Number.isFinite(resort.metrics.runsTotal) && resort.metrics.runsTotal > 0
    ? (resort.metrics.runsOpen / resort.metrics.runsTotal) * 100
    : 0;
  runOpenCopy.textContent = formatRunAccess(resort.metrics);
  runOpenBar.style.width = `${openPercent}%`;
  detailNote.textContent =
    resort.status === 'incoming'
      ? `${resort.name} is on storm watch. Forecast momentum is strongest here right now.`
      : resort.status === 'fresh'
        ? `${resort.name} already got new snow. This is one of the best immediate-reset plays on the board.`
        : resort.status === 'dry'
          ? `${resort.name} has gone the longest without snow in the current shortlist.`
          : `${resort.name} is holding steady with reliable base and moderate terrain access.`;
  if (resort.liveNote) {
    detailNote.textContent = `${detailNote.textContent} ${resort.liveNote}.`;
  }

  const conditionStats = [
    { label: 'Fresh Snow', value: `${formatInches(resort.metrics.snow24h)} / 24h` },
    { label: 'Base Depth', value: formatInches(resort.metrics.baseDepth) },
    { label: 'Run Access', value: formatRunAccess(resort.metrics, true) },
    { label: 'Groomed', value: Number.isFinite(resort.metrics.groomedRuns) ? `${resort.metrics.groomedRuns} runs` : '—' }
  ];
  conditionsGrid.innerHTML = '';
  conditionStats.forEach((stat) => {
    const card = document.createElement('div');
    card.className = 'detail-stat';
    card.innerHTML = `<span>${stat.label}</span><strong>${stat.value}</strong>`;
    conditionsGrid.appendChild(card);
  });
  conditionsStatusChip.textContent = getConditionsReliability(resort);
  conditionsCopy.innerHTML = `
    <strong>Mountain Snapshot</strong>
    ${resort.liveNote || 'No operator narrative is loaded for this resort yet. Use the official report link below when you need the mountain\'s own write-up.'}
  `;
  conditionsActions.innerHTML = '';
  [
    { label: 'Open conditions report', url: getConditionsPageForResort(resort) },
    { label: 'Open terrain status', url: resort.liveSources?.terrain || null }
  ].filter((item) => item.url).forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.label;
    conditionsActions.appendChild(link);
  });
  conditionsSourceState.textContent = resort.liveConditionsStatus === 'ready'
    ? `${formatUpdateLabel(resort.liveUpdatedAt)}. Metrics are coming from the resort's own conditions page or terrain feed.`
    : getConditionsPageForResort(resort)
      ? 'The official conditions page is linked, but the resort is not yet wired into the live parser. Metrics shown here may still be estimated.'
      : 'No official conditions parser is wired for this resort yet. Metrics shown here are still fallback estimates.';

  const forecastCards = resort.liveForecast?.dailySnowfall?.length
    ? resort.liveForecast.dailySnowfall.slice(0, 6).map((amount, index) => ({
        date: resort.liveForecast.dailyTime?.[index] || null,
        amount,
        tempMax: resort.liveForecast.tempMax?.[index],
        tempMin: resort.liveForecast.tempMin?.[index]
      }))
    : [];
  // Render snowfall chart
  const forecastChartEl = document.getElementById('forecast-chart');
  forecastChartEl.innerHTML = '';
  if (resort.liveForecast?.dailySnowfall?.length) {
    const chart = createSnowfallChart(resort.liveForecast.dailySnowfall, resort.liveForecast.dailyTime);
    if (chart) forecastChartEl.appendChild(chart);
  }

  forecastStatusChip.textContent =
    resort.liveForecastStatus === 'loading' ? 'Refreshing'
    : resort.liveForecastStatus === 'error' ? 'Unavailable'
    : 'Model Live';
  forecastCopy.innerHTML = `
    <strong>Forecast Model</strong>
    ${resort.liveForecastStatus === 'loading'
      ? 'Updating the snowfall model now.'
      : `Open-Meteo snowfall model for ${resort.name}. Next 72h total: ${formatInches(resort.metrics.forecast72h)}.`}
  `;
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
  } else {
    const empty = document.createElement('div');
    empty.className = 'forecast-day';
    empty.innerHTML = `
      <span>Forecast</span>
      <strong>${resort.liveForecastStatus === 'loading' ? 'Loading model…' : 'No model data yet'}</strong>
      <em>${resort.liveForecastStatus === 'error' ? 'The forecast request failed for this resort.' : 'Select the resort again if the model does not populate.'}</em>
    `;
    forecastGrid.appendChild(empty);
  }
  forecastActions.innerHTML = '';
  [
    { label: 'Open official forecast page', url: resort.liveSources?.forecastPage || getConditionsPageForResort(resort) || null },
    { label: 'Open model API', url: resort.liveSources?.forecastModel || null }
  ].filter((item) => item.url).forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.label;
    forecastActions.appendChild(link);
  });
  forecastSourceState.textContent = resort.liveForecastStatus === 'error'
    ? 'The model request failed. Use the official forecast page for this resort until the next refresh succeeds.'
    : 'Forecast totals are modeled with Open-Meteo and converted from centimeters to inches before display.';

  const webcams = buildWebcams(resort);
  webcamList.innerHTML = '';
  if (!webcams.length) {
    webcamCount.textContent = '0 feeds';
    const empty = document.createElement('div');
    empty.className = 'webcam-empty';
    empty.textContent = 'No webcam feeds are loaded yet for this resort. If the local extractor produces stream URLs later, they will appear here automatically.';
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
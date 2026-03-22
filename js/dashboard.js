import { PASS_FILTERS, REGION_FILTERS } from './constants.js';
import { state, saveFavorites } from './state.js';
import { resorts } from './resorts.js';
import {
  formatInches, formatRunAccess, formatPassLabel, getPassTone
} from './utils.js';

const resortListEl = document.getElementById('resort-list');
const resortCount = document.getElementById('resort-count');
const incomingFilterButton = document.getElementById('incoming-filter');
const freshFilterButton = document.getElementById('fresh-filter');
const dryFilterButton = document.getElementById('dry-filter');
const incomingCountEl = document.getElementById('incoming-count');
const freshCountEl = document.getElementById('fresh-count');
const dryCountEl = document.getElementById('dry-count');

export function baseFilteredResorts() {
  const query = state.searchQuery.toLowerCase().trim();
  return resorts
    .filter((resort) => {
      if (query && !resort.name.toLowerCase().includes(query)) return false;
      if (state.passFilter === 'favorites' && !state.favorites.has(resort.id)) return false;
      if (state.passFilter === 'epic' && !resort.passes.includes('epic')) return false;
      if (state.passFilter === 'ikon' && !resort.passes.includes('ikon')) return false;
      if (state.regionFilter !== 'all' && resort.region !== state.regionFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (state.sortMode) {
        case 'snow24h': return b.metrics.snow24h - a.metrics.snow24h;
        case 'forecast72h': return b.metrics.forecast72h - a.metrics.forecast72h;
        case 'daysSinceSnow': return (a.metrics.daysSinceSnow ?? 999) - (b.metrics.daysSinceSnow ?? 999);
        case 'alpha': return a.name.localeCompare(b.name);
        default: {
          const scoreA = a.metrics.forecast72h * 1.1 + a.metrics.snow24h * 1.35 - a.metrics.daysSinceSnow * 0.8;
          const scoreB = b.metrics.forecast72h * 1.1 + b.metrics.snow24h * 1.35 - b.metrics.daysSinceSnow * 0.8;
          return scoreB - scoreA;
        }
      }
    });
}

export function applyStatusFilter(list) {
  if (state.statusFilter === 'all') return list;
  if (state.statusFilter === 'fresh' && state.freshMode === '48h') {
    return list.filter((resort) => (resort.metrics.snow48h ?? 0) >= 7);
  }
  return list.filter((resort) => resort.status === state.statusFilter);
}

export function filteredResorts() {
  return applyStatusFilter(baseFilteredResorts());
}

export function selectedResort() {
  return resorts.find((resort) => resort.id === state.selectedId) || null;
}

export function ensureSelectionVisible() {
  if (!state.selectedId) return;
  const visibleIds = new Set(filteredResorts().map((resort) => resort.id));
  if (!visibleIds.has(state.selectedId)) {
    state.selectedId = null;
  }
}

export function favoriteGlyph(id) {
  return state.favorites.has(id) ? '★' : '☆';
}

export function toggleFavorite(id) {
  if (!id) return;
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveFavorites();
}

let onResortClick = null;
export function setOnResortClick(handler) { onResortClick = handler; }

let onCompareToggle = null;
export function setOnCompareToggle(handler) { onCompareToggle = handler; }

export function renderFilters(selectPassFilter, selectRegionFilter) {
  const passRoot = document.getElementById('pass-filters');
  const regionRoot = document.getElementById('region-filters');
  passRoot.innerHTML = '';
  regionRoot.innerHTML = '';

  PASS_FILTERS.forEach((filter) => {
    const button = document.createElement('button');
    button.className = `chip ${state.passFilter === filter.id ? 'active' : ''}`;
    button.textContent = filter.label;
    button.addEventListener('click', () => selectPassFilter(filter.id));
    passRoot.appendChild(button);
  });

  REGION_FILTERS.forEach((filter) => {
    const button = document.createElement('button');
    button.className = `chip ${state.regionFilter === filter.id ? 'active' : ''}`;
    button.dataset.region = filter.id;
    button.textContent = filter.label;
    button.addEventListener('click', () => selectRegionFilter(filter.id));
    regionRoot.appendChild(button);
  });
}

export function renderDashboard() {
  const baseVisible = baseFilteredResorts();
  const visible = applyStatusFilter(baseVisible);
  const incoming = baseVisible.filter((resort) => resort.status === 'incoming').sort((a, b) => b.metrics.forecast72h - a.metrics.forecast72h);
  const fresh24 = baseVisible.filter((resort) => resort.status === 'fresh').sort((a, b) => b.metrics.snow24h - a.metrics.snow24h);
  const fresh48 = baseVisible.filter((resort) => (resort.metrics.snow48h ?? 0) >= 7).sort((a, b) => b.metrics.snow48h - a.metrics.snow48h);
  const dry = baseVisible.filter((resort) => resort.status === 'dry').sort((a, b) => b.metrics.daysSinceSnow - a.metrics.daysSinceSnow);

  incomingFilterButton.classList.toggle('active', state.statusFilter === 'incoming');
  freshFilterButton.classList.toggle('active', state.statusFilter === 'fresh');
  dryFilterButton.classList.toggle('active', state.statusFilter === 'dry');

  // Update fresh button label to reflect current mode
  const freshLabel = freshFilterButton.querySelector('span');
  const freshCount = state.freshMode === '48h' ? fresh48.length : fresh24.length;
  if (freshLabel) freshLabel.textContent = `Fresh Snow (${state.freshMode})`;

  incomingCountEl.textContent = incoming.length;
  freshCountEl.textContent = freshCount;
  dryCountEl.textContent = `${dry[0]?.metrics.daysSinceSnow || 0}d`;

  const countLabel =
    state.statusFilter === 'incoming' ? 'storm-watch'
    : state.statusFilter === 'fresh' ? 'fresh-snow'
    : state.statusFilter === 'dry' ? 'dry-streak'
    : '';
  resortCount.textContent = countLabel
    ? `${visible.length} ${countLabel} resort${visible.length === 1 ? '' : 's'}`
    : `${visible.length} resort${visible.length === 1 ? '' : 's'}`;
  resortListEl.innerHTML = '';

  // Compute heatmap range when a status filter is active
  let heatmapMetric = null;
  let heatmapMin = 0;
  let heatmapMax = 1;
  let heatmapColor = null;
  if (state.statusFilter === 'incoming') {
    heatmapMetric = 'forecast72h';
    heatmapColor = '176, 108, 255';
    const vals = visible.map((r) => r.metrics.forecast72h).filter(Number.isFinite);
    if (vals.length) { heatmapMin = Math.min(...vals); heatmapMax = Math.max(...vals); }
  } else if (state.statusFilter === 'fresh') {
    heatmapMetric = state.freshMode === '48h' ? 'snow48h' : 'snow24h';
    heatmapColor = '101, 217, 255';
    const vals = visible.map((r) => r.metrics[heatmapMetric]).filter(Number.isFinite);
    if (vals.length) { heatmapMin = Math.min(...vals); heatmapMax = Math.max(...vals); }
  } else if (state.statusFilter === 'dry') {
    heatmapMetric = 'daysSinceSnow';
    heatmapColor = '255, 159, 87';
    const vals = visible.map((r) => r.metrics.daysSinceSnow).filter(Number.isFinite);
    if (vals.length) { heatmapMin = Math.min(...vals); heatmapMax = Math.max(...vals); }
  }

  const CAP = 18;
  const isCapped = state.statusFilter === 'all' && !state.showAllResorts && !state.searchQuery && visible.length > CAP;
  const shortlist = isCapped ? visible.slice(0, CAP) : visible;

  if (!shortlist.length) {
    const empty = document.createElement('div');
    empty.className = 'resort-item empty';
    empty.textContent = state.searchQuery
      ? `No resorts match "${state.searchQuery}".`
      : state.statusFilter === 'all'
        ? 'No resorts match the current pass and region filters.'
        : 'No resorts match this snow signal in the current pass and region view.';
    resortListEl.appendChild(empty);
  }

  shortlist.forEach((resort) => {
    const item = document.createElement('div');
    item.className = `resort-item ${state.selectedId === resort.id ? 'selected' : ''}`;

    if (heatmapMetric && heatmapColor) {
      const val = resort.metrics[heatmapMetric] ?? 0;
      const range = heatmapMax - heatmapMin;
      const t = range > 0 ? (val - heatmapMin) / range : 0.5;
      const opacity = 0.06 + t * 0.38;
      const borderOpacity = 0.1 + t * 0.4;
      item.style.background = `linear-gradient(135deg, rgba(${heatmapColor}, ${opacity}), rgba(${heatmapColor}, ${opacity * 0.4}))`;
      item.style.borderColor = `rgba(${heatmapColor}, ${borderOpacity})`;
    }

    const ds = resort.liveForecast?.dailySnowfall;
    const d1 = ds?.[0] ?? resort.metrics.forecastDay1 ?? 0;
    const d2 = ds?.[1] ?? resort.metrics.forecastDay2 ?? 0;
    const d3 = ds?.[2] ?? resort.metrics.forecastDay3 ?? 0;
    const fMax = Math.max(d1, d2, d3, 1);
    const sMax = Math.max(resort.metrics.snow24h, resort.metrics.snow48h, 1);

    item.innerHTML = `
      <div class="card-head">
        <span class="status-dot ${resort.status}"></span>
        <strong>
          ${resort.name}
          <span class="pass-tag ${getPassTone(resort)}">${formatPassLabel(resort)}</span>
        </strong>
        <span class="card-actions">
          <button class="inline-compare" title="Add to comparison">⇔</button>
          <button class="inline-star ${state.favorites.has(resort.id) ? 'active' : ''}" title="Favorite">${favoriteGlyph(resort.id)}</button>
        </span>
      </div>
      <div class="meta">${resort.regionLabel} · ${resort.statusText}</div>
      <div class="card-data-row">
        <div class="data-section">
          <span class="data-section-label">Recent Snow</span>
          <div class="data-section-items">
            <div class="data-col"><div class="data-bar"><div class="data-bar-fill fresh-bar" style="height:${Math.min(100, (resort.metrics.snow24h / sMax) * 100)}%"></div></div><strong>${formatInches(resort.metrics.snow24h)}</strong><span>24h</span></div>
            <div class="data-col"><div class="data-bar"><div class="data-bar-fill fresh-bar" style="height:${Math.min(100, (resort.metrics.snow48h / sMax) * 100)}%"></div></div><strong>${formatInches(resort.metrics.snow48h)}</strong><span>48h</span></div>
          </div>
        </div>
        <div class="data-section">
          <span class="data-section-label">Next 3 Days</span>
          <div class="data-section-items">
            <div class="data-col"><div class="data-bar"><div class="data-bar-fill forecast-bar" style="height:${Math.min(100, (d1 / fMax) * 100)}%"></div></div><strong>${formatInches(d1)}</strong><span>D1</span></div>
            <div class="data-col"><div class="data-bar"><div class="data-bar-fill forecast-bar" style="height:${Math.min(100, (d2 / fMax) * 100)}%"></div></div><strong>${formatInches(d2)}</strong><span>D2</span></div>
            <div class="data-col"><div class="data-bar"><div class="data-bar-fill forecast-bar" style="height:${Math.min(100, (d3 / fMax) * 100)}%"></div></div><strong>${formatInches(d3)}</strong><span>D3</span></div>
          </div>
        </div>
        <div class="data-section data-section-compact">
          <span class="data-section-label">Runs</span>
          <div class="data-section-items">
            <div class="data-col"><strong class="runs-val">${formatRunAccess(resort.metrics, true)}</strong><span>Open</span></div>
          </div>
        </div>
      </div>
    `;

    item.addEventListener('click', (event) => {
      const compareButton = event.target.closest('.inline-compare');
      if (compareButton) {
        event.stopPropagation();
        if (onCompareToggle) onCompareToggle(resort.id);
        return;
      }
      const favoriteButton = event.target.closest('.inline-star');
      if (favoriteButton) {
        event.stopPropagation();
        toggleFavorite(resort.id);
        renderDashboard();
        return;
      }
      if (onResortClick) onResortClick(resort);
    });

    resortListEl.appendChild(item);
  });

  if (isCapped) {
    const showMore = document.createElement('button');
    showMore.className = 'show-more-btn';
    showMore.textContent = `Show all ${visible.length} resorts`;
    showMore.addEventListener('click', () => {
      state.showAllResorts = true;
      renderDashboard();
    });
    resortListEl.appendChild(showMore);
  }
}

export function renderUpdatedAt() {
  const el = document.getElementById('updated-at');
  if (!state.conditionsGeneratedAt) { el.style.display = 'none'; return; }
  const date = new Date(state.conditionsGeneratedAt);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  let ago;
  if (mins < 1) ago = 'just now';
  else if (mins < 60) ago = `${mins}m ago`;
  else if (mins < 1440) ago = `${Math.floor(mins / 60)}h ago`;
  else ago = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  el.textContent = `Conditions updated ${ago}`;
  el.style.display = 'block';
}

export function renderStormBanner() {
  const banner = document.getElementById('storm-banner');
  const text = document.getElementById('storm-banner-text');
  if (state.stormBannerDismissed) { banner.style.display = 'none'; return; }
  const stormResorts = resorts.filter((r) => r.metrics.forecast72h >= 12);
  if (stormResorts.length < 3) { banner.style.display = 'none'; return; }
  const topForecasts = stormResorts.sort((a, b) => b.metrics.forecast72h - a.metrics.forecast72h).slice(0, 3);
  const names = topForecasts.map((r) => r.name).join(', ');
  text.innerHTML = `<strong>Storm incoming</strong> — ${stormResorts.length} resorts expecting 12″+ in the next 72h. Top: ${names}.`;
  banner.style.display = 'flex';
}
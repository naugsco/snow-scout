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
  const fresh = baseVisible.filter((resort) => resort.status === 'fresh').sort((a, b) => b.metrics.snow24h - a.metrics.snow24h);
  const dry = baseVisible.filter((resort) => resort.status === 'dry').sort((a, b) => b.metrics.daysSinceSnow - a.metrics.daysSinceSnow);

  incomingFilterButton.classList.toggle('active', state.statusFilter === 'incoming');
  freshFilterButton.classList.toggle('active', state.statusFilter === 'fresh');
  dryFilterButton.classList.toggle('active', state.statusFilter === 'dry');

  incomingCountEl.textContent = incoming.length;
  freshCountEl.textContent = fresh.length;
  dryCountEl.textContent = `${dry[0]?.metrics.daysSinceSnow || 0}d`;

  const countLabel =
    state.statusFilter === 'incoming' ? 'incoming'
    : state.statusFilter === 'fresh' ? 'fresh'
    : state.statusFilter === 'dry' ? 'dry-streak'
    : '';
  resortCount.textContent = countLabel
    ? `${visible.length} ${countLabel} resort${visible.length === 1 ? '' : 's'}`
    : `${visible.length} resort${visible.length === 1 ? '' : 's'}`;
  resortListEl.innerHTML = '';

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
    item.innerHTML = `
      <span class="status-dot ${resort.status}"></span>
      <div class="resort-copy">
        <strong>
          ${resort.name}
          <span class="pass-tag ${getPassTone(resort)}">${formatPassLabel(resort)}</span>
        </strong>
        <div class="meta">${resort.regionLabel} · ${resort.statusText}</div>
        <div class="resort-metrics">
          <div class="metric"><span>24h</span><strong>${formatInches(resort.metrics.snow24h)}</strong><div class="mini-bar"><div class="mini-bar-fill fresh-bar" style="width:${Math.min(100, (resort.metrics.snow24h / 24) * 100)}%"></div></div></div>
          <div class="metric"><span>72h</span><strong>${formatInches(resort.metrics.forecast72h)}</strong><div class="mini-bar"><div class="mini-bar-fill forecast-bar" style="width:${Math.min(100, (resort.metrics.forecast72h / 36) * 100)}%"></div></div></div>
          <div class="metric"><span>Open</span><strong>${formatRunAccess(resort.metrics, true)}</strong></div>
        </div>
      </div>
      <button class="inline-star ${state.favorites.has(resort.id) ? 'active' : ''}" title="Favorite">${favoriteGlyph(resort.id)}</button>
    `;

    item.addEventListener('click', (event) => {
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
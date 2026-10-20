import { FAVORITES_KEY } from './constants.js?v=20261019-snowfall';

export function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(state.favorites)));
}

function loadUseMetric() {
  try { return localStorage.getItem('snow-scout-metric') === 'true'; } catch { return false; }
}

function loadTheme() {
  try { return localStorage.getItem('snow-scout-theme') || 'dark'; } catch { return 'dark'; }
}

export const state = {
  passFilter: 'all',
  regionFilter: 'all',
  statusFilter: 'all',
  globeStyle: 'default',
  freshMode: '24h',
  searchQuery: '',
  sortMode: 'score',
  showAllResorts: false,
  selectedId: null,
  hoveredId: null,
  currentTab: 'overview',
  favorites: loadFavorites(),
  isFlying: false,
  activeFlightId: 0,
  conditionsGeneratedAt: null,
  conditionErrorCount: 0,
  stormBannerDismissed: false,
  useMetric: loadUseMetric(),
  theme: loadTheme()
};

export function setUseMetric(value) {
  state.useMetric = value;
  try { localStorage.setItem('snow-scout-metric', value ? 'true' : 'false'); } catch { /* noop */ }
}

export function setTheme(theme) {
  state.theme = theme;
  try { localStorage.setItem('snow-scout-theme', theme); } catch { /* noop */ }
  if (theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  } else {
    document.body.removeAttribute('data-theme');
  }
}

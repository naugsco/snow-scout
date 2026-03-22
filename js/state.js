import { FAVORITES_KEY } from './constants.js';

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

export const state = {
  passFilter: 'all',
  regionFilter: 'all',
  statusFilter: 'all',
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
  stormBannerDismissed: false
};
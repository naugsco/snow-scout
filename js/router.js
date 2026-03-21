import { normalizeResortName } from './utils.js';

const PARAM_MAP = {
  resort: 'selectedId',
  pass: 'passFilter',
  region: 'regionFilter',
  sort: 'sortMode',
  status: 'statusFilter',
  tab: 'currentTab'
};

export function parseHash(resorts) {
  const hash = location.hash.slice(1);
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  const result = {};

  if (params.has('pass')) result.passFilter = params.get('pass');
  if (params.has('region')) result.regionFilter = params.get('region');
  if (params.has('sort')) result.sortMode = params.get('sort');
  if (params.has('status')) result.statusFilter = params.get('status');
  if (params.has('tab')) result.currentTab = params.get('tab');

  if (params.has('resort')) {
    const resortSlug = params.get('resort');
    const match = resorts.find((r) => {
      const slug = normalizeResortName(r.name).replace(/\s+/g, '-');
      return slug === resortSlug || normalizeResortName(r.name) === resortSlug.replace(/-/g, ' ');
    });
    if (match) result.selectedId = match.id;
  }

  return result;
}

export function updateHash(state, resorts) {
  const params = new URLSearchParams();

  if (state.selectedId) {
    const resort = resorts.find((r) => r.id === state.selectedId);
    if (resort) {
      params.set('resort', normalizeResortName(resort.name).replace(/\s+/g, '-'));
    }
  }
  if (state.passFilter !== 'all') params.set('pass', state.passFilter);
  if (state.regionFilter !== 'all') params.set('region', state.regionFilter);
  if (state.sortMode !== 'score') params.set('sort', state.sortMode);
  if (state.statusFilter !== 'all') params.set('status', state.statusFilter);
  if (state.currentTab !== 'overview') params.set('tab', state.currentTab);

  const hashStr = params.toString();
  const newHash = hashStr ? `#${hashStr}` : '';

  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash || location.pathname);
  }
}

export function initRouter(resorts, onHashChange) {
  window.addEventListener('hashchange', () => {
    const parsed = parseHash(resorts);
    if (Object.keys(parsed).length) {
      onHashChange(parsed);
    }
  });
}
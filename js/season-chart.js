import { resorts } from './resorts.js?v=20261019-standard-globe';
import { formatInches } from './utils.js?v=20261019-standard-globe';
import { rankedSnowfall, fetchSnowfallCatalog } from './season-snowfall.js';

let catalog = null;
let loadError = null;

export function renderSeasonChart() {
  const root = document.getElementById('season-chart');
  const note = document.getElementById('season-chart-note');
  if (!root) return;
  const ranked = rankedSnowfall(resorts, catalog);
  const reported = ranked.filter((item) => item.total !== null);
  const maximum = Math.max(...reported.map((item) => item.total), 1);
  const tooltip = document.getElementById('season-tooltip');
  tooltip.hidden = true;
  root.replaceChildren();
  for (const item of ranked) {
    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = `season-bar${item.total === null ? ' is-missing' : ''}`;
    const amount = item.total === null ? 'Estimate unavailable' : formatInches(item.total);
    const description = `${item.resort.name} · ${item.season} · ${amount}`;
    bar.setAttribute('aria-label', description);
    bar.setAttribute('aria-describedby', 'season-tooltip');
    bar.dataset.total = item.total ?? '';
    bar.dataset.resort = item.resort.name;
    const fill = document.createElement('span');
    fill.className = 'season-bar-fill';
    fill.style.height = item.total === null ? '5px' : `${Math.max(item.total / maximum * 100, 1)}%`;
    bar.appendChild(fill);
    const show = () => {
      tooltip.replaceChildren();
      const name = document.createElement('strong');
      name.textContent = item.resort.name;
      const detail = document.createElement('span');
      detail.textContent = `${item.season} · ${amount}${item.total === null ? '' : ' estimated snowfall to date'} · through ${item.record?.through || '—'}${item.entry?.status === 'error' ? ' · refresh failed' : ''}`;
      tooltip.append(name, detail);
      tooltip.hidden = false;
      const rect = bar.getBoundingClientRect();
      const width = tooltip.getBoundingClientRect().width;
      tooltip.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))}px`;
      tooltip.style.top = `${Math.max(8, rect.top - tooltip.offsetHeight - 8)}px`;
    };
    bar.addEventListener('pointerenter', show);
    bar.addEventListener('focus', show);
    bar.addEventListener('click', show); // Tapping exposes the same details on phones.
    bar.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    bar.addEventListener('blur', () => { tooltip.hidden = true; });
    bar.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') tooltip.hidden = true;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const next = event.key === 'ArrowRight' ? bar.nextElementSibling : bar.previousElementSibling;
        next?.focus();
      }
    });
    root.appendChild(bar);
  }
  document.getElementById('season-chart-max').textContent = reported.length ? formatInches(maximum) : '—';
  note.textContent = loadError || (catalog
    ? `ERA5 model estimates · ${reported.length}/${resorts.length} resorts · Through ${[...new Set(reported.map((item) => item.record.through))].sort().join(' to ') || '—'} · Northern ${ranked.find((item) => item.resort.lat > 0)?.season}; southern ${ranked.find((item) => item.resort.lat < 0)?.season}.${resorts.length - reported.length ? ` ${resorts.length - reported.length} unavailable (hatched).` : ''}${Object.values(catalog.resorts).some((item) => item.status === 'error') ? ' Some data refreshes failed; see history for coverage.' : ''}`
    : 'Loading modeled season totals…');
  root.setAttribute('aria-label', `Current-season snowfall for all ${resorts.length} resorts, ascending from left to right. Resorts without estimates are hatched.`);
}

export async function loadSeasonChart() {
  renderSeasonChart();
  try {
    catalog = await fetchSnowfallCatalog();
  } catch (error) {
    loadError = error.message;
    console.error('Season snowfall:', error);
  }
  renderSeasonChart();
  document.querySelector('.season-snowfall').addEventListener('pointerleave', () => {
    document.getElementById('season-tooltip').hidden = true;
  });
  document.querySelector('.dashboard-area').addEventListener('scroll', () => {
    document.getElementById('season-tooltip').hidden = true;
  });
}

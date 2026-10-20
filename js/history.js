import { resorts } from './resorts.js?v=20261019-standard-globe';
import { state, setUseMetric, setTheme } from './state.js?v=20261019-standard-globe';
import { formatInches, formatPassLabel } from './utils.js?v=20261019-standard-globe';
import { historyRecords, fetchSnowfallCatalog } from './season-snowfall.js';

const $ = (id) => document.getElementById(id);
const passLabels = { epic: 'Epic Pass', ikon: 'Ikon Pass', 'mountain-collective': 'Mountain Collective' };
let catalog;
let pageIndex = 0;
const pageSize = 50;
const theme = $('history-theme');
const units = $('history-units');
function syncControls() {
  if (state.theme === 'light') document.body.setAttribute('data-theme', 'light');
  else document.body.removeAttribute('data-theme');
  theme.textContent = state.theme === 'light' ? '☀' : '☾';
  units.textContent = state.useMetric ? 'cm → in' : 'in → cm';
  document.querySelectorAll('.history-unit').forEach((label) => { label.textContent = state.useMetric ? '(cm)' : '(in)'; });
}
syncControls();
theme.addEventListener('click', () => { setTheme(state.theme === 'light' ? 'dark' : 'light'); syncControls(); });
units.addEventListener('click', () => {
  const factor = state.useMetric ? 1 / 2.54 : 2.54;
  for (const id of ['history-min', 'history-max']) {
    if ($(id).value !== '') $(id).value = Number(($(id).valueAsNumber * factor).toFixed(4));
  }
  setUseMetric(!state.useMetric);
  syncControls();
  render();
});

function cell(row, value, className) {
  const td = row.insertCell();
  td.textContent = value;
  if (className) td.className = className;
  return td;
}

function render() {
  if (!catalog) return;
  const factor = state.useMetric ? 2.54 : 1;
  const min = $('history-min').value === '' ? 0 : $('history-min').valueAsNumber / factor;
  const max = $('history-max').value === '' ? Infinity : $('history-max').valueAsNumber / factor;
  const invalid = !Number.isFinite(min) || min < 0 || Number.isNaN(max) || max < 0 || min > max;
  $('history-range-error').hidden = !invalid;
  const records = invalid ? [] : historyRecords(resorts, catalog, {
    pass: $('history-pass').value, query: $('history-resort').value,
    season: $('history-season').value, min: min - 0.0001, max: max + 0.0001
  });
  const sort = $('history-sort').value;
  if (sort === 'snow-asc') records.sort((a, b) => a.total - b.total || a.resort.name.localeCompare(b.resort.name));
  if (sort === 'resort') records.sort((a, b) => a.resort.name.localeCompare(b.resort.name) || b.season.localeCompare(a.season));
  if (sort === 'season') records.sort((a, b) => b.season.localeCompare(a.season) || b.total - a.total);
  const uniqueResorts = new Set(records.map((record) => record.resort.id)).size;
  $('history-count').textContent = `${records.length} season records · ${uniqueResorts} resorts`;
  $('history-empty').hidden = records.length > 0 || invalid;
  $('history-rows').replaceChildren();
  const fragment = document.createDocumentFragment();
  const maximum = Math.max(...records.map((record) => record.total), 1);
  pageIndex = Math.min(pageIndex, Math.max(Math.ceil(records.length / pageSize) - 1, 0));
  const first = pageIndex * pageSize;
  $('history-page-count').textContent = records.length ? `${first + 1}–${Math.min(first + pageSize, records.length)} of ${records.length}` : '0 records';
  $('history-prev').disabled = pageIndex === 0;
  $('history-next').disabled = first + pageSize >= records.length;
  for (const record of records.slice(first, first + pageSize)) {
    const row = document.createElement('tr');
    const nameCell = cell(row, '');
    const name = document.createElement('a');
    name.href = `./#resort=${encodeURIComponent(record.resort.name.toLowerCase().replace(/\(.*?\)/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '-'))}`;
    name.textContent = record.resort.name;
    nameCell.appendChild(name);
    cell(row, formatPassLabel(record.resort), 'history-pass-cell');
    cell(row, record.season);
    const amount = cell(row, '', 'history-snow-cell');
    const bar = document.createElement('span');
    bar.className = 'history-mini-bar';
    bar.style.width = `${record.total / maximum * 100}%`;
    bar.setAttribute('aria-hidden', 'true');
    const value = document.createElement('strong');
    value.textContent = formatInches(record.total);
    amount.append(bar, value);
    const source = document.createElement('a');
    source.href = record.sourceUrl;
    source.textContent = 'ERA5 ↗';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    cell(row, '').appendChild(source);
    fragment.appendChild(row);
  }
  $('history-rows').appendChild(fragment);
  const summary = $('history-pass-summary');
  summary.replaceChildren();
  for (const [pass, label] of Object.entries(passLabels)) {
    const members = records.filter((record) => record.resort.passes.includes(pass));
    if ($('history-pass').value !== 'all' && $('history-pass').value !== pass) continue;
    const card = document.createElement('div');
    card.className = 'history-pass-card';
    const heading = document.createElement('h3');
    heading.textContent = label;
    const total = document.createElement('strong');
    total.textContent = members.length ? formatInches(members.reduce((sum, record) => sum + record.total, 0)) : '—';
    const detail = document.createElement('p');
    detail.textContent = `${members.length} resort-season records · ${new Set(members.map((record) => record.resort.id)).size} resorts`;
    const average = document.createElement('p');
    average.textContent = members.length ? `Average per resort-season: ${formatInches(members.reduce((sum, record) => sum + record.total, 0) / members.length)}` : 'No estimates for these filters';
    card.append(heading, total, detail, average);
    summary.appendChild(card);
  }
}

function refilter() { pageIndex = 0; render(); }
$('history-filters').addEventListener('input', refilter);
$('history-filters').addEventListener('change', refilter);
$('history-prev').addEventListener('click', () => { pageIndex--; render(); });
$('history-next').addEventListener('click', () => { pageIndex++; render(); });
$('history-filters').addEventListener('submit', (event) => event.preventDefault());
$('history-filters').addEventListener('reset', () => { $('history-sort').value = 'snow-desc'; setTimeout(refilter, 0); });
$('history-sort').addEventListener('change', refilter);

try {
  catalog = await fetchSnowfallCatalog();
  const available = historyRecords(resorts, catalog);
  for (const season of [...new Set(available.map((record) => record.season))].sort().reverse()) {
    const option = document.createElement('option');
    option.value = season;
    option.textContent = season;
    $('history-season').appendChild(option);
  }
  const covered = new Set(available.map((record) => record.resort.id)).size;
  const latest = [...new Set(available.map((record) => record.season))].sort().reverse()[0];
  if (latest) $('history-season').value = latest;
  const failures = Object.values(catalog.resorts).filter((entry) => entry.status === 'error' || entry.status === 'pending').length;
  const backfilling = Object.values(catalog.resorts).filter((entry) => !entry.historyStartDate || entry.historyStartDate > catalog.historyStartDate).length;
  $('history-status').textContent = `ERA5 model estimates · Archive from 1940 · Complete seasons available for ${covered} of ${resorts.length} resorts. Snowfall filters apply to each resort's season total.${backfilling ? ` Older seasons are still backfilling for ${backfilling} resorts.` : ''}${failures ? ` ${failures} resort archives are pending or failed to refresh.` : ''}`;
  $('history-updated').textContent = `Archive refreshed ${new Date(catalog.generatedAt).toLocaleString()}. ERA5 estimates typically lag by five days; the current chart shows the available cutoff.`;
  render();
} catch (error) {
  $('history-status').textContent = error.message;
  $('history-status').classList.add('snowfall-error');
  $('history-count').textContent = 'Records unavailable';
  console.error('Snowfall history:', error);
}

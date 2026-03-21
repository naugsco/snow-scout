import { resorts } from './resorts.js';
import { formatInches, formatRunAccess, formatPassLabel, getPassTone, formatTemperature } from './utils.js';
import { createSnowfallChart } from './snowfall-chart.js';

const MAX_COMPARE = 3;
const compareIds = [];

const compareBar = document.getElementById('compare-bar');
const compareChips = document.getElementById('compare-chips');
const compareGo = document.getElementById('compare-go');
const compareCancel = document.getElementById('compare-cancel');
const compareOverlay = document.getElementById('compare-overlay');
const compareGrid = document.getElementById('compare-grid');
const compareClose = document.getElementById('compare-close');

function getResort(id) {
  return resorts.find((r) => r.id === id) || null;
}

export function isComparing() {
  return compareIds.length > 0;
}

export function toggleCompareResort(id) {
  const index = compareIds.indexOf(id);
  if (index >= 0) {
    compareIds.splice(index, 1);
  } else if (compareIds.length < MAX_COMPARE) {
    compareIds.push(id);
  }
  renderCompareBar();
}

export function clearCompare() {
  compareIds.length = 0;
  renderCompareBar();
  compareOverlay.style.display = 'none';
}

function renderCompareBar() {
  if (!compareIds.length) {
    compareBar.style.display = 'none';
    return;
  }
  compareBar.style.display = 'flex';
  compareChips.innerHTML = '';
  compareIds.forEach((id) => {
    const resort = getResort(id);
    if (!resort) return;
    const chip = document.createElement('span');
    chip.className = 'compare-chip';
    chip.innerHTML = `${resort.name} <button data-id="${id}" class="compare-chip-remove">×</button>`;
    compareChips.appendChild(chip);
  });
  compareGo.disabled = compareIds.length < 2;
  compareGo.textContent = `Compare (${compareIds.length})`;

  // Wire remove buttons
  compareChips.querySelectorAll('.compare-chip-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCompareResort(btn.dataset.id);
    });
  });
}

function bestValue(resortsToCompare, metricKey, mode = 'max') {
  let best = mode === 'max' ? -Infinity : Infinity;
  let bestId = null;
  resortsToCompare.forEach((r) => {
    const val = r.metrics[metricKey];
    if (!Number.isFinite(val)) return;
    if ((mode === 'max' && val > best) || (mode === 'min' && val < best)) {
      best = val;
      bestId = r.id;
    }
  });
  return bestId;
}

function renderCompareOverlay() {
  const selected = compareIds.map(getResort).filter(Boolean);
  if (selected.length < 2) return;

  const metrics = [
    { key: 'snow24h', label: 'Fresh 24h', format: (v) => formatInches(v), best: 'max' },
    { key: 'forecast72h', label: 'Forecast 72h', format: (v) => formatInches(v), best: 'max' },
    { key: 'baseDepth', label: 'Base Depth', format: (v) => formatInches(v), best: 'max' },
    { key: 'runsOpen', label: 'Runs Open', format: (v) => Number.isFinite(v) ? String(v) : '—', best: 'max' },
    { key: 'groomedRuns', label: 'Groomed', format: (v) => Number.isFinite(v) ? String(v) : '—', best: 'max' },
    { key: 'tempF', label: 'Temp', format: (v) => formatTemperature(v), best: null },
    { key: 'daysSinceSnow', label: 'Days Since Snow', format: (v) => Number.isFinite(v) ? `${v}d` : '—', best: 'min' }
  ];

  const winners = {};
  metrics.forEach((m) => {
    if (m.best) winners[m.key] = bestValue(selected, m.key, m.best);
  });

  compareGrid.innerHTML = '';
  compareGrid.style.gridTemplateColumns = `repeat(${selected.length}, 1fr)`;

  selected.forEach((resort) => {
    const col = document.createElement('div');
    col.className = 'compare-column';

    // Header
    const header = document.createElement('div');
    header.className = 'compare-header';
    header.innerHTML = `
      <span class="status-dot ${resort.status}"></span>
      <strong>${resort.name}</strong>
      <span class="pass-tag ${getPassTone(resort)}">${formatPassLabel(resort)}</span>
    `;
    col.appendChild(header);

    // Metrics
    metrics.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'compare-metric';
      if (winners[m.key] === resort.id) row.classList.add('winner');
      row.innerHTML = `
        <span>${m.label}</span>
        <strong>${m.format(resort.metrics[m.key])}</strong>
      `;
      col.appendChild(row);
    });

    // Snowfall chart
    if (resort.liveForecast?.dailySnowfall?.length) {
      const chartWrap = document.createElement('div');
      chartWrap.className = 'compare-chart';
      const chart = createSnowfallChart(resort.liveForecast.dailySnowfall, resort.liveForecast.dailyTime);
      if (chart) chartWrap.appendChild(chart);
      col.appendChild(chartWrap);
    }

    compareGrid.appendChild(col);
  });

  compareOverlay.style.display = 'flex';
}

// Wire buttons
if (compareGo) {
  compareGo.addEventListener('click', () => renderCompareOverlay());
}
if (compareCancel) {
  compareCancel.addEventListener('click', () => clearCompare());
}
if (compareClose) {
  compareClose.addEventListener('click', () => { compareOverlay.style.display = 'none'; });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && compareOverlay.style.display !== 'none') {
    compareOverlay.style.display = 'none';
    e.stopPropagation();
  }
}, true);
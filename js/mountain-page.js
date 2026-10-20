import { RAW_RESORTS } from './constants.js?v=20261020-all-trails';
import { mountainConfig, mountainSlug } from './mountain-config.js?v=20261020-all-trails';
import { createMountain } from './painted-mountain.js?v=20261020-all-trails';
import { trailLegend } from './trail-style.js?v=20261020-all-trails';

const el = id => document.getElementById(id);
const requested = new URLSearchParams(location.search).get('resort');
const resort = RAW_RESORTS.find(item => mountainSlug(item.name) === requested);
let map, config, mode = 'orbit', liftsVisible = true, view = 'resort';

function fail(message) {
  console.error('Painted mountain:', message);
  el('loading').hidden = true;
  el('mountain-error').hidden = false;
  el('mountain-error').querySelector('p').textContent = message;
  el('mountain-view').dataset.error = message;
}

function chooseMode(value) {
  mode = value;
  map.setMode(value);
  el('orbit').setAttribute('aria-pressed', value === 'orbit');
  el('tilt').setAttribute('aria-pressed', value === 'tilt');
  el('map-hint').querySelector('span').textContent = `${value === 'orbit' ? 'Drag to rotate' : 'Drag to tilt'} · Scroll to zoom`;
}

function update(patch) {
  if (patch.ready) {
    el('loading').hidden = true;
    document.querySelectorAll('button[disabled]').forEach(button => { button.disabled = false; });
    el('mountain-area').disabled = false;
    el('mountain-view').dataset.ready = 'true';
    el('map-status').textContent = config.trailsUrl
      ? `${patch.runCount} mapped trail segments and ${patch.liftCount} lift segments loaded. Community mapping may be incomplete.`
      : 'Painted terrain loaded. Mapped trails and lifts are not available for this resort yet.';
  }
  if (patch.view) {
    view = patch.view;
    const globe = view === 'globe';
    el('mountain-name').textContent = globe ? 'YOUR NEXT MOUNTAIN' : resort.name.toUpperCase();
    el('mountain-description').textContent = globe ? 'Fly into a painted winter mountain.'
      : config.trailsUrl ? 'Painted winter terrain · Real terrain & mapped trails' : 'Painted winter terrain · Trail overlay unavailable';
    el('back-to-globe').querySelector('span').textContent = globe ? 'Fly to resort' : 'Back to globe';
    for (const id of ['camera-controls', 'zoom-controls', 'map-hint']) el(id).hidden = globe;
    el('area-picker').hidden = globe || !config.views.length;
    el('coverage-info').hidden = globe;
    el('trail-legend').hidden = globe || !config.trailsUrl;
    el('coverage-note').hidden = globe || Boolean(config.trailsUrl);
    el('fly-in').hidden = !globe;
  }
  if ('selection' in patch) {
    el('trail-selection').hidden = !patch.selection;
    if (patch.selection) {
      const selection = patch.selection;
      el('trail-selection').querySelector('span').textContent = selection.kind === 'lift' ? 'MAPPED LIFT' : `${selection.difficulty || 'unrated'} RUN`.toUpperCase();
      el('trail-selection').querySelector('strong').textContent = selection.name || 'Unnamed mapped route';
    }
  }
}

el('reload').addEventListener('click', () => location.reload());
el('close-trail').addEventListener('click', () => update({selection: null}));
el('orbit').addEventListener('click', () => { chooseMode('orbit'); map.rotate(); });
el('tilt').addEventListener('click', () => { chooseMode('tilt'); map.tilt(); });
el('reset').addEventListener('click', () => { chooseMode('orbit'); map.reset(); });
el('zoom-in').addEventListener('click', () => map.zoom(0.8));
el('zoom-out').addEventListener('click', () => map.zoom(1.25));
el('lifts').addEventListener('click', () => {
  liftsVisible = !liftsVisible;
  map.showLifts(liftsVisible);
  el('lifts').setAttribute('aria-pressed', liftsVisible);
});
function flyIn() {
  chooseMode('orbit');
  liftsVisible = true;
  el('lifts').setAttribute('aria-pressed', true);
  map.flyIn();
}
el('fly-in').addEventListener('click', flyIn);
el('back-to-globe').addEventListener('click', () => view === 'globe' ? flyIn() : map.globe());
el('mountain-area').addEventListener('change', async () => {
  el('mountain-area').disabled = true;
  update({selection: null});
  try {
    await map.focusArea(el('mountain-area').value);
    chooseMode('orbit');
    liftsVisible = true;
    el('lifts').setAttribute('aria-pressed', true);
  } catch (error) {
    fail(error.message);
  } finally {
    el('mountain-area').disabled = false;
  }
});

if (!resort) {
  fail('Choose a resort from Snow Scout to open its 3D mountain.');
} else {
  config = mountainConfig(resort);
  document.title = `${resort.name} in 3D — Snow Scout`;
  el('resort-details').href = `./#resort=${encodeURIComponent(mountainSlug(resort.name))}`;
  el('fly-in').querySelector('span').textContent = `Explore ${resort.name}`;
  el('osm-credit').hidden = !config.trailsUrl;
  if (config.coverage.source === 'OpenSkiData') {
    el('osm-credit').href = 'https://www.openskidata.org/#license';
    el('osm-credit').textContent = "OpenSkiData / OpenSkiMap.org · © OpenStreetMap contributors (ODbL) · Skimap.org · Who's On First · © Mapterhorn";
  }
  for (const view of config.views.slice().sort((a,b)=>a.name.localeCompare(b.name))) {
    const option = document.createElement('option');
    option.value = view.id;
    option.textContent = view.name;
    el('mountain-area').appendChild(option);
  }
  el('coverage-counts').textContent = `${config.coverage.trails.toLocaleString()} trail segments · ${config.coverage.lifts.toLocaleString()} lift segments`;
  el('mapped-areas').textContent = `Mapped areas: ${config.coverage.areas.map(area=>area.name).join(' · ')}. ${config.coverage.note}`;
  el('coverage-date').textContent = `Source: ${config.coverage.source}. Map snapshot: ${config.coverage.timestamp.slice(0,10)}.`;
  el('download-trails').href = config.trailsUrl;
  el('trail-legend').querySelectorAll(':scope > span').forEach(span=>span.remove());
  for (const [name, icon] of trailLegend(config.convention)) {
    const item = document.createElement('span');
    const image = document.createElement('img');
    image.className = 'icon'; image.alt = '';
    image.src = `assets/mountain-icons/${icon}`;
    item.append(image, document.createTextNode(name));
    el('trail-legend').insertBefore(item, el('lifts'));
  }
  update({view: 'resort'});
  createMountain(el('mountain-view'), update, fail, config)
    .then(instance => { map = instance; })
    .catch(error => fail(error.message));
  window.addEventListener('pagehide', () => { if (map) { map.destroy(); map = null; } });
  // Recreate the WebGL viewer when returning through the browser's back cache.
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
}

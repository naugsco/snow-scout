import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWeatherLayers } from '../js/weather-layers.js';

let fixtureIndex=0;
function fixture(base = `/api/weather-test-${++fixtureIndex}`) {
  const layers = [];
  const requests = [];
  const now = Math.floor(Date.now() / 1000);
  globalThis.Cesium = {
    UrlTemplateImageryProvider: class {
      constructor(options) { Object.assign(this, options); this.errorEvent = { addEventListener(callback) { this.callback=callback; } }; this.requestImage=()=>Promise.resolve('test-image'); }
    },
    WebMercatorTilingScheme: class {},
    Credit: class {}
  };
  globalThis.fetch = async url => {
    requests.push(url);
    if (url.includes('weather-maps.json')) return { ok: true, json: async () => ({
      host: 'https://tilecache.rainviewer.com',
      radar: { past: Array.from({ length: 13 }, (_, i) => ({ time: now - (12 - i) * 600, path: `/radar/${i}` })) }
    }) };
    if (url.endsWith('/status')) return {ok:true,json:async()=>({enabled:true})};
    return { ok: true, headers: new Headers({ 'content-type': 'image/png' }) };
  };
  const viewer = { imageryLayers: {
    addImageryProvider(provider) { const layer = { provider }; layers.push(layer); return layer; },
    remove(layer, destroy) {
      const index = layers.indexOf(layer);
      assert.ok(index >= 0);
      assert.equal(destroy, true);
      layers.splice(index, 1);
    }
  } };
  return { weather: createWeatherLayers(viewer,{weatherApiBase:base}), layers, requests };
}

test('radar retains at most three layers while the whole observed timeline stays accessible', async () => {
  const { weather, layers } = fixture();
  await weather.addLayer('radar');
  assert.equal(layers.length, 1);
  assert.equal(weather.getRadarFrameIndex(), 12);
  for (const index of [0, 1, 2, 10, 11, 12, 0]) {
    weather.showRadarFrame(index);
    assert.equal(weather.getRadarFrameIndex(), index);
    assert.equal(layers.filter(layer => layer.show).length, 1);
    assert.ok(layers.length <= 3);
  }
  weather.setLayerOpacity(0.3);
  assert.equal(layers.find(layer => layer.show).alpha, 0.3);
  weather.startRadarAnimation();
  assert.equal(weather.isAnimating(), true);
  weather.destroy();
  assert.equal(weather.isAnimating(), false);
  assert.equal(layers.length, 0);
});

test('maps own independent weather state and duplicate requests do not add duplicate layers', async () => {
  const a = fixture();
  const b = fixture();
  await Promise.all([a.weather.addLayer('clouds'), a.weather.addLayer('clouds')]);
  await a.weather.addLayer('precipitation');
  assert.equal(a.layers.length, 2);
  assert.deepEqual([...b.weather.getActiveLayerIds()], []);
  await a.weather.toggleLayer('clouds');
  assert.deepEqual([...a.weather.getActiveLayerIds()], ['precipitation']);
  a.weather.destroy(); b.weather.destroy();
});

test('provider/configuration errors surface without marking an unavailable layer active', async () => {
  const { weather, layers } = fixture();
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  await assert.rejects(weather.addLayer('temp'), /weather service/);
  assert.equal(weather.isLayerActive('temp'), false);
  assert.equal(layers.length, 0);
  weather.destroy();
});

test('closing a map during a pending weather request prevents layers being added after teardown', async () => {
  const { weather, layers } = fixture();
  const fetchBefore = globalThis.fetch;
  let release;
  globalThis.fetch = url => url.endsWith('/status')
    ? new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ enabled:true }) }); })
    : fetchBefore(url);
  const pending = weather.addLayer('clouds');
  weather.destroy();
  release();
  await pending;
  assert.equal(layers.length, 0);
  await assert.rejects(weather.addLayer('radar'), /closed/);
});

test('all maps sharing a gateway stop OpenWeather on a tile failure; radar stays active', async () => {
  const base='/api/shared-weather'; const a=fixture(base), b=fixture(base);
  await a.weather.addLayer('radar');
  await a.weather.addLayer('clouds'); await b.weather.addLayer('temp');
  const provider=a.layers.find(l=>l.provider.url.includes('/tiles/')).provider;
  assert.ok(!provider.url.includes('appid'));
  const failure={retry:true}; provider.errorEvent.callback(failure);
  assert.equal(failure.retry,false);
  assert.equal(a.weather.isLayerActive('clouds'),false);
  assert.equal(b.weather.isLayerActive('temp'),false);
  assert.equal(a.weather.isLayerActive('radar'),true);
  assert.equal(provider.requestImage(0,0,0),undefined);
  const before=b.requests.length;
  await assert.rejects(b.weather.addLayer('temp'),/paused/);
  assert.equal(b.requests.length,before);
  a.weather.destroy();b.weather.destroy();
});
test('unconfigured deployments never fetch a local key or direct OpenWeather tiles', async()=>{
  const f=fixture(); const w=createWeatherLayers({}, {weatherApiBase:null});
  await assert.rejects(w.addLayer('clouds'),/Direct OpenWeather access is disabled/);
  assert.equal(f.requests.length,0);w.destroy();f.weather.destroy();
});

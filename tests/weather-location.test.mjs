import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resorts } from '../js/resorts.js';
import { WEATHER_LOCATIONS } from '../js/weather-locations-data.js';
import { weatherLocation } from '../js/weather-location.js';
import { weatherUrl, forecastMatchesLocation } from '../js/weather-data.js';
import { currentSnowUrl, loadCurrentSnow } from '../js/current-snow.js';
import { parseVailTerrain } from '../scripts/fetch_resort_conditions.mjs';
import { chooseConditions } from '../js/condition-selection.js';

test('every destination has a reproducible weather point on its actual mapped terrain', async () => {
  assert.deepEqual(Object.keys(WEATHER_LOCATIONS).sort(),resorts.map(r=>r.name).sort());
  for (const resort of resorts) {
    const p = weatherLocation(resort);
    const data = JSON.parse(await readFile(new URL(`../data/trails/${p.terrainFile}`,import.meta.url)));
    const feature = data.features.find(f=>f.properties.id===p.featureId);
    assert.ok(feature,resort.name);
    assert.ok(feature.geometry.coordinates.some(c=>c[0]===p.lon&&c[1]===p.lat),resort.name);
    assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon),resort.name);
    assert.ok(new URL(p.sourceUrl).protocol==='https:');
    const forecast = new URL(weatherUrl(resort));
    const current = new URL(currentSnowUrl([resort]));
    for (const k of ['latitude','longitude','elevation']) assert.equal(forecast.searchParams.get(k),current.searchParams.get(k),resort.name);
  }
});

test('Whistler uses sourced Roundhouse elevation; old village forecasts cannot enter its cache', () => {
  const r=resorts.find(r=>r.name==='Whistler Blackcomb');
  const url=new URL(weatherUrl(r));
  assert.equal(url.searchParams.get('elevation'),'1850');
  assert.notEqual(url.searchParams.get('latitude'),r.lat.toFixed(4));
  assert.equal(forecastMatchesLocation(r,{apiUrl:weatherUrl(r)}),true);
  assert.equal(forecastMatchesLocation(r,{apiUrl:'https://api.open-meteo.com/v1/forecast?latitude=50.1163&longitude=-122.9574'}),false);
  assert.equal(forecastMatchesLocation(r,{apiUrl:'broken'}),false);
});

test('mixed explicit and DEM elevations are partitioned without disabling terrain downscaling', async () => {
  const list=resorts.filter(r=>['Whistler Blackcomb','Vail'].includes(r.name)).map(r=>({...r}));
  const urls=[];const now=Date.now();
  await loadCurrentSnow(list,null,now,async url=>{
    urls.push(new URL(url));
    return{ok:true,json:async()=>({elevation:1850,current_units:{snowfall:'cm',time:'unixtime'},current:{time:Math.floor(now/1000),interval:900,snowfall:0}})};
  });
  assert.equal(urls.length,2);
  assert.deepEqual(urls.map(u=>u.searchParams.get('elevation')).sort(),[null,'1850'].sort());
  assert.ok(urls.every(u=>!String(u).includes('nan')));
  assert.ok(list.every(r=>r.currentSnow.snowfallCm===0));
});

test('Whistler explicitly offline operations stay unknown; unrelated missing feeds still raise errors',()=>{
  const r=parseVailTerrain('<p>Whistler Blackcomb Trail &amp; Lift Status is currently offline and will be back before Winter Opening Day.</p>');
  assert.equal(r.terrainStatus,'unavailable');assert.equal(r.terrainReportedAt,null);assert.deepEqual(r.metrics,{});
  assert.throws(()=>parseVailTerrain('<p>Unexpected page</p>'),/Assignment token/);
  assert.throws(()=>parseVailTerrain('<!-- Whistler Blackcomb Trail &amp; Lift Status is currently offline and will be back before Winter Opening Day. -->'),/Assignment token/);
});

test('a fresh model at an old location is replaced without discarding independent official terrain',()=>{
  const now=Date.parse('2026-11-06T21:20:00Z');const stamp=new Date(now).toISOString();
  const old={adapter:'vail',snowSourceKind:'model',checkedAt:stamp,snowReportedAt:stamp,terrainReportedAt:stamp,snowStatus:'ready',terrainStatus:'ready',metrics:{snow24h:0,snow48h:0,snow72h:0,runsOpen:2,runsTotal:10},sources:{weatherModel:'https://example.org/village'}};
  const forecast={status:'ok',apiUrl:'https://example.org/mountain',updatedAt:stamp,forecast72h:3,utcOffsetSeconds:0,dailyTime:['2026-11-06','2026-11-07','2026-11-08'],dailySnowfall:[1,1,1],periodEnd:'2026-11-09T21:00:00Z',recentConditionsAt:stamp,recentConditions:{snow24h:1,snow48h:2,snow72h:3},weatherLocation:{elevationM:1850}};
  const selected=chooseConditions(old,stamp,forecast,now);
  assert.equal(selected.metrics.snow24h,1);assert.equal(selected.metrics.runsOpen,2);assert.equal(selected.terrainStatus,'ready');assert.match(selected.note,/1850 m/);
});

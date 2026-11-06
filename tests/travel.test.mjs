import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, writeFile, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RAW_RESORTS } from '../js/constants.js';
import { localDate, addDays, validDate, validateTrip, nearbyAirports, kayakFlightUrl, directionsUrl, lodgingUrl, stormContext } from '../js/travel.js';
import { kayakSettings, searchBody, normalizeResponse, searchKayak } from '../server/kayak.mjs';
import { createTravelServer } from '../server/travel-server.mjs';

const today = localDate();
const trip = { origin:'YVR', destination:'RNO', departure:addDays(today, 10), returnDate:addDays(today, 14), adults:2, currency:'CAD' };
const settings = { mode:'sandbox', base:'https://sandbox-en-us.kayakaffiliates.com', key:'test-secret-never-send-to-browser' };
const client = { userTrackId:'session-uuid', userAgent:'test-browser', ip:'127.0.0.1' };
// Synthetic contract fixtures, never included in public site assets.
function response() { return {
  status:'complete', searchId:'test-search', cluster:'4', currency:'CAD', priceMode:'perPerson',
  results:[{ legs:[{id:'out'},{id:'back'}], bookingOptions:[{type:'regular', providerCode:'test', displayPrice:{price:450}, bookingUrl:'https://sandbox-en-us.kayakaffiliates.com/in?url=test', fees:{nonRefundableDisclosure:'Not refundable'}, segmentFares:[{isSelfTransfer:true}], fareFamilies:[{displayName:'Test economy', amenities:[{code:'checkedBag',displayName:'Checked bag costs extra'}]}]}] }],
  legs:{out:{segments:[{id:'s1'}],departureTime:`${trip.departure}T09:00:00`,arrivalTime:`${trip.departure}T11:00:00`,duration:120},back:{segments:[{id:'s2'}],departureTime:`${trip.returnDate}T12:00:00`,arrivalTime:`${trip.returnDate}T14:00:00`,duration:120}},
  segments:{s1:{origin:'YVR',destination:'RNO',departureTime:'09:00',arrivalTime:'11:00',operationalDisplay:'Operated by Test Airline'},s2:{origin:'RNO',destination:'YVR',departureTime:'12:00',arrivalTime:'14:00'}},providers:{test:{displayName:'Test provider'}}
}; }
test('dates validate strictly and use calendar days over month/leap boundaries', () => {
  assert.equal(addDays('2028-02-28', 1),'2028-02-29');
  assert.equal(addDays('2026-12-31', 1),'2027-01-01');
  assert.equal(validDate('2026-02-30'),false);
  for (const change of [{origin:'<x>'},{destination:'YVR'},{adults:0},{adults:1.5},{currency:'XXX'},{departure:addDays(today,-1)},{returnDate:trip.departure},{returnDate:addDays(today,331)}]) assert.throws(() => validateTrip({...trip,...change}));
  assert.equal(validateTrip(trip),trip);
});
test('external search carries the actual round trip and adults without claiming affiliate attribution or currency', () => {
  const url = new URL(kayakFlightUrl(trip));
  assert.equal(url.hostname,'www.kayak.com');
  assert.equal(url.pathname,`/flights/YVR-RNO/${trip.departure}/${trip.returnDate}/2adults`);
  assert.equal(url.searchParams.has('currency'),false);
  assert.equal(url.searchParams.has('affiliate'),false);
});
test('airport catalog supports all resorts and prioritizes large gateways without invented distances', async () => {
  const data = JSON.parse(await readFile(new URL('../data/travel-airports.json',import.meta.url)));
  assert.ok(data.source.includes('ourairports.com'));
  assert.equal(new Set(data.airports.map(a=>a.code)).size,data.airports.length);
  for (const r of RAW_RESORTS) { const choices = nearbyAirports(r,data.airports); assert.ok(choices.length, r.name); assert.ok(choices.every(a=>Number.isFinite(a.distance)&&a.distance>=0&&a.distance<=800)); }
  assert.equal(nearbyAirports(RAW_RESORTS.find(r=>r.name==='Heavenly'),data.airports)[0].code,'RNO');
  assert.equal(nearbyAirports(RAW_RESORTS.find(r=>r.name==='Niseko United'),data.airports)[0].code,'CTS');
});
test('ground links use real coordinates and explicitly select driving or transit', () => {
  const resort = {name:"Val d'Isère",lat:45.45,lon:6.98}; const airport={lat:46.23,lon:6.11};
  const url = new URL(directionsUrl(resort,airport,true));
  assert.equal(url.searchParams.get('origin'),'46.23,6.11');
  assert.equal(url.searchParams.get('destination'),'45.45,6.98');
  assert.equal(url.searchParams.get('travelmode'),'transit');
  assert.ok(new URL(lodgingUrl(resort)).searchParams.get('query').includes(resort.name));
});
test('storm context withholds stale or missing forecasts and never fabricates snow', () => {
  const now = Date.parse('2026-12-01T12:00:00Z');
  const resort={liveForecast:{updatedAt:'2026-12-01T11:00:00Z',dailyTime:['2026-12-01','2026-12-02','2026-12-03'],dailySnowfall:[0,5,null]}};
  assert.equal(stormContext(resort,now).date,'2026-12-02');
  assert.equal(stormContext(resort,now+7*3600000),null);
  assert.equal(stormContext({},now),null);
});
test('credentials default off and sandbox cannot masquerade as live', () => {
  assert.deepEqual(kayakSettings({}),{mode:'off'});
  assert.throws(()=>kayakSettings({KAYAK_MODE:'sandbox'}));
  assert.throws(()=>kayakSettings({KAYAK_MODE:'live',KAYAK_API_KEY:'secret',KAYAK_BASE_URL:settings.base}));
  for (const base of ['http://partner.kayakaffiliates.com','https://evil.example','https://partner.kayakaffiliates.com.evil.example','https://partner.kayakaffiliates.com/?apiKey=x']) assert.throws(()=>kayakSettings({KAYAK_MODE:'live',KAYAK_API_KEY:'secret',KAYAK_BASE_URL:base}));
});
test('request uses two exact legs, passenger count, currency and excludes split bookings', () => {
  const body=searchBody(trip);
  assert.deepEqual(body.searchStartParameters.passengers,['ADT','ADT']);
  assert.equal(body.searchStartParameters.legs[1].origin.airports[0],'RNO');
  assert.equal(body.searchStartParameters.legs[1].date,trip.returnDate);
  assert.equal(body.searchStartParameters.filters.includeSplit,false);
  assert.equal(body.resultParameters.currency,'CAD');
});
test('normalization preserves fare basis, timing, operating carrier and fare disclosures', () => {
  const result=normalizeResponse(response(),'sandbox');
  assert.equal(result.mode,'sandbox'); assert.equal(result.priceMode,'perPerson'); assert.equal(result.currency,'CAD');
  assert.equal(result.offers[0].legs[0].stops,0);
  assert.ok(result.offers[0].disclosures.includes('Not refundable'));
  assert.ok(result.offers[0].disclosures.includes('Operated by Test Airline'));
  assert.ok(result.offers[0].disclosures.some(x=>x.includes('Self-transfer')));
});
test('schedule-only prices are omitted; malformed fares, links and timing raise errors', () => {
  let data=response(); data.results[0].bookingOptions[0].displayPrice.price=-1;
  assert.equal(normalizeResponse(data,'sandbox').offers.length,0);
  for (const price of [null,NaN,0,-2]) { data=response(); data.results[0].bookingOptions[0].displayPrice.price=price; assert.throws(()=>normalizeResponse(data,'sandbox')); }
  for (const url of ['javascript:alert(1)','https://example.com/?apiKey=secret']) {data=response(); data.results[0].bookingOptions[0].bookingUrl=url; assert.throws(()=>normalizeResponse(data,'sandbox'));}
  data=response(); delete data.legs.out; assert.throws(()=>normalizeResponse(data,'sandbox'));
});
test('polling carries cluster/session, is bounded and forwards actual client headers', async () => {
  const requests=[];
  const result=await searchKayak(trip,settings,client,{pause:async()=>{},fetchImpl:async(url,options)=>{ requests.push({url:new URL(url),options}); const data=response(); if(requests.length===1)data.status='first-phase'; return Response.json(data); }});
  assert.equal(requests.length,2); assert.equal(result.complete,true);
  assert.equal(requests[1].url.searchParams.get('cluster'),'4');
  assert.equal(requests[1].url.searchParams.get('userTrackId'),client.userTrackId);
  assert.equal(requests[1].options.headers['User-Agent'],client.userAgent);
  assert.equal(JSON.parse(requests[1].options.body).searchId,'test-search');
  assert.ok(!JSON.stringify(result).includes(settings.key));
  let count=0;
  const partial=await searchKayak(trip,settings,client,{pause:async()=>{},fetchImpl:async()=>{count++;return Response.json({...response(),status:'second-phase'});}});
  assert.equal(count,8); assert.equal(partial.complete,false);
});
test('upstream failures never disclose API-key-bearing URLs or error bodies', async () => {
  await assert.rejects(searchKayak(trip,settings,client,{fetchImpl:async()=>{throw new Error(`failed https://host/?apiKey=${settings.key}`);}}), error=>!error.message.includes(settings.key));
  await assert.rejects(searchKayak(trip,settings,client,{fetchImpl:async()=>Response.json({errorMessage:settings.key},{status:401})}), /HTTP 401/);
  await assert.rejects(searchKayak(trip,settings,client,{fetchImpl:async()=>Response.json({...response(),currency:'USD'})}),/different currency/);
});
test('local gateway excludes secrets, rejects cross-origin requests and reuses per-session identity', async t => {
  const temp=await mkdtemp(path.join(tmpdir(),'snow-travel-test-')); const publicDir=await realpath(temp);
  await writeFile(path.join(publicDir,'index.html'),'Snow Scout');
  const clients=[];
  const server=createTravelServer({publicDir,settings,airports:[{code:'YVR'},{code:'RNO'}],search:async(_t,_s,client)=>{clients.push(client);return normalizeResponse(response(),'sandbox');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin+'/.env.travel')).status,404);
  assert.equal((await (await fetch(origin+'/api/weather/status')).json()).enabled,false);
  assert.equal((await fetch(origin+'/api/weather/tiles/temp_new/0/0/0.png')).status,503);
  const weatherConfig=await (await fetch(origin+'/js/weather-config.js')).text();
  assert.ok(weatherConfig.includes('/api/weather'));
  assert.ok(!weatherConfig.includes(settings.key));

  const config=await (await fetch(origin+'/js/travel-config.js')).text(); assert.ok(!config.includes(settings.key));
  assert.equal((await fetch(origin+'/api/travel/search',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify(trip)})).status,403);
  const first=await fetch(origin+'/api/travel/search',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'User-Agent':'real-test-browser'},body:JSON.stringify(trip)});
  assert.equal(first.status,200);
  const cookie=first.headers.get('set-cookie').split(';')[0];
  const second=await fetch(origin+'/api/travel/search',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(trip)});
  assert.equal(second.status,200); assert.equal(clients[0].userTrackId,clients[1].userTrackId); assert.equal(clients[0].userAgent,'real-test-browser');
});

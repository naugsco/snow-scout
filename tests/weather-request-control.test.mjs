import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWeatherTileGateway} from '../server/weather-tiles.mjs';
const png=()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});
function fixture(fetchImpl=async()=>png(),limit=45){let time=0,calls=0;const g=createWeatherTileGateway({key:'test-secret',enabled:true,now:()=>time,limit,fetchImpl:(...args)=>{calls++;return fetchImpl(...args);}});return {g,ready(){time=60000;},advance(ms){time+=ms;},get calls(){return calls;}};}
test('disabled service and restart warmup make no provider calls',async()=>{
 let calls=0;const off=createWeatherTileGateway({key:'test-secret',fetchImpl:async()=>{calls++;return png();}});
 assert.equal((await off.tile('temp_new',0,0,0)).status,503);assert.equal(calls,0);
 const f=fixture();assert.equal((await f.g.tile('temp_new',0,0,0)).status,503);assert.equal(f.calls,0);f.ready();assert.equal((await f.g.tile('temp_new',0,0,0)).status,200);
});
test('rolling budget includes all layers and concurrent unique requests, and recovers only after 60 seconds',async()=>{
 const f=fixture();f.ready();
 const results=await Promise.all(Array.from({length:55},(_,i)=>f.g.tile(['temp_new','clouds_new','precipitation_new'][i%3],6,i,0)));
 assert.equal(f.calls,45);assert.equal(results.filter(r=>r.status===429).length,10);
 f.advance(59999);assert.equal((await f.g.tile('temp_new',0,0,0)).status,429);assert.equal(f.calls,45);
 f.advance(1);assert.equal((await f.g.tile('temp_new',0,0,0)).status,200);assert.equal(f.calls,46);
});
test('identical in-flight tiles share one upstream call',async()=>{
 let release;const f=fixture(()=>new Promise(r=>{release=()=>r(png());}));f.ready();
 const a=f.g.tile('clouds_new',1,0,0),b=f.g.tile('clouds_new',1,0,0);assert.equal(f.calls,1);release();assert.equal((await a).status,200);assert.equal((await b).status,200);
});
test('provider quota errors stop every layer, honor Retry-After, and do not auto retry',async()=>{
 const f=fixture(async()=>new Response('blocked',{status:429,headers:{'Retry-After':'1800'}}));f.ready();
 assert.equal((await f.g.tile('temp_new',0,0,0)).status,429);assert.equal(f.calls,1);
 f.advance(900000);assert.equal((await f.g.tile('clouds_new',0,0,0)).status,503);assert.equal(f.calls,1);
 f.advance(900000);assert.equal((await f.g.tile('clouds_new',0,0,0)).status,429);assert.equal(f.calls,2);
});
test('auth rejection requires service reconfiguration, even after long waits',async()=>{
 for(const status of [401,403]){const f=fixture(async()=>new Response('secret-body',{status}));f.ready();await f.g.tile('clouds_new',0,0,0);f.advance(86400000);const r=await f.g.tile('temp_new',0,0,0);assert.equal(r.status,503);assert.equal(f.calls,1);assert.ok(!JSON.stringify(r).includes('secret-body'));}
});
test('network errors, redirects, invalid bodies and invalid coordinates never create a retry storm or leak secrets',async()=>{
 const f=fixture(async()=>{throw new Error('https://host/?appid=test-secret');});f.ready();const r=await f.g.tile('temp_new',0,0,0);assert.ok(!JSON.stringify(r).includes('test-secret'));await f.g.tile('clouds_new',0,0,0);assert.equal(f.calls,1);
 const invalid=fixture();invalid.ready();for(const args of [['temp_new',0,1,0],['temp_new',7,0,0],['bad',0,0,0]]) assert.equal((await invalid.g.tile(...args)).status,400);assert.equal(invalid.calls,0);
 const bad=fixture(async()=>new Response('html',{headers:{'Content-Type':'text/html'}}));bad.ready();assert.equal((await bad.g.tile('temp_new',0,0,0)).status,502);await bad.g.tile('temp_new',0,0,0);assert.equal(bad.calls,1);
});

test('persistent reservations and provider cooldown survive a new gateway instance',async()=>{
 let saved, calls=0,time=60000;
 const options={key:'test-secret',enabled:true,now:()=>time,state:{starts:[],blockedUntil:0,permanentlyBlocked:false,pausedMessage:''},persist:async state=>{saved=structuredClone(state);},fetchImpl:async()=>{calls++;return new Response('blocked',{status:429,headers:{'Retry-After':'1800'}});}};
 const first=createWeatherTileGateway(options);await first.tile('temp_new',0,0,0);
 assert.equal(saved.starts.length,1);assert.equal(saved.blockedUntil,1860000);
 const restarted=createWeatherTileGateway({...options,state:structuredClone(saved)});
 assert.equal((await restarted.tile('clouds_new',0,0,0)).status,503);assert.equal(calls,1);
});
test('storage failure prevents the upstream request and keeps the local circuit open',async()=>{
 let calls=0;const g=createWeatherTileGateway({key:'test-secret',enabled:true,state:{starts:[],blockedUntil:0,permanentlyBlocked:false,pausedMessage:''},persist:async()=>{throw new Error('storage down');},fetchImpl:async()=>{calls++;return png();}});
 assert.equal((await g.tile('temp_new',0,0,0)).status,503);
 assert.equal((await g.tile('clouds_new',0,0,0)).status,503);assert.equal(calls,0);
});

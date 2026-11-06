import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{WeatherAccount} from '../worker/index.mjs';
const origin='https://naugsco.github.io';
test('public gateway restricts origin and methods before contacting its Durable Object',async()=>{
 const env={WEATHER_ACCOUNT:{idFromName(){throw new Error('must not route');}}};
 for(const request of [new Request('https://worker/api/weather/tiles/temp_new/0/0/0.png'),new Request('https://worker/api/weather/status',{headers:{Origin:'https://bad.example'}})])assert.equal((await worker.fetch(request,env)).status,403);
 assert.equal((await worker.fetch(new Request('https://worker/api/weather/status',{method:'POST',headers:{Origin:origin}}),env)).status,405);
 assert.equal((await worker.fetch(new Request('https://worker/health'),env)).status,200);
 const preflight=await worker.fetch(new Request('https://worker/api/weather/status',{method:'OPTIONS',headers:{Origin:origin}}),env);
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
});
test('allowed requests route to one fixed account object and preserve retry/cors headers',async()=>{
 let name;const env={WEATHER_ACCOUNT:{idFromName(n){name=n;return 'one';},get(id){assert.equal(id,'one');return {fetch:async()=>new Response('paused',{status:503,headers:{'Retry-After':'900'}})};}}};
 const response=await worker.fetch(new Request('https://worker/api/weather/tiles/temp_new/0/0/0.png',{headers:{Origin:origin}}),env);
 assert.equal(name,'openweather-account-v1');assert.equal(response.status,503);assert.equal(response.headers.get('Retry-After'),'900');assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
});
test('actual account class persists initialization and stays paused without a key',async()=>{
 let saved,ready;const ctx={storage:{get:async()=>saved,put:async(_key,value)=>{saved=structuredClone(value);}},blockConcurrencyWhile:callback=>{ready=callback();}};
 const account=new WeatherAccount(ctx,{OPENWEATHER_ENABLED:'false'});await ready;
 assert.ok(saved.starts);assert.equal((await (await account.fetch(new Request('https://worker/api/weather/status'))).json()).enabled,false);
 assert.equal((await account.fetch(new Request('https://worker/api/weather/tiles/temp_new/0/0/0.png'))).status,503);
});

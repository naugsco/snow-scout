import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, snowForSkiDates, dailyTripForecast, GATEWAYS } from '../js/trip-planning.js';
import { localDate, addDays } from '../js/travel.js';
const today=localDate();
const plan={origin:'YVR',departure:today,arrival:addDays(today,1),skiStart:addDays(today,2),skiEnd:addDays(today,3),returnDate:addDays(today,4),adults:1,currency:'CAD',budget:''};
test('two travel dates suffice; ski dates are validated only when explicitly enabled',()=>{
 assert.equal(validatePlan(plan),plan);
 assert.doesNotThrow(()=>validatePlan({...plan,arrival:undefined,skiStart:'',skiEnd:''}));
 for(const change of [{returnDate:today},{budget:-1},{origin:'<x>'},{adults:0}]) assert.throws(()=>validatePlan({...plan,...change}));
 assert.doesNotThrow(()=>validatePlan({...plan,customSkiDates:true}));
 for(const change of [{skiStart:''},{skiEnd:today},{skiEnd:addDays(today,5)}]) assert.throws(()=>validatePlan({...plan,customSkiDates:true,...change}));
});
test('only a complete fresh forecast for actual ski days supplies a snow total',()=>{
 const now=Date.now(),start=addDays(today,2),end=addDays(today,3);
 const r={liveForecastStatus:'ready',liveForecast:{updatedAt:new Date(now).toISOString(),dailyTime:[start,end],dailySnowfall:[0,2]}};
 assert.equal(snowForSkiDates(r,start,end,now),2);
 assert.equal(snowForSkiDates(r,start,addDays(end,1),now),null);
 assert.equal(snowForSkiDates(r,start,end,now+7*3600000),null);
 r.liveForecast.dailySnowfall=[0,null];assert.equal(snowForSkiDates(r,start,end,now),null);
 r.liveForecast.dailySnowfall=[0,0];assert.equal(snowForSkiDates(r,start,end,now),0);
 r.liveForecastStatus='error';assert.equal(snowForSkiDates(r,start,end,now),null);
});
test('curated gateways identify sources without inventing schedules or travel times',()=>{
 assert.equal(GATEWAYS['Heavenly'].code,'RNO');assert.equal(GATEWAYS['Niseko United'].code,'CTS');
 for(const g of Object.values(GATEWAYS)){assert.equal(new URL(g.url).protocol,'https:');assert.ok(g.note);}
});

test('daily forecasts retain real zero and withhold stale days without estimating a trip total',()=>{
 const now=Date.now(), f={liveForecastStatus:'ready',liveForecast:{updatedAt:new Date(now).toISOString(),dailyTime:[today,addDays(today,1),addDays(today,2)],dailySnowfall:[0,null,2]}};
 assert.deepEqual(dailyTripForecast(f,today,addDays(today,1),now),[{date:today,snow:0}]);
 assert.deepEqual(dailyTripForecast(f,today,addDays(today,2),now+7*3600000),[]);
});

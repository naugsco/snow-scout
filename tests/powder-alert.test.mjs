import assert from 'node:assert/strict';
import {test} from 'node:test';
import {weightedPowderScore,powderAlert,remainingTodaySnow} from '../js/powder-alert.js';
import {rankResorts} from '../js/heatmap-metrics.js';
const now=Date.now();
function fixture(offset=0,at=now) {
  const date=new Date(at+offset*1000).toISOString().slice(0,10);
  const start=Math.floor(at/3600000)*3600000;
  const end=Date.parse(date+'T00:00:00Z')+86400000-offset*1000;
  return {status:'ok',updatedAt:new Date(at).toISOString(),forecast72h:0,utcOffsetSeconds:offset,
    periodStart:new Date(start).toISOString(),periodEnd:new Date(start+72*3600000).toISOString(),
    dailyTime:Array.from({length:16},(_,i)=>new Date(Date.parse(date+'T00:00:00Z')+i*86400000).toISOString().slice(0,10)),
    dailySnowfall:Array(16).fill(0),remainingToday:{status:'ok',date,start:new Date(start).toISOString(),hourlySnowfallInches:Array((end-start)/3600000).fill(0)}};
}
test('the three-day half-life produces the agreed ranking, without a confidence percentage',()=>{
  assert.ok(Math.abs(weightedPowderScore(8,1)-63.496)<.001);
  assert.ok(Math.abs(weightedPowderScore(12,4)-47.622)<.001);
  assert.equal(weightedPowderScore(20,15),6.25);
  assert.equal(weightedPowderScore(6,1)/weightedPowderScore(6,4),2);
  assert.equal(weightedPowderScore(5.99,0),null);
  assert.equal(weightedPowderScore(8,-1),null);
  assert.equal(weightedPowderScore(8,1.5),null);
});
test('best opportunity and absolute peak are separate; multiple storms are not summed',()=>{
  const f=fixture();f.dailySnowfall[1]=8;f.dailySnowfall[4]=12;f.dailySnowfall[15]=20;
  const a=powderAlert(f,now);
  assert.equal(a.best.daysAway,1);assert.equal(a.best.snowInches,8);
  assert.equal(a.peak.daysAway,15);assert.equal(a.peak.snowInches,20);
  assert.equal(a.peak.outlook,true);
  assert.equal(a.score,weightedPowderScore(8,1));
});
test('today includes only remaining hourly snowfall, with the current interval prorated',()=>{
  const at=Date.parse('2026-11-09T12:30:00Z');const f=fixture(0,at);
  f.dailySnowfall[0]=100;
  f.remainingToday.hourlySnowfallInches[0]=8;
  f.remainingToday.hourlySnowfallInches[1]=4;
  assert.equal(remainingTodaySnow(f,at),8,'half the current 8-inch interval plus the next 4 inches');
  const a=powderAlert(f,at);assert.equal(a.best.isToday,true);assert.equal(a.best.snowInches,8);assert.equal(a.score,80);
  assert.equal(remainingTodaySnow(f,at+3600000),2,'completed intervals cannot remain incoming');
  assert.equal(powderAlert(f,at+3600000).score,null,'a huge already-fallen daily total cannot trigger an incoming alert');
});
test('remaining today respects resort-local midnight and does not turn unavailable amounts into zero',()=>{
  const at=Date.parse('2026-11-09T14:30:00Z');const f=fixture(9*3600,at);
  assert.equal(f.remainingToday.hourlySnowfallInches.length,1);
  f.remainingToday.hourlySnowfallInches[0]=12;
  assert.equal(remainingTodaySnow(f,at),6);
  f.remainingToday.hourlySnowfallInches[0]=null;
  assert.equal(remainingTodaySnow(f,at),null);
  f.dailySnowfall[1]=8;
  const a=powderAlert(f,at);assert.equal(a.best.daysAway,1);assert.equal(a.todayUnavailable,true);assert.equal(a.missingDays,1);
});
test('closed resorts remain ranked; stale, sub-threshold and missing forecasts are excluded',()=>{
  const make=(name,day,snow)=>{const f=fixture();f.dailySnowfall[day]=snow;return {name,metrics:{runsOpen:0},liveTerrainStatus:'unavailable',liveForecast:f};};
  const a=make('Near',1,8),b=make('Far',15,20),c=make('Small',1,5.99);
  const d=make('Stale',1,100);d.liveForecast.updatedAt='2020-01-01T00:00:00Z';
  assert.deepEqual(rankResorts([b,c,d,a],'powderAlert').map(r=>r.resort.name),['Near','Far']);
  const missing=fixture();missing.remainingToday=undefined;missing.dailySnowfall[3]=null;
  assert.equal(powderAlert(missing,now).score,null);
});
test('ties keep the earlier opportunity and a missing today summary does not block future storms',()=>{
  const f=fixture();f.remainingToday=undefined;f.dailySnowfall[1]=6;f.dailySnowfall[4]=12;
  assert.equal(powderAlert(f,now).best.daysAway,1);
});

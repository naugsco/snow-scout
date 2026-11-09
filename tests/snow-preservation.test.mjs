import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calculatePreservation, PRESERVATION_HOURS, preservationExplanation} from '../js/snow-preservation.js';
import {snowScore, metricValue} from '../js/heatmap-metrics.js';
const asOf=Date.parse('2026-11-09T20:00:00Z')/1000;
function fixture() {
  const time=Array.from({length:PRESERVATION_HOURS},(_,i)=>asOf-(PRESERVATION_HOURS-1-i)*3600);
  return {hourly_units:{snowfall:'cm',temperature_2m:'°F',rain:'mm',showers:'mm'},
    hourly:{time,snowfall:time.map(()=>0),temperature_2m:time.map(()=>20),rain:time.map(()=>0),showers:time.map(()=>0)}};
}
function credit(payload){return calculatePreservation(payload,asOf);}
test('cold preserves older snow better than equal-age warmth and rain; credit never grows or exceeds snowfall',()=>{
  const cold=fixture();cold.hourly.snowfall[100]=25.4;
  const warm=structuredClone(cold);warm.hourly.temperature_2m.fill(45,101);
  const wet=structuredClone(cold);wet.hourly.rain[101]=10;
  const c=credit(cold),w=credit(warm),r=credit(wet);
  assert.ok(c.creditInches>w.creditInches);
  assert.ok(c.creditInches>r.creditInches);
  assert.ok(c.creditInches>3,'snow older than a week can still contribute in cold weather');
  for(const result of [c,w,r])assert.ok(result.creditInches>=0&&result.creditInches<=result.snowfallInches);
  assert.equal(Date.parse(c.asOf)-Date.parse(c.windowStart),336*3600000);
});
test('the order of snowfall and adverse weather matters and new cold never restores lost credit',()=>{
  const after=fixture();after.hourly.snowfall[300]=25.4;after.hourly.rain[310]=10;
  const before=fixture();before.hourly.rain[299]=10;before.hourly.snowfall[300]=25.4;
  assert.ok(credit(before).creditInches>credit(after).creditInches);
  assert.equal(credit(after).possibleCrustInOlderLayers,true);
  const extra=structuredClone(after);
  for(let n=1;n<=24;n++){extra.hourly.time.push(asOf+n*3600);for(const key of ['snowfall','rain','showers'])extra.hourly[key].push(0);extra.hourly.temperature_2m.push(20);}
  assert.ok(calculatePreservation(extra,asOf+24*3600).creditInches<=credit(after).creditInches,'subsequent cold cannot restore damaged credit');
  assert.ok(credit(after).creditInches<credit(before).creditInches);
  const asAtRain=calculatePreservation(after,after.hourly.time[310]);
  assert.equal(asAtRain.status,'unavailable','shorter than 14 days cannot be silently treated as complete');
});
test('a dusting adds its own credit without resetting a damaged older layer',()=>{
  const damaged=fixture();damaged.hourly.snowfall[300]=25.4;damaged.hourly.rain[310]=10;
  const dust=structuredClone(damaged);dust.hourly.snowfall[335]=.254;
  assert.ok(Math.abs(credit(dust).creditInches-credit(damaged).creditInches-.1)<.00011);
  assert.equal(credit(dust).possibleCrustInOlderLayers,true);
});
test('complete dry history is a real zero, missing history and wrong units stay unavailable',()=>{
  const dry=credit(fixture());assert.equal(dry.creditInches,0);assert.equal(dry.lastSnowAt,null);
  for(const mutate of [p=>p.hourly.rain[5]=null,p=>p.hourly.temperature_2m[5]=undefined,
    p=>p.hourly.snowfall[5]=-1,p=>p.hourly_units.rain='inch',p=>p.hourly.time.splice(5,1),
    p=>p.hourly.time[5]=p.hourly.time[4]]){
    const p=fixture();mutate(p);assert.equal(credit(p).status,'unavailable');
  }
  assert.equal(snowScore({forecast72h:10},dry),11);
  assert.equal(snowScore({forecast72h:10},undefined),null);
  assert.equal(snowScore({forecast72h:-1},dry),null);
});
test('Snow potential uses forecast plus preservation credit and rejects a stale history in a fresh forecast',()=>{
  const p=fixture();p.hourly.snowfall[335]=10.16;
  const s=credit(p);
  assert.equal(snowScore({forecast72h:10,daysSinceSnow:99},s),16.4);
  const now=Date.now();const stamp=new Date(now).toISOString();const date=stamp.slice(0,10);
  const r={metrics:{forecast72h:10},liveForecast:{status:'ok',updatedAt:stamp,forecast72h:10,utcOffsetSeconds:0,
    dailyTime:[date,date,date],dailySnowfall:[1,1,1],periodEnd:new Date(now+72*3600000).toISOString(),snowPreservation:{...s,asOf:'2020-01-01T00:00:00Z'}}};
  assert.equal(metricValue(r,'score'),null);
  r.liveForecast.snowPreservation.asOf=stamp;
  assert.equal(metricValue(r,'score'),16.4);
  assert.match(preservationExplanation({...r.liveForecast,snowPreservation:{...s,asOf:stamp}},true,now),/cm snow-equivalent credit/);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {qualityAssessment, weatherFactors, qualityExplanation} from '../js/snow-quality.js';
import {metricValue, rankResorts} from '../js/heatmap-metrics.js';
const now = Date.now();
const stamp = new Date(now).toISOString();
const date = stamp.slice(0,10);
const weather = {status:'ok',rainMm:0,minTempF:20,maxTempF:28,windMph:10,gustMph:15};
function resort() {
  return {name:'Open',liveTerrainStatus:'ready',liveCheckedAt:stamp,liveTerrainReportedAt:stamp,
    liveSnowStatus:'ready',liveSnowReportedAt:stamp,liveConditionsKind:'model',
    metrics:{runsOpen:5,snow24h:4,snow48h:8,snow72h:12,forecast72h:10,daysSinceSnow:0},
    liveForecast:{snowPreservation:{version:1,status:'ok',hours:336,snowfallInches:4,creditInches:4,asOf:stamp},status:'ok',updatedAt:stamp,utcOffsetSeconds:0,dailyTime:[date,date,date],dailySnowfall:[1,2,3],forecast72h:10,
      periodEnd:new Date(now+72*3600000).toISOString(),skiQuality:{version:1,today:{...weather},upcoming:{...weather}}}};
}
test('today counts aging recent snow but never future snow; upcoming counts future snow independently',()=>{
  const r=resort();
  assert.equal(qualityAssessment(r,'bestToday',now).value,70);
  assert.equal(qualityAssessment(r,'bestUpcoming',now).value,100);
  r.liveForecast.forecast72h=100;
  assert.equal(qualityAssessment(r,'bestToday',now).value,70);
  r.metrics.snow24h=0;r.metrics.snow48h=0;r.metrics.snow72h=0;
  assert.equal(qualityAssessment(r,'bestToday',now).value,0);
  assert.equal(qualityAssessment(r,'bestUpcoming',now).value,1000);
});
test('rain, warmth, wind, gusts and temperature crossing freezing each reduce an otherwise equal score',()=>{
  for (const change of [{rainMm:5},{maxTempF:40},{windMph:40},{gustMph:65},{minTempF:30,maxTempF:33}]) {
    const r=resort();Object.assign(r.liveForecast.skiQuality.upcoming,change);
    assert.ok(qualityAssessment(r,'bestUpcoming',now).value < 100,JSON.stringify(change));
  }
  const factors=weatherFactors({...weather,maxTempF:100,rainMm:100,windMph:100,gustMph:150});
  assert.equal(factors.warmth,.2);assert.equal(factors.wind,.25);
  assert.equal(weatherFactors({...weather,rainMm:null}),null);
});
test('closed, unverified, stale and lift-only resorts are excluded from best today but included in best upcoming and snow potential',()=>{
  for (const patch of [{liveTerrainStatus:'unavailable'},{liveTerrainReportedAt:'2020-01-01T00:00:00Z'},
      {liveCheckedAt:'2020-01-01T00:00:00Z'},{metrics:{...resort().metrics,runsOpen:0}},
      {metrics:{...resort().metrics,runsOpen:null,liftsOpen:2}}]) {
    const r={...resort(),...patch};
    assert.equal(qualityAssessment(r,'bestToday',now).value,null);
    assert.equal(rankResorts([r],'bestToday').length,0);
    assert.equal(rankResorts([r],'bestUpcoming').length,1);
    const upcoming = qualityAssessment(r,'bestUpcoming',now);
    assert.equal(upcoming.value,100);
    assert.match(qualityExplanation(upcoming), /Opening not checked/);
    assert.ok(Number.isFinite(metricValue(r,'score')));
  }
});
test('missing, negative, old or inconsistent inputs never become favorable quality points',()=>{
  for (const modify of [r=>{r.liveForecast.skiQuality=undefined},r=>{r.liveForecast.skiQuality.today.rainMm=null},
    r=>{r.liveForecast.skiQuality.today.windMph=-1},r=>{r.liveForecast.updatedAt='2020-01-01T00:00:00Z'},
    r=>{r.metrics.snow24h=null},r=>{r.metrics.snow48h=1},r=>{r.liveSnowReportedAt='2020-01-01T00:00:00Z'}]) {
    const r=resort();modify(r);assert.equal(qualityAssessment(r,'bestToday',now).value,null);
  }
  const r=resort();r.liveForecast.skiQuality.today.rainMm=null;
  assert.equal(qualityAssessment(r,'bestUpcoming',now).value,100,'a missing past reading cannot invalidate the independent upcoming window');
});

test('explanations follow display units without changing the score and invalid metric IDs raise errors',()=>{
  const r=resort();const result=qualityAssessment(r,'bestUpcoming',now);
  assert.match(qualityExplanation(result), /10.0″ snow basis/);
  assert.match(qualityExplanation(result,true), /25.4 cm snow basis/);
  assert.match(qualityExplanation(result,true), /km\/h/);
  assert.match(qualityExplanation(result,true), /°C/);
  assert.match(qualityExplanation(result,true), /^100 points/);
  assert.throws(()=>qualityAssessment(r,'invented',now), /Unknown/);
});

test('upcoming still excludes missing and stale forecast inputs regardless of operating status',()=>{
  for (const modify of [r=>{r.liveForecast.skiQuality.upcoming.rainMm=null},
    r=>{r.liveForecast.updatedAt='2020-01-01T00:00:00Z'}]) {
    const r=resort();r.metrics.runsOpen=0;r.liveTerrainStatus='unavailable';modify(r);
    assert.equal(qualityAssessment(r,'bestUpcoming',now).value,null);
    assert.equal(rankResorts([r],'bestUpcoming').length,0);
  }
});

test('forecast previews show weather tradeoffs without exposing the internal upcoming score or inventing timing', async()=>{
  const {forecastTradeoffs}=await import('../js/snow-quality.js');
  const r=resort();Object.assign(r.liveForecast.skiQuality.upcoming,{rainMm:5,maxTempF:40,gustMph:60});
  const text=forecastTradeoffs(r,false,now);
  assert.match(text,/Next 72h: 10.0″ snowfall/);
  assert.match(text,/Rain possible: 5.0 mm/);
  assert.match(text,/Above freezing/);
  assert.match(text,/Strong winds possible/);
  assert.match(text,/Freeze–thaw possible/);
  assert.doesNotMatch(text,/points|Sunday|early|Best upcoming/);
  assert.match(forecastTradeoffs(r,true,now),/25.4 cm/);
  assert.match(forecastTradeoffs(r,true,now),/km\/h/);
  r.liveForecast.skiQuality.upcoming.rainMm=null;
  assert.match(forecastTradeoffs(r,false,now),/unavailable/);
  r.liveForecast.updatedAt='2020-01-01T00:00:00Z';
  assert.match(forecastTradeoffs(r,false,now),/current forecast is needed/);
});

test('the public filters keep Biggest forecast while retaining upcoming scoring internally', async()=>{
  const {HEATMAP_METRICS}=await import('../js/heatmap-metrics.js');
  assert.ok(HEATMAP_METRICS.some(m=>m.id==='forecast72h'));
  assert.ok(!HEATMAP_METRICS.some(m=>m.id==='bestUpcoming'));
  assert.equal(qualityAssessment(resort(),'bestUpcoming',now).value,100);
});

test('old upcoming links select Biggest forecast while preserving other filters', async()=>{
  const old=globalThis.location;
  globalThis.location={hash:'#sort=bestUpcoming&region=north-america%3AColorado&pass=ikon'};
  try {
    const {parseHash}=await import('../js/router.js');
    assert.deepEqual(parseHash([]),{sortMode:'forecast72h',regionFilter:'north-america:Colorado',passFilter:'ikon'});
  } finally {globalThis.location=old;}
});

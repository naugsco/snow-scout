import assert from 'node:assert/strict';
import {test} from 'node:test';
import {potentialPowderDays,POWDER_DAY_THRESHOLD_INCHES} from '../js/forecast-planning.js';
const now=Date.now();
const date=new Date(now).toISOString().slice(0,10);
function forecast(){return {status:'ok',updatedAt:new Date(now).toISOString(),utcOffsetSeconds:0,forecast72h:0,
  periodEnd:new Date(now+72*3600000).toISOString(),dailyTime:Array.from({length:16},(_,i)=>new Date(Date.parse(date+'T00:00:00Z')+i*86400000).toISOString().slice(0,10)),
  dailySnowfall:Array(16).fill(0)};}
test('powder candidates use the exact six-inch daily threshold and distinguish today from the longer range',()=>{
  const f=forecast();f.dailySnowfall[0]=6;f.dailySnowfall[1]=5.99;f.dailySnowfall[7]=8;f.dailySnowfall[15]=12;
  const result=potentialPowderDays(f,now);
  assert.equal(POWDER_DAY_THRESHOLD_INCHES*2.54,15.24);
  assert.deepEqual(result.days.map(d=>d.index),[0,7,15]);
  assert.equal(result.days[0].isToday,true);
  assert.equal(result.days[0].outlook,false);
  assert.equal(result.days[1].outlook,true);
  assert.equal(result.days[2].date,f.dailyTime[15]);
});
test('missing daily amounts are unassessed; adjacent sub-threshold days are not invented as a powder day',()=>{
  const f=forecast();f.dailySnowfall[1]=5;f.dailySnowfall[2]=5;f.dailySnowfall[3]=null;
  const result=potentialPowderDays(f,now);
  assert.equal(result.days.length,0);
  assert.equal(result.availableDays,15);
  assert.equal(result.missingDays,1);
});
test('stale forecasts and broken dates cannot produce powder candidates',()=>{
  const f=forecast();f.updatedAt='2020-01-01T00:00:00Z';
  assert.equal(potentialPowderDays(f,now).status,'unavailable');
  const g=forecast();g.dailyTime[9]=g.dailyTime[8];
  assert.equal(potentialPowderDays(g,now).status,'unavailable');
});

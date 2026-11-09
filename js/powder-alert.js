import { potentialPowderDays, POWDER_DAY_THRESHOLD_INCHES } from './forecast-planning.js?v=20261109-16day';

export const POWDER_HALF_LIFE_DAYS = 3;
const HOUR_MS = 3600000;

export function weightedPowderScore(snowInches, daysAway) {
  if (!Number.isFinite(snowInches) || snowInches < POWDER_DAY_THRESHOLD_INCHES
      || !Number.isInteger(daysAway) || daysAway < 0 || daysAway > 15) return null;
  return snowInches * 10 * Math.pow(.5,daysAway/POWDER_HALF_LIFE_DAYS);
}

export function remainingTodaySnow(forecast, now = Date.now()) {
  const today=forecast?.remainingToday;
  if (today?.status !== 'ok' || today.date !== forecast.dailyTime?.[0]
      || today.start !== forecast.periodStart || !Array.isArray(today.hourlySnowfallInches)) return null;
  const start=Date.parse(today.start);
  const end=Date.parse(`${today.date}T00:00:00Z`)+86400000-forecast.utcOffsetSeconds*1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now >= end
      || today.hourlySnowfallInches.length !== (end-start)/HOUR_MS) return null;
  let total=0;
  for(let i=0;i<today.hourlySnowfallInches.length;i++) {
    const intervalEnd=start+(i+1)*HOUR_MS;
    if(intervalEnd<=now)continue;
    const amount=today.hourlySnowfallInches[i];
    if(!Number.isFinite(amount)||amount<0)return null;
    // Model amounts span the preceding hour; approximate its remaining fraction uniformly.
    total+=amount*Math.min(1,(intervalEnd-now)/HOUR_MS);
  }
  return total;
}

export function powderAlert(forecast, now = Date.now()) {
  const source=potentialPowderDays(forecast,now);
  if(source.status!=='ok')return {status:'unavailable',score:null,reason:source.reason};
  const today=remainingTodaySnow(forecast,now);
  const candidates=[];
  let missingDays=0, peak=null, best=null;
  for(let index=0;index<source.totalDays;index++) {
    const snowInches=index===0?today:forecast.dailySnowfall[index];
    if(!Number.isFinite(snowInches)||snowInches<0){missingDays++;continue;}
    const day={date:forecast.dailyTime[index],daysAway:index,snowInches,outlook:index>=7,isToday:index===0};
    if(!peak||snowInches>peak.snowInches)peak=day;
    const score=weightedPowderScore(snowInches,index);
    if(score===null)continue;
    const opportunity={...day,score};
    candidates.push(opportunity);
    if(!best||score>best.score)best=opportunity;
  }
  return {status:best?'ok':'none',score:best?.score ?? null,best,peak,candidates,missingDays,
    todayUnavailable:today===null,reason:best?'Experimental priority score · Opening not checked':'No incoming day reaches the six-inch threshold'};
}

import { forecastIsCurrent } from './weather-data.js?v=20261109-powder-alert';

export const POWDER_DAY_THRESHOLD_INCHES = 6; // 15.24 cm; display rounds to 15 cm.

export function potentialPowderDays(forecast, now = Date.now()) {
  if (!forecastIsCurrent(forecast, now)) return {status:'unavailable',reason:'A current forecast is needed.'};
  const dates=forecast.dailyTime?.slice(0,16);
  if (!dates?.length || dates.some((date,i)=> !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || new Date(Date.parse(`${dates[0]}T00:00:00Z`)+i*86400000).toISOString().slice(0,10)!==date)) {
    return {status:'unavailable',reason:'Consecutive resort-local forecast dates are needed.'};
  }
  const days=[];
  let availableDays=0;
  dates.forEach((date,index)=>{
    const snow=forecast.dailySnowfall?.[index];
    if (!Number.isFinite(snow)||snow<0)return;
    availableDays++;
    if (snow>=POWDER_DAY_THRESHOLD_INCHES) days.push({date,snowInches:snow,index,isToday:index===0,outlook:index>=7});
  });
  return {status:'ok',days,availableDays,totalDays:dates.length,missingDays:dates.length-availableDays};
}

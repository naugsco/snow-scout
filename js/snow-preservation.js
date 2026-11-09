import { isFresh } from './condition-data.js?v=20261021-sources-verified';

export const PRESERVATION_HOURS = 14 * 24;
const HOUR = 3600;
const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const rounded = value => Math.round(value * 10000) / 10000;

// A chronological credit model, not a snow-depth or melt model. Coefficients are provisional.
export function calculatePreservation(payload, asOf) {
  const unavailable = reason => ({version:1,status:'unavailable',reason});
  const units = payload?.hourly_units;
  if (units?.snowfall !== 'cm' || units.temperature_2m !== '°F' || units.rain !== 'mm' || units.showers !== 'mm') {
    return unavailable('Snow-preservation history has missing or unexpected units');
  }
  const hourly = payload.hourly;
  const times = hourly?.time;
  if (!Array.isArray(times) || !times.every(Number.isFinite) || new Set(times).size !== times.length || !Number.isFinite(asOf)) {
    return unavailable('Snow-preservation history has invalid timestamps');
  }
  const index = new Map(times.map((time,i)=>[time,i]));
  const layers = [];
  let total = 0, rainMm = 0, warmHours = 0, aboveFreezingDegreeHoursC = 0, lastSnowAt = null;
  const start = asOf - (PRESERVATION_HOURS - 1) * HOUR;
  for (let time = start; time <= asOf; time += HOUR) {
    const i = index.get(time);
    const snow = hourly.snowfall?.[i], temp = hourly.temperature_2m?.[i];
    const rain = hourly.rain?.[i], showers = hourly.showers?.[i];
    if (![snow,rain,showers].every(valid) || typeof temp !== 'number' || !Number.isFinite(temp)) {
      return unavailable('A complete 14-day hourly snowfall, temperature and rain history is required');
    }
    const liquid = rain + showers;
    const warmthC = Math.max(0,(temp - 32)*5/9);
    // Affect existing layers first, preserving the order of damage and later new snow.
    for (const layer of layers) {
      layer.credit *= Math.pow(.5,1/(7*24) + warmthC/48 + liquid/5);
      if (warmthC > 0 || liquid > 0) layer.wet = true;
      if (temp <= 32 && layer.wet) {
        layer.credit *= .5;
        layer.crust = true;
        layer.wet = false;
      }
    }
    if (layers.length) {
      rainMm += liquid;
      if (warmthC > 0) warmHours++;
      aboveFreezingDegreeHoursC += warmthC;
    }
    if (snow > 0) {
      const amount = snow / 2.54;
      // Within-hour precipitation order is unknown: new snow receives that hour's weather deduction too.
      const crust = temp <= 32 && liquid > 0;
      layers.push({credit:amount * Math.pow(.5,warmthC/48 + liquid/5) * (crust ? .5 : 1),
        wet:temp > 32,crust});
      if (layers.length === 1) {
        rainMm += liquid;
        if (warmthC > 0) warmHours++;
        aboveFreezingDegreeHoursC += warmthC;
      }
      total += amount;
      lastSnowAt = new Date(time*1000).toISOString();
    }
  }
  return {version:1,status:'ok',hours:PRESERVATION_HOURS,
    windowStart:new Date((start-HOUR)*1000).toISOString(),asOf:new Date(asOf*1000).toISOString(),
    snowfallInches:rounded(total),creditInches:rounded(layers.reduce((sum,layer)=>sum+layer.credit,0)),
    lastSnowAt,rainSinceFirstSnowMm:rounded(rainMm),warmHoursSinceFirstSnow:warmHours,
    aboveFreezingDegreeHoursC:rounded(aboveFreezingDegreeHoursC),possibleCrustInOlderLayers:layers.some(layer=>layer.crust)};
}

export function preservationCredit(summary) {
  if (summary?.version !== 1 || summary.status !== 'ok' || summary.hours !== PRESERVATION_HOURS
      || !valid(summary.creditInches) || !valid(summary.snowfallInches)
      || summary.creditInches > summary.snowfallInches) return null;
  return summary.creditInches;
}

export function preservationExplanation(forecast, useMetric = false, now = Date.now()) {
  const s = forecast?.snowPreservation;
  if (!isFresh(forecast?.updatedAt,undefined,now)) {
    return 'Snow preservation unavailable: current hourly history is needed.';
  }
  if (preservationCredit(s) === null) return `Snow preservation unavailable: ${s?.reason || 'complete 14-day history is needed'}.`;
  if (!isFresh(s.asOf,undefined,now)) return 'Snow preservation unavailable: hourly history is stale.';
  const amount = value => useMetric ? `${(value*2.54).toFixed(1)} cm` : `${value.toFixed(1)}″`;
  if (!s.lastSnowAt) return 'No modeled snowfall in the past 14 days · No recent-snow credit. Older snow and base coverage are not assessed.';
  const age = Math.max(0,(Number(now)-Date.parse(s.lastSnowAt))/3600000);
  const ageText = age < 24 ? `${Math.floor(age)}h ago` : `${Math.floor(age/24)}d ago`;
  return `Experimental snow preservation · Latest modeled snowfall ${ageText} · ${amount(s.creditInches)} snow-equivalent credit from ${amount(s.snowfallInches)} modeled snowfall over 14 days · ${s.warmHoursSinceFirstSnow ? `${s.warmHoursSinceFirstSnow}h above freezing` : 'Stayed at or below freezing'} · ${s.rainSinceFirstSnowMm ? `${s.rainSinceFirstSnowMm.toFixed(1)} mm rain/showers` : 'No rain modeled'} since the first snowfall in this window${s.possibleCrustInOlderLayers ? ' · Possible crust in older layers' : ''}. Credit is not measured remaining depth or untouched powder; sun, wind, grooming and skier traffic are not modeled.`;
}

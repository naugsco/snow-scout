import { validDate, addDays, localDate } from './travel.js?v=20261106-all-travel-guides';
import { TRAVEL_GUIDES } from './travel-guides.js?v=20261106-all-travel-guides';
export const GATEWAYS = Object.fromEntries(Object.entries(TRAVEL_GUIDES).map(([name, guide]) => [name, {code:guide.airport, verified:guide.airportVerified !== false, url:guide.accessUrl, note:guide.note}]));
export function validatePlan(p) {
  if (!/^[A-Z]{3}$/.test(p.origin || '')) throw new Error('Enter your departure airport code.');
  if (!validDate(p.departure) || !validDate(p.returnDate)) throw new Error('Choose your departure and return flight dates.');
  if (p.departure < localDate() || p.returnDate <= p.departure) throw new Error('Return flight must depart after your flight from home.');
  if (p.customSkiDates) {
    if (!validDate(p.skiStart) || !validDate(p.skiEnd)) throw new Error('Choose both your first and last ski days, or turn off custom ski days.');
    if (p.skiStart < p.departure || p.skiEnd < p.skiStart || p.skiEnd > p.returnDate) throw new Error('Ski days must be in order and within your travel dates.');
  }
  if (p.returnDate > addDays(localDate(),330)) throw new Error('Choose travel within 330 days.');
  if (!Number.isInteger(p.adults) || p.adults < 1 || p.adults > 6) throw new Error('Choose 1–6 adults.');
  if (!['CAD','USD','EUR','GBP','JPY','AUD','NZD','CHF'].includes(p.currency)) throw new Error('Choose a supported currency.');
  if (p.budget !== '' && (!Number.isFinite(Number(p.budget)) || Number(p.budget) <= 0)) throw new Error('Budget must be positive or blank.');
  return p;
}
export function snowForSkiDates(resort, start, end, now = Date.now()) {
  const f = resort.liveForecast;
  if (!f || resort.liveForecastStatus !== 'ready' || !Number.isFinite(Date.parse(f.updatedAt)) || now-Date.parse(f.updatedAt)>6*3600000 || Date.parse(f.updatedAt)>now+300000) return null;
  let total=0, days=0;
  for(let date=start; date<=end; date=addDays(date,1)) {
    if (++days>31) return null;
    const i=f.dailyTime?.indexOf(date), n=f.dailySnowfall?.[i];
    if (i == null || i<0 || !Number.isFinite(n) || n<0) return null;
    total+=n;
  }
  return days ? total : null;
}

export function dailyTripForecast(resort, departure, returnDate, now = Date.now()) {
  return (resort.liveForecast?.dailyTime || []).filter(date => validDate(date) && date >= departure && date <= returnDate)
    .map(date => ({ date, snow: snowForSkiDates(resort, date, date, now) })).filter(day => day.snow !== null);
}

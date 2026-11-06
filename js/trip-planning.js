import { validDate, addDays, localDate } from './travel.js?v=20261106-trips';
export const GATEWAYS = {
  'Whistler Blackcomb': { code:'YVR', url:'https://www.yvr.ca/en/passengers/transportation/public-transportation/long-distance-scheduled-buses/whistler', note:'YVR lists a direct Whistler bus service. Check the operator’s current timetable and ski-bag allowance.' },
  'Heavenly': { code:'RNO', url:'https://www.skiheavenly.com/Explore%20the%20Resort/About%20the%20Resort/Getting%20Here%20and%20Parking.aspx', note:'Heavenly publishes access guidance from Reno–Tahoe. Confirm your transfer and winter road conditions.' },
  'Niseko United': { code:'CTS', url:'https://www.niseko.ne.jp/en/getting-to-niseko3/', note:'Niseko United publishes access from New Chitose. Check seasonal bus dates, reservations and final departure.' },
  'Chamonix (Mont Blanc)': { code:'GVA', url:'https://en.chamonix.com/usual-information-services/transports', note:'Chamonix tourism identifies Geneva as an access airport. This route crosses an international border.' }
};
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

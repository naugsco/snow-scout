import { EXTENDED_TRAVEL_GUIDES } from './travel-guide-catalog.js?v=20261106-all-travel-guides';
import { validDate, localDate } from './travel.js?v=20261106-all-travel-guides';

// Manually reviewed route/area guidance, not a live availability feed.
// Recheck sources before extending review dates. No fares or hotel inventory here.
const PILOT_GUIDES = {
  'Whistler Blackcomb': {
    reviewedAt: '2026-11-06', airport: 'YVR',
    bookingDestination: { id:'900000001', type:'city', name:'Whistler', sourceUrl:'https://www.booking.com/city/ca/whistler.html' },
    accessUrl: 'https://www.yvr.ca/en/passengers/transportation/public-transportation/long-distance-scheduled-buses/whistler',
    note: 'Direct coaches connect Vancouver airport with Whistler. Match your accommodation to the booked drop-off.',
    transfers: [
      { name: 'YVR Skylynx', kind: 'Scheduled coach', url: 'https://yvrskylynx.com/timetable/', sourceUrl: 'https://www.whistler.com/getting-here/road/shuttle/', duration: 'About 2.5–3 hours from YVR', season: 'Winter timetable: Nov 22, 2026 – Apr 19, 2027.', pickup: 'YVR; follow the meeting instructions in your booking.', dropoff: 'Whistler Village or Creekside; check the stop offered by your service.', baggage: 'Check current ski-bag and extra-luggage allowances before booking.', timing: 'Express and standard services have different stops. Leave time for immigration and baggage.' },
      { name: 'Whistler Shuttle', kind: 'Shared hotel transfer', url: 'https://www.whistlershuttle.com/', sourceUrl: 'https://www.whistler.com/getting-here/road/shuttle/', duration: 'About 2.5–3 hours from YVR', season: 'Schedules vary by season; check your flight date.', pickup: 'Vancouver airport meet-and-greet; confirm your flight details.', dropoff: 'Participating Whistler hotels; confirm your exact property.', baggage: 'Confirm ski-bag space when reserving.', timing: 'Flight-arrival pickup windows change by season. Confirm late-flight arrangements.' }
    ],
    stayUrl: 'https://www.whistlerblackcomb.com/travel-guide/where-to-stay-in-whistler.aspx',
    areas: [
      { id: 'village', name: 'Whistler Village', query: 'Whistler Village, Whistler, Canada', access: 'Village gondolas, restaurants and shops around the main base.', transfer: 'Check the walk from the Village coach stop to your hotel.' },
      { id: 'upper-village', name: 'Upper Village', query: 'Upper Village, Whistler, Canada', access: 'Stay near the Blackcomb base; verify each property’s lift access.', transfer: 'Check hotel drop-off or the local connection from the Village.' },
      { id: 'creekside', name: 'Creekside', query: 'Whistler Creekside, Whistler, Canada', access: 'A separate base with its own gondola and village services.', transfer: 'Choose a service that actually stops in Creekside.' }
    ]
  },
  'Heavenly': {
    reviewedAt: '2026-11-06', airport: 'RNO',
    bookingDestination: { id:'20016087', type:'city', name:'South Lake Tahoe', sourceUrl:'https://www.booking.com/city/us/south-lake-tahoe.html' },
    accessUrl: 'https://www.skiheavenly.com/explore-the-resort/about-the-resort/getting-here-and-parking',
    note: 'Reno–Tahoe is an access airport. The airport coach serves South Shore stops, not every lodge or lift.',
    transfers: [
      { name: 'South Tahoe Airporter', kind: 'Scheduled coach', url: 'https://southtahoeairporter.com/', sourceUrl: 'https://southtahoeairporter.com/faqs/', duration: null, season: 'Choose your date in the operator’s booking timetable; seasonal hours are not verified here.', pickup: 'RNO: outside Door D in the shuttle loading zone.', dropoff: 'Selected South Lake Tahoe / Stateline stops; arrange the last leg to your lodging.', baggage: 'The operator confirms skis fit on the bus; check extra baggage with them.', timing: 'Reserve to guarantee a seat. The FAQ and ticket page list some different hotel names: use your booking confirmation for the actual stop.' }
    ],
    stayUrl: 'https://www.skiheavenly.com/Plan-Your-Trip/stay/Lodging%20Results.aspx',
    areas: [
      { id: 'village', name: 'Heavenly Village / Stateline', query: 'Heavenly Village, South Lake Tahoe, United States', access: 'Look near the Heavenly Gondola base and village services.', transfer: 'Compare your coach stop with the property address; not all hotels get a direct drop-off.' },
      { id: 'stagecoach', name: 'Stagecoach / Kingsbury', query: 'Stagecoach Lodge, Kingsbury, Nevada, United States', access: 'Nevada-side lodging near Stagecoach. Verify the specific property’s lift connection.', transfer: 'Plan an onward ride from the airport coach’s Stateline stops.' }
    ]
  },
  'Niseko United': {
    reviewedAt: '2026-11-06', airport: 'CTS',
    bookingDestination: { id:'4742', type:'region', name:'Niseko Ski', sourceUrl:'https://www.booking.com/region/jp/niseko.html' },
    accessUrl: 'https://www.niseko.ne.jp/en/getting-to-niseko3/',
    note: 'New Chitose airport coaches serve several separate Niseko bases. Choose your lodging area before booking the bus.',
    transfers: [
      { name: 'Hokkaido Resort Liner via Niseko Ground Services', kind: 'Winter coach', url: 'https://nisekogroundservice.jp/scheduled-transfers/', sourceUrl: 'https://nisekogroundservice.jp/scheduled-transfers/', duration: 'About 2h 45m to Hirafu Welcome Center, per published timetable', season: 'Airport → Niseko: Dec 1, 2026 – Mar 30, 2027. Return: Dec 2, 2026 – Mar 31, 2027. Some services run fewer dates.', outboundSeason: ['2026-12-01', '2027-03-30'], returnSeason: ['2026-12-02', '2027-03-31'], pickup: 'CTS domestic or international terminal; not every bus serves both.', dropoff: 'Hirafu Welcome Center and selected hotels in Niseko Village, Annupuri and Hanazono; stops vary.', baggage: 'Confirm ski equipment, baggage limits and any hotel pickup with the operator.', timing: 'Book the correct terminal and allow immigration/baggage time. A Welcome Center stop may require a hotel shuttle or taxi.' }
    ],
    stayUrl: 'https://www.niseko.ne.jp/en/niseko-accommodation/',
    areas: [
      { id: 'hirafu', name: 'Grand Hirafu', query: 'Grand Hirafu, Kutchan, Hokkaido, Japan', access: 'Choose a property for the Grand Hirafu base; verify the walk or hotel shuttle to the lifts.', transfer: 'Hirafu Welcome Center is a bus stop, not a hotel doorstep.' },
      { id: 'village', name: 'Niseko Village', query: 'Niseko Village, Niseko, Hokkaido, Japan', access: 'Accommodation around the Niseko Village ski area.', transfer: 'Select the specific hotel stop offered by your coach.' },
      { id: 'annupuri', name: 'Annupuri', query: 'Niseko Annupuri, Niseko, Hokkaido, Japan', access: 'Lodging around the Annupuri base; confirm property-to-lift access.', transfer: 'Check your coach’s Annupuri hotel stops and onward travel.' },
      { id: 'hanazono', name: 'Hanazono', query: 'Niseko Hanazono, Kutchan, Hokkaido, Japan', access: 'A separate base on the Hanazono side of the mountain.', transfer: 'Only some published coach services stop at Hanazono hotels.' }
    ]
  },
  'Chamonix (Mont Blanc)': {
    reviewedAt: '2026-11-06', airport: 'GVA',
    bookingDestination: { id:'-1418045', type:'city', name:'Chamonix', sourceUrl:'https://www.booking.com/city/fr/chamonix-mont-blanc.html' },
    accessUrl: 'https://en.chamonix.com/usual-information-services/transports',
    note: 'Geneva airport transfers cross from Switzerland into France. Choose a town stop or a service to your accommodation.',
    transfers: [
      { name: 'Alpy Transfers', kind: 'Shared or private transfer', url: 'https://www.alpytransfers.com/chamonix', sourceUrl: 'https://www.alpytransfers.com/chamonix', duration: 'About 1h 30m, operator estimate', season: '2026/27 winter timetable published; confirm service for your date.', pickup: 'Geneva airport; use the meeting point in your reservation.', dropoff: 'Express stops or accommodation drop-off, depending on the booked service.', baggage: 'Confirm ski-bag space and luggage limits when reserving.', timing: 'Shared transfers may use a coach plus a feeder minivan. Allow for border, traffic and winter delays.' }
    ],
    stayUrl: 'https://booking.chamonix.com/en/',
    areas: [
      { id: 'chamonix', name: 'Chamonix town', query: 'Chamonix-Mont-Blanc, France', access: 'A town base for the valley. Check transport to the ski area you intend to use.', transfer: 'Match an express stop or door-to-door transfer to your address.' },
      { id: 'argentiere', name: 'Argentière', query: 'Argentiere, Chamonix-Mont-Blanc, France', access: 'Compare properties in Argentière and their access to your chosen lifts.', transfer: 'Confirm your transfer includes Argentière rather than just central Chamonix.' },
      { id: 'les-houches', name: 'Les Houches', query: 'Les Houches, France', access: 'A separate valley base. Confirm the local lift and bus connections.', transfer: 'Choose Les Houches explicitly when booking the transfer.' }
    ]
  }
};

export const TRAVEL_GUIDES = { ...EXTENDED_TRAVEL_GUIDES, ...PILOT_GUIDES };

export function guideIsCurrent(guide, today = localDate()) {
  if (!validDate(guide?.reviewedAt) || !validDate(today)) return false;
  const age = Date.parse(`${today}T12:00:00Z`) - Date.parse(`${guide.reviewedAt}T12:00:00Z`);
  return age >= 0 && age <= 90 * 86400000;
}

export function transferSeasonWarning(transfer, trip) {
  // Home departure is not the local airport arrival. Flag dates to check,
  // not bookable connections; an airport overnight can change transfer dates.
  if (!validDate(trip?.departure) || !validDate(trip?.returnDate)) return '';
  if (transfer.outboundSeason && (trip.returnDate < transfer.outboundSeason[0] || trip.departure > transfer.outboundSeason[1])) return 'Your travel window is outside the published airport-to-resort season. Confirm local arrival dates and alternative transfers with the operator.';
  if (transfer.returnSeason && (trip.returnDate < transfer.returnSeason[0] || trip.returnDate > transfer.returnSeason[1])) return 'Your return flight date is outside the published resort-to-airport season. Check whether a previous-day transfer or another operator is needed.';
  return '';
}

export function stayDates(trip, stay = {}, today = localDate()) {
  const checkin = stay.customDates ? stay.checkin : trip.departure;
  const checkout = stay.customDates ? stay.checkout : trip.returnDate;
  if (!validDate(checkin) || !validDate(checkout) || checkin < today || checkout <= checkin) throw new Error('Choose a future check-in and a later check-out, or update your travel dates.');
  if (!Number.isInteger(trip.adults) || trip.adults < 1 || trip.adults > 6) throw new Error('Choose 1–6 adults before searching stays.');
  return { checkin, checkout, adults: trip.adults };
}

export function staySearchUrl(destination, dates) {
  // Ordinary consumer link. No affiliate ID until a real approved link exists.
  if (!destination || !['city', 'region', 'district'].includes(destination.type) || !/^-?\d+$/.test(destination.id)) throw new Error('A verified lodging destination is required.');
  // IDs were read from the destination pages linked above; free-text area names
  // can resolve to a similarly named property and must not drive this search.
  const params = new URLSearchParams({ dest_id: destination.id, dest_type: destination.type, checkin: dates.checkin, checkout: dates.checkout, group_adults: String(dates.adults), no_rooms: '1', group_children: '0' });
  return `https://www.booking.com/searchresults.html?${params}`;
}

export function areaMapUrl(query) {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: `accommodation near ${query}` })}`;
}

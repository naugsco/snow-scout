// Catalog membership by state/province. Heavenly spans California and Nevada.
const groups = {
  "Colorado": [
    "Vail",
    "Beaver Creek",
    "Breckenridge",
    "Keystone",
    "Crested Butte",
    "Telluride",
    "Aspen Snowmass",
    "Steamboat",
    "Winter Park",
    "Copper Mountain",
    "Eldora",
    "Arapahoe Basin"
  ],
  "Utah": [
    "Park City",
    "Alta",
    "Snowbird",
    "Deer Valley",
    "Brighton Resort",
    "Solitude",
    "Snowbasin"
  ],
  "California": [
    "Kirkwood",
    "Heavenly",
    "Northstar",
    "Mammoth Mountain",
    "June Mountain",
    "Big Bear Mountain",
    "Palisades Tahoe",
    "Sugar Bowl"
  ],
  "Vermont": [
    "Stowe",
    "Okemo",
    "Mount Snow",
    "Killington",
    "Sugarbush",
    "Stratton"
  ],
  "New Hampshire": [
    "Mount Sunapee",
    "Attitash",
    "Wildcat Mountain",
    "Crotched Mountain",
    "Loon Mountain"
  ],
  "Washington": [
    "Stevens Pass",
    "Crystal Mountain",
    "The Summit at Snoqualmie"
  ],
  "Minnesota": [
    "Afton Alps"
  ],
  "Michigan": [
    "Mt. Brighton",
    "Boyne Highlands",
    "Boyne Mountain"
  ],
  "Wisconsin": [
    "Wilmot Mountain"
  ],
  "New York": [
    "Hunter Mountain",
    "Windham Mountain",
    "Whiteface"
  ],
  "Pennsylvania": [
    "Jack Frost / Big Boulder",
    "Roundtop Mountain",
    "Liberty Mountain",
    "Whitetail Resort",
    "Seven Springs",
    "Hidden Valley",
    "Laurel Mountain"
  ],
  "Montana": [
    "Big Sky"
  ],
  "Wyoming": [
    "Jackson Hole",
    "Grand Targhee"
  ],
  "New Mexico": [
    "Taos"
  ],
  "West Virginia": [
    "Snowshoe"
  ],
  "Maine": [
    "Sugarloaf",
    "Sunday River"
  ],
  "Idaho": [
    "Schweitzer",
    "Sun Valley"
  ],
  "British Columbia": [
    "Whistler Blackcomb",
    "Revelstoke",
    "Cypress Mountain",
    "Red Mountain",
    "Sun Peaks",
    "Panorama"
  ],
  "Alberta": [
    "SkiBig3 (Banff)",
    "Banff Sunshine",
    "Lake Louise",
    "Marmot Basin"
  ],
  "Ontario": [
    "Blue Mountain (Ontario)"
  ],
  "Quebec": [
    "Tremblant",
    "Bromont",
    "Le Massif de Charlevoix"
  ]
};
export const RESORT_SUBREGIONS = new Map();
for (const [region, names] of Object.entries(groups)) {
  for (const name of names) RESORT_SUBREGIONS.set(name, [region]);
}
RESORT_SUBREGIONS.set('Heavenly', ['California', 'Nevada']);
export function subregionsFor(resort) { return RESORT_SUBREGIONS.get(resort.name) || []; }
export function regionMatches(resort, filter) {
  return filter === 'all' || resort.region === filter ||
    (filter.startsWith('north-america:') && subregionsFor(resort).includes(filter.slice(14)));
}
export function availableSubregions(resorts) {
  return [...new Set(resorts.flatMap(subregionsFor))].sort((a,b) => a.localeCompare(b));
}

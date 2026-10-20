// Resort name → official website domain for favicon lookup
const RESORT_DOMAINS = new Map([
  // Epic Pass — Colorado
  ['Vail', 'vail.com'],
  ['Beaver Creek', 'beavercreek.com'],
  ['Breckenridge', 'breckenridge.com'],
  ['Keystone', 'keystoneresort.com'],
  ['Crested Butte', 'skicb.com'],
  ['Telluride', 'tellurideskiresort.com'],

  // Epic Pass — Utah
  ['Park City', 'parkcitymountain.com'],

  // Epic Pass — California / Tahoe
  ['Kirkwood', 'kirkwood.com'],
  ['Heavenly', 'skiheavenly.com'],
  ['Northstar', 'northstarcalifornia.com'],

  // Epic Pass — Northeast
  ['Stowe', 'stowe.com'],
  ['Okemo', 'okemo.com'],
  ['Mount Sunapee', 'mountsunapee.com'],
  ['Attitash', 'attitash.com'],
  ['Wildcat Mountain', 'skiwildcat.com'],
  ['Crotched Mountain', 'crotchedmtn.com'],
  ['Hunter Mountain', 'huntermtn.com'],
  ['Mount Snow', 'mountsnow.com'],

  // Epic Pass — Pennsylvania / Mid-Atlantic
  ['Jack Frost / Big Boulder', 'jfbb.com'],
  ['Roundtop Mountain', 'skiroundtop.com'],
  ['Liberty Mountain', 'libertymountainresort.com'],
  ['Whitetail Resort', 'skiwhitetail.com'],
  ['Seven Springs', '7springs.com'],
  ['Hidden Valley', 'hiddenvalleyresort.com'],
  ['Laurel Mountain', 'laurelmountainski.com'],

  // Epic Pass — Pacific Northwest
  ['Stevens Pass', 'stevenspass.com'],

  // Epic Pass — Midwest
  ['Afton Alps', 'aftonalps.com'],
  ['Mt. Brighton', 'mtbrighton.com'],
  ['Wilmot Mountain', 'wilmotmountain.com'],

  // Epic Pass — Canada
  ['Whistler Blackcomb', 'whistlerblackcomb.com'],

  // Epic Pass — Australia
  ['Perisher', 'perisher.com.au'],
  ['Falls Creek', 'fallscreek.com.au'],
  ['Hotham', 'hotham.com.au'],

  // Epic Pass — Japan
  ['Hakuba Valley', 'hakubavalley.com'],
  ['Rusutsu', 'rusutsu.com'],

  // Epic Pass — Europe
  ['Andermatt-Sedrun', 'andermatt-sedrun-disentis.ch'],
  ['Verbier (4 Vallées)', 'verbier.ch'],
  ['Crans-Montana', 'crans-montana.ch'],
  ['Les 3 Vallées', 'les3vallees.com'],
  ['Paradiski', 'paradiski.com'],
  ['Tignes', 'tignes.net'],
  ['Val d\'Isère', 'valdisere.com'],

  // Ikon Pass — Colorado
  ['Aspen Snowmass', 'aspensnowmass.com'],
  ['Steamboat', 'steamboat.com'],
  ['Winter Park', 'winterparkresort.com'],
  ['Copper Mountain', 'coppercolorado.com'],
  ['Eldora', 'eldora.com'],
  ['Arapahoe Basin', 'arapahoebasin.com'],

  // Ikon Pass — Montana / Wyoming
  ['Big Sky', 'bigskyresort.com'],
  ['Jackson Hole', 'jacksonhole.com'],

  // Ikon Pass — Utah
  ['Alta', 'alta.com'],
  ['Snowbird', 'snowbird.com'],
  ['Deer Valley', 'deervalley.com'],
  ['Brighton Resort', 'brightonresort.com'],
  ['Solitude', 'solitudemountain.com'],
  ['Snowbasin', 'snowbasin.com'],

  // Ikon Pass — California
  ['Mammoth Mountain', 'mammothmountain.com'],
  ['June Mountain', 'junemountain.com'],
  ['Big Bear Mountain', 'bigbearmountainresort.com'],
  ['Squaw Valley Alpine Meadows', 'palisadestahoe.com'],
  ['Palisades Tahoe', 'palisadestahoe.com'],

  // Ikon Pass — Northeast
  ['Killington', 'killington.com'],
  ['Sugarbush', 'sugarbush.com'],
  ['Stratton', 'stratton.com'],
  ['Loon Mountain', 'loonmtn.com'],
  ['Sugarloaf', 'sugarloaf.com'],
  ['Sunday River', 'sundayriver.com'],
  ['Windham Mountain', 'windhammountain.com'],
  ['Snowshoe', 'snowshoemtn.com'],

  // Ikon Pass — Midwest
  ['Boyne Highlands', 'boynehighlands.com'],
  ['Boyne Mountain', 'boynemountain.com'],

  // Ikon Pass — West
  ['Taos', 'skitaos.com'],
  ['Crystal Mountain', 'crystalmountainresort.com'],
  ['The Summit at Snoqualmie', 'summitatsnoqualmie.com'],
  ['Sun Valley', 'sunvalley.com'],
  ['Schweitzer', 'schweitzer.com'],

  // Ikon Pass — Canada
  ['Tremblant', 'tremblant.ca'],
  ['Blue Mountain (Ontario)', 'bluemountain.ca'],
  ['SkiBig3 (Banff)', 'skibig3.com'],
  ['Revelstoke', 'revelstokemountainresort.com'],
  ['Cypress Mountain', 'cypressmountain.com'],
  ['Red Mountain', 'redresort.com'],
  ['Sun Peaks', 'sunpeaksresort.com'],
  ['Panorama', 'panoramaresort.com'],

  // Ikon Pass — Europe
  ['Chamonix (Mont Blanc)', 'chamonix.com'],
  ['Zermatt', 'zermatt.ch'],
  ['St. Moritz (Diavolezza)', 'stmoritz.com'],
  ['Kitzbühel', 'kitzbuehel.com'],
  ['Lech Zürs am Arlberg', 'lechzuers.com'],
  ['Dolomiti Superski', 'dolomitisuperski.com'],

  // Ikon Pass — Southern Hemisphere
  ['Thredbo', 'thredbo.com.au'],
  ['Valle Nevado', 'vallenevado.com'],

  // Ikon Pass — Japan
  ['Niseko United', 'niseko.ne.jp'],
  ['Lotte Arai', 'lotteresort.com'],
]);

/**
 * Get a small logo URL for a resort using Google's favicon service.
 * Falls back to null if no domain is mapped.
 */
export function getResortLogoUrl(resortName) {
  const domain = RESORT_DOMAINS.get(resortName);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

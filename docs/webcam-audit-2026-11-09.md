# Webcam audit — November 9, 2026

Audited all 105 resorts. 95 have retained camera sources (426 entries); 10 retain external camera-source links only. The app now reads one catalog covering all passes, rather than an Epic/Ikon-only extraction.

## Verification

- Checked 691 unique source, media, and player URLs in the cleaned-catalog pass; no media-type or HTTP failures in that pass. Subsequent changes removed an insecure URL and an archived timelapse, and replaced Telluride’s offline panorama with already-checked tourism-board players. Browser review also removed Big Bear’s offline Midway player, Valle Nevado’s three unavailable videos, and Schweitzer’s offline Roundshot panorama; alternate resort cameras remain.
- Decoded and visually reviewed 304 snapshots. Removed known offline notices, tracking pixels, promotional images, stale dated-file links, camera control scripts, counters, and duplicate camera cards. Night-time and cloud-obscured images were retained. Also removed 44 legacy player URLs absent from current official camera pages; a browser-reviewed first player was retained where automated source extraction was blocked.
- Checked Snowshoe’s three HLS masters through their child playlists and actual video segments, including CORS headers. All three passed.
- Browser-reviewed the first player for player-only resorts, plus repaired feeds and the actual local resort card. Loading a player page is not proof of uninterrupted live playback; some require Play or provider cookie consent.
- Verified live video inside the local Whistler card at 1280-pixel video resolution. Playback continued across two favorite updates (52.5 → 53.1 seconds), and the broken-image fixture displayed the expected error message.
- HTTP checks do not establish the timestamp or freshness of a camera image. Providers sometimes retain an older image. Snapshot cards explicitly ask users to check the image timestamp.

## Resorts without a verified in-app feed

These retain one honest external source-page card. This list does **not** mean the resort has no physical cameras.

| Resort | Limitation | Source |
| --- | --- | --- |
| Wilmot Mountain | Official camera page currently publishes no camera player. | [Official source](https://www.wilmotmountain.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Hakuba Valley | Old valley camera hub is gone. The current Goryu source reports unavailable streams. | [Official source](https://www.hakubagoryu.jp/en/live-camera/) |
| Val d'Isère | Official viewers use dated image archives; no stable current-image endpoint verified. | [Official source](https://www.valdisere.com/en/live/webcams/) |
| Steamboat | Official source blocks access; a working embedded camera could not be verified. | [Official source](https://www.steamboat.com/the-mountain/live-cams) |
| Windham Mountain | Official page currently has an empty base-area player and a summit fallback image. | [Official source](https://www.windhammountainclub.com/mountain-cam/) |
| Dolomiti Superski | Official regional camera directory found; no in-app feed verified. | [Official source](https://www.dolomitisuperski.com/en/live-info/webcam) |
| Lotte Arai | Official snow page found, but no active camera player verified in the off-season. | [Official source](https://app.lottehotel.com/arai-resort/en/snow-season) |
| Sugar Bowl | Official camera images use dated filenames; no stable current-image endpoint verified. | [Official source](https://www.sugarbowl.com/webcams) |
| Coronet Peak | Official page provides dated snapshot URLs; its camera thumbnails did not display during review. | [Official source](https://www.coronetpeak.co.nz/weather-report) |
| The Remarkables | Official page provides dated snapshot URLs; its camera thumbnails did not display during review. | [Official source](https://www.theremarkables.co.nz/weather-report) |

## Resort-by-resort coverage

“Media response” means image bytes or a video playlist were verified. “Player page” means the provider’s embedding endpoint responds; availability inside the player remains provider-controlled.

| Resort | Media responses | Player pages | Source |
| --- | ---: | ---: | --- |
| Vail | 6 | 0 | [Official source](https://www.vail.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Beaver Creek | 8 | 0 | [Official source](https://www.beavercreek.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Breckenridge | 3 | 0 | [Official source](https://www.breckenridge.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Keystone | 5 | 0 | [Official source](https://www.keystoneresort.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Crested Butte | 5 | 0 | [Official source](https://www.skicb.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Park City | 7 | 0 | [Official source](https://www.parkcitymountain.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Kirkwood | 2 | 0 | [Official source](https://www.kirkwood.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Heavenly | 4 | 0 | [Official source](https://www.skiheavenly.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Northstar | 3 | 0 | [Official source](https://www.northstarcalifornia.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Stowe | 3 | 0 | [Official source](https://www.stowe.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Okemo | 4 | 0 | [Official source](https://www.okemo.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Mount Sunapee | 3 | 0 | [Official source](https://www.mountsunapee.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Stevens Pass | 4 | 0 | [Official source](https://www.stevenspass.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Whistler Blackcomb | 8 | 0 | [Official source](https://www.whistlerblackcomb.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Afton Alps | 3 | 0 | [Official source](https://www.aftonalps.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Mt. Brighton | 1 | 0 | [Official source](https://www.mtbrighton.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Wilmot Mountain | 0 | 0 | [Official source](https://www.wilmotmountain.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Attitash | 3 | 0 | [Official source](https://www.attitash.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Wildcat Mountain | 3 | 0 | [Official source](https://www.skiwildcat.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Crotched Mountain | 0 | 2 | [Official source](https://www.crotchedmtn.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Hunter Mountain | 4 | 0 | [Official source](https://www.huntermtn.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Mount Snow | 5 | 0 | [Official source](https://www.mountsnow.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Jack Frost / Big Boulder | 3 | 0 | [Official source](https://www.jfbb.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Roundtop Mountain | 5 | 0 | [Official source](https://www.skiroundtop.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Liberty Mountain | 6 | 0 | [Official source](https://www.libertymountainresort.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Whitetail Resort | 2 | 0 | [Official source](https://www.skiwhitetail.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Seven Springs | 4 | 0 | [Official source](https://www.7springs.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Hidden Valley | 0 | 2 | [Official source](https://www.hiddenvalleyresort.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Laurel Mountain | 0 | 1 | [Official source](https://www.laurelmountainski.com/the-mountain/mountain-conditions/mountain-cams.aspx) |
| Perisher | 5 | 0 | [Official source](https://www.perisher.com.au/reports-cams/cams) |
| Falls Creek | 8 | 0 | [Official source](https://www.skifalls.com.au/snow-cams) |
| Hotham | 7 | 0 | [Official source](https://www.mthotham.com.au/mountain/conditions/snow-cams) |
| Hakuba Valley | 0 | 0 | [Official source](https://www.hakubagoryu.jp/en/live-camera/) |
| Rusutsu | 3 | 0 | [Official source](https://rusutsu.com/en/live-mountain-cams/) |
| Andermatt-Sedrun | 3 | 0 | [Official source](https://www.andermatt-sedrun-disentis.ch/andermatt/en/stories/webcams) |
| Verbier (4 Vallées) | 0 | 3 | [Official source](https://www.verbier.ch/en/practice/live/webcams/) |
| Crans-Montana | 4 | 4 | [Official source](https://www.crans-montana.ch/en/Bibis-House-614/webcam/) |
| Les 3 Vallées | 4 | 0 | [Official source](https://www.les3vallees.com/en/live/webcams) |
| Paradiski | 8 | 0 | [Official source](https://www.la-plagne.com/decouvrir-la-plagne/domaine-skiable/webcams) |
| Tignes | 0 | 8 | [Official source](https://en.tignes.net/webcams) |
| Val d'Isère | 0 | 0 | [Official source](https://www.valdisere.com/en/live/webcams/) |
| Telluride | 0 | 2 | [Official source](https://www.telluride.com/plan-your-visit/webcams/) |
| Aspen Snowmass | 7 | 0 | [Official source](https://www.aspensnowmass.com/four-mountains/mountain-cams) |
| Steamboat | 0 | 0 | [Official source](https://www.steamboat.com/the-mountain/live-cams) |
| Winter Park | 0 | 5 | [Official source](https://www.winterparkresort.com/the-mountain/mountain-cams) |
| Copper Mountain | 8 | 0 | [Official source](https://www.coppercolorado.com/the-mountain/webcams/) |
| Eldora | 1 | 0 | [Official source](https://www.eldora.com/the-mountain/webcams/snow-stake-cam/) |
| Arapahoe Basin | 6 | 2 | [Official source](https://www.arapahoebasin.com/mountain-cams/) |
| Big Sky | 0 | 5 | [Official source](https://www.bigskyresort.com/current-conditions/webcams) |
| Jackson Hole | 8 | 0 | [Official source](https://www.jacksonhole.com/live-mountain-cams) |
| Alta | 2 | 0 | [Official source](https://www.alta.com/weather) |
| Snowbird | 8 | 0 | [Official source](https://www.snowbird.com/the-mountain/webcams/view-all-webcams/) |
| Deer Valley | 0 | 3 | [Official source](https://www.deervalley.com/explore-the-mountain/webcams) |
| Brighton Resort | 0 | 4 | [Official source](https://www.brightonresort.com/conditions) |
| Solitude | 0 | 8 | [Official source](https://www.solitudemountain.com/mountain-and-village/webcams) |
| Mammoth Mountain | 0 | 1 | [Official source](https://www.mammothmountain.com/on-the-mountain/mammoth-webcam) |
| June Mountain | 0 | 2 | [Official source](https://www.junemountain.com/mountain-information/live-cams) |
| Big Bear Mountain | 0 | 2 | [Official source](https://www.bigbearmountainresort.com/webcams) |
| Palisades Tahoe | 0 | 2 | [Official source](https://www.palisadestahoe.com/mountain-information/webcams) |
| Killington | 8 | 0 | [Official source](https://www.killington.com/the-mountain/conditions-weather/webcam/) |
| Sugarbush | 8 | 0 | [Official source](https://www.sugarbush.com/mountain/webcams) |
| Stratton | 0 | 1 | [Official source](https://www.stratton.com/the-mountain/webcams) |
| Tremblant | 0 | 1 | [Official source](https://www.tremblant.ca/mountain-village/webcams) |
| Blue Mountain (Ontario) | 0 | 2 | [Official source](https://www.bluemountain.ca/mountain/webcams) |
| SkiBig3 (Banff) | 8 | 0 | [Official source](https://www.skibig3.com/webcams/) |
| Revelstoke | 0 | 5 | [Official source](https://www.revelstokemountainresort.com/mountain/conditions/webcams/) |
| Cypress Mountain | 0 | 5 | [Official source](https://www.cypressmountain.com/webcams) |
| Red Mountain | 8 | 0 | [Official source](https://www.redresort.com/report/?cams) |
| Sun Peaks | 8 | 0 | [Official source](https://www.sunpeaksresort.com/ski-ride/weather-conditions-cams/webcams) |
| Crystal Mountain | 1 | 0 | [Official source](https://www.crystalmountainresort.com/the-mountain/mountain-report-and-webcams/webcams) |
| The Summit at Snoqualmie | 0 | 7 | [Official source](https://www.summitatsnoqualmie.com/webcams) |
| Loon Mountain | 0 | 5 | [Official source](https://www.loonmtn.com/mountain-report) |
| Sugarloaf | 0 | 3 | [Official source](https://www.sugarloaf.com/mountain-report) |
| Sunday River | 0 | 4 | [Official source](https://www.sundayriver.com/mountain-report) |
| Boyne Highlands | 0 | 2 | [Official source](https://www.highlandsharborsprings.com/mountain-report) |
| Boyne Mountain | 0 | 8 | [Official source](https://www.boynemountain.com/mountain-report) |
| Taos | 4 | 1 | [Official source](https://www.skitaos.com/lifts?section=weather-forecast) |
| Snowshoe | 3 | 0 | [Official source](https://www.snowshoemtn.com/media-room/web-cams) |
| Windham Mountain | 0 | 0 | [Official source](https://www.windhammountainclub.com/mountain-cam/) |
| Chamonix (Mont Blanc) | 8 | 0 | [Official source](https://en.chamonix.com/webcams) |
| Zermatt | 2 | 0 | [Official source](https://zermatt.swiss/en/info/webcams?tab=mountains) |
| St. Moritz (Diavolezza) | 2 | 2 | [Official source](https://www.corvatsch-diavolezza.ch/en/news-1/live-webcams) |
| Kitzbühel | 1 | 0 | [Official source](https://www.kitzbuehel.com/en/live/) |
| Lech Zürs am Arlberg | 2 | 0 | [Official source](https://www.skiarlberg.at/en/lech-zuers/live-info/webcams) |
| Dolomiti Superski | 0 | 0 | [Official source](https://www.dolomitisuperski.com/en/live-info/webcam) |
| Thredbo | 0 | 1 | [Official source](https://www.thredbo.com.au/weather/snow-cams/) |
| Niseko United | 0 | 6 | [Official source](https://www.niseko.ne.jp/en/livecamera/) |
| Lotte Arai | 0 | 0 | [Official source](https://app.lottehotel.com/arai-resort/en/snow-season) |
| Valle Nevado | 0 | 3 | [Official source](https://www.vallenevado.com/en/cameras/) |
| Panorama | 8 | 0 | [Official source](https://www.panoramaresort.com/panorama-today/mountain-webcams) |
| Schweitzer | 0 | 6 | [Official source](https://www.schweitzer.com/mountain-info/webcam) |
| Sun Valley | 5 | 0 | [Official source](https://www.sunvalley.com/the-mountain/web-cams/) |
| Snowbasin | 6 | 0 | [Official source](https://www.snowbasin.com/the-mountain/web-cams/) |
| Grand Targhee | 6 | 0 | [Official source](https://www.grandtarghee.com/the-mountain/cams-conditions/webcams) |
| Sugar Bowl | 0 | 0 | [Official source](https://www.sugarbowl.com/webcams) |
| Whiteface | 2 | 0 | [Official source](https://whiteface.com/mountain/webcams/) |
| Banff Sunshine | 6 | 0 | [Official source](https://www.skibanff.com/webcams) |
| Bromont | 0 | 5 | [Official source](https://www.bromontmontagne.com/webcams/) |
| Lake Louise | 8 | 0 | [Official source](https://www.skilouise.com/mountain-cam/) |
| Le Massif de Charlevoix | 0 | 1 | [Official source](https://www.lemassif.com/en/the-mountain/winter/snow-weather-webcams) |
| Marmot Basin | 3 | 0 | [Official source](https://www.skimarmot.com/mountain/weather-conditions/) |
| Megève | 1 | 0 | [Official source](https://www.megeve-tourisme.fr/informations-pratiques/infos-live/webcams/) |
| Mt Buller | 4 | 4 | [Official source](https://www.mtbuller.com.au/winter/weather/web-cams) |
| Coronet Peak | 0 | 0 | [Official source](https://www.coronetpeak.co.nz/weather-report) |
| The Remarkables | 0 | 0 | [Official source](https://www.theremarkables.co.nz/weather-report) |

## Rechecking

Run `python3 scripts/audit_webcams.py` from the project root. It writes per-URL evidence to `output/webcam-audit/catalog-audit.json`. Camera availability can change independently of this site.

## Implementation

- Corrected Hidden Valley, Pennsylvania’s mapping, which previously used the Missouri resort’s extracted camera source.
- Added explicit image/video/HLS load-error messages and a visible catalog-load error. Cross-origin iframe failures cannot always be detected by the parent page, so an official source-page link remains available.
- Kept active players intact during weather/unit/favorite re-renders, and refresh visible snapshots every 45 seconds on both map and mountain pages.
- Preserved image proportions so panorama views and timestamp overlays are not cropped; provided live-video buttons for Brownrice snapshots.

Validation: 128 JavaScript tests and 13 Python tests passed; static packaging completed (220 files), and `git diff --check` passed. Changes are local; no deployment was performed for this audit.

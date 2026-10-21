# Resort source repair and reliability report

Checked 2026-10-21T21:55:02.351Z. All counts describe this collection, not a historical uptime guarantee.

## How collection works

The hourly GitHub workflow fetches one Open-Meteo weather response per destination, then attempts each configured official source. The official collectors read embedded JSON, provider JSON APIs, or a scoped visible winter report. A stale or failed snowfall report can use the same fresh weather response as an explicitly labeled model estimate. Model weather never supplies terrain or grooming counts. Hourly weather uses approximately 2,520 API requests per day for 105 destinations. Historical backfill is capped at 1,200 weighted calls per six-hour run to leave current-weather capacity on the evaluation tier. The browser reloads snapshots every 15 minutes and checks expiration every minute. A 1–3 hour old forecast is still a forecast issued at its recorded time, not a current mountain measurement.

## Coverage after repair

| Category | Destinations |
| --- | --- |
| Official report connections configured | 63/105 |
| Current resort-reported recent conditions | 5/105 |
| Explicit model alternatives for recent conditions | 100/105 |
| Current official winter terrain snapshots | 42/105 |
| Current model forecasts | 105/105 |

| Field | Available destinations |
| --- | --- |
| snow24h | 105/105 |
| snow48h | 104/105 |
| snow72h | 102/105 |
| baseDepth | 105/105 |
| tempF | 105/105 |
| runsOpen | 42/105 |
| runsTotal | 39/105 |
| groomedRuns | 40/105 |

## Diagnoses and repairs

- Alta: the full `conditions.dated_at` was ignored in favor of a time-only display label. The collector now resolves the full timestamp in America/Denver and collects the published temperature and operation totals.
- Mtnfeed/Alterra: snow reports and terrain share a response but have different clocks. Terrain now uses the current feed snapshot, not the date of a separate old snowfall report. Big Bear combines all three requested mountains, with completeness and duplicate checks; snow is a point value only when component reports agree.
- Palisades: the static winter configuration returned HTTP 401 while the official website publishes a different summer configuration. The collector now follows the official page’s active configuration and public token rotation. A summer-only feed with no winter inventory is unavailable, rather than zero ski runs.
- Boyne/ReportPal: nine resorts had no official connector. The collector now reads the same structured JSON endpoint used by their official websites. Winter facilities are separated from summer biking and hiking. Explicit inch fields avoid metric-unit mistakes.
- Snowbasin/Sun Valley: broad HTML matches picked unrelated numbers and counted grooming legend/closed-trail icons. The collector now uses the visible winter summaries, combining Bald and Dollar mountains at Sun Valley. Open groomed runs exclude closed trails and legends.
- POWDR: naive report times lacked a timezone, and old snow-report dates suppressed healthy trail data. Full dates now resolve in each verified resort timezone; winter trail status is independently checked. Summer and hidden trail records are excluded.
- A-Basin: the old count pattern ran past the run label and captured the lift count. The repaired count pattern returns the explicit 0/147 run summary. Undated snow is not promoted into a fresh observation.
- Telluride: the old scrape included commented-out report HTML, and the page-render timestamp does not establish when snowfall was measured. The connector uses the live visible trail summary and keeps undated snow as unverified.
- Killington: the old API hostname fails TLS hostname validation. The new official report URL works but currently exposes summer bike/hike counts only. Those counts are not ski runs; the old API is retired in the configuration. TLS verification remains enabled.
- Blue Mountain: a fresh generated feed contained 38 open trail states last changed weeks earlier. Positive skiing access now requires current dated winter evidence; the generated feed clock cannot renew old states. Closed/expected and summer trails are never turned into open ski runs.
- Fourteen Vail-owned small-resort terrain feeds explicitly return IsSuccessful=false. That is an upstream/offseason failure, not a missing JSON parser. Their weather remains available as labeled model estimates; ski operations remain unavailable without another verified source.
- Transient connection resets and HTTP 502/503/504 get one bounded retry. Authentication failures, invalid certificates, and missing schemas are surfaced. No retry fabricates a response or renews an old observation date.

## Which sources are reliable for which purpose?

| Source | Suitable use | Material limit |
| --- | --- | --- |
| Official live terrain JSON / current winter tables | Published run counts, closures, open groomed trails | Some sites stop winter feeds in summer; states are checked snapshots, not continuous telemetry. |
| Resort-dated snow reports | Resort measurements at a stated time and reporting point | May stop updating offseason. Some fields/periods are never reported; grouped destinations can have different measurements. |
| Open-Meteo | Consistent global forecasts and labeled recent-weather estimates | Model output at catalog coordinates, not resort observations, grooming, or open terrain. Free endpoint has no uptime guarantee; commercial use needs an appropriate plan. |
| OnTheSnow / Mountain News partner API | A candidate licensed global source for snow and operating data | Paid, API-key access; exact coverage, timestamps, grooming fields and redistribution terms need a quote for this catalog. |
| Skiresort Service International XML | Another candidate global snow/operation feed | Commercial access; some destinations describe slopes in km instead of run counts. Need a field-level coverage check. |
| SnoCountry | Candidate licensed resort conditions feed, particularly North America | A purchased key is needed; international coverage is separately licensed. Public demonstration access is not production coverage. |

Provider documentation: [Open-Meteo reliability and licensing](https://open-meteo.com/en/pricing), [Mountain News partner API](https://partner.docs.onthesnow.com/), [Skiresort XML interface](https://www.skiresort-service.com/en/content/interface), [SnoCountry developer guide](https://feeds.snocountry.net/legacy-docs.php).

## Remaining work needed for complete global coverage

The unconnected destinations still need verified official adapters or a licensed feed. Weather models cannot recover ski operations or grooming. A provider quote should use the complete 105-destination catalog and explicitly ask about grouped resorts, 24/48/72-hour measurements, report timestamps, open runs versus piste km, open groomed runs, seasonal closure status, allowed refresh frequency, and commercial redistribution. No paid service has been purchased or contacted. Neither scrape-based nor licensed feeds can promise every field at every resort at all times; the UI must continue to show the source, time and unavailable state.

Collection is scheduled hourly; GitHub Actions schedules are best-effort, not a continuous-data service guarantee. The local code is repaired; scheduled collection changes take effect only after these changes are published to the default branch with Actions enabled. The existing Pages deployment is triggered after the data workflow.

## Every destination

| Resort | Collector | Resort snow report | Displayed recent conditions | Winter terrain | Remaining gaps / issues |
| --- | --- | --- | --- | --- | --- |
| Vail | vail | stale | ready (model) | ready | runsTotal; Snow report stale: Updated October 15, 2026 at 12:31 PM MDT. |
| Beaver Creek | vail | stale | ready (model) | ready | Snow report stale: Updated October 15, 2026 at 12:37 PM MDT. |
| Breckenridge | vail | stale | ready (model) | ready | Snow report stale: Updated June 23, 2026 at 4:22 PM MDT. |
| Keystone | vail | ready | ready (reported) | ready | snow72h |
| Crested Butte | vail | stale | ready (model) | ready | Snow report stale: Updated October 15, 2026 at 12:37 PM MDT. |
| Park City | vail | stale | ready (model) | ready | Snow report stale: Updated June 23, 2026 at 4:24 PM MDT. |
| Kirkwood | vail | stale | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns; Snow report stale: Updated April 23, 2026 at 5:09 AM PDT. Terrain report unavailable. |
| Heavenly | vail | stale | ready (model) | ready | Snow report stale: Updated June 23, 2026 at 3:23 PM PDT. |
| Northstar | vail | stale | ready (model) | ready | runsTotal; Snow report stale: Updated June 23, 2026 at 3:23 PM PDT. |
| Stowe | vail | stale | ready (model) | ready | Snow report stale: Updated June 23, 2026 at 6:21 PM EDT. |
| Okemo | vail | stale | ready (model) | ready | Snow report stale: Updated June 23, 2026 at 6:24 PM EDT. |
| Mount Sunapee | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Stevens Pass | vail | stale | ready (model) | ready | runsTotal; Snow report stale: Updated June 23, 2026 at 3:24 PM PDT. |
| Whistler Blackcomb | vail | ready | ready (reported) | error | snow72h; runsOpen; runsTotal; groomedRuns; Terrain report: Assignment token not found: FR.TerrainStatusFeed = Terrain report error. |
| Afton Alps | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Mt. Brighton | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Wilmot Mountain | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Attitash | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Wildcat Mountain | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Crotched Mountain | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Hunter Mountain | vail | stale | ready (model) | ready | Snow report stale: Updated June 23, 2026 at 6:22 PM EDT. |
| Mount Snow | vail | stale | ready (model) | ready | Snow report stale: Updated June 23, 2026 at 6:22 PM EDT. |
| Jack Frost / Big Boulder | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Roundtop Mountain | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Liberty Mountain | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Whitetail Resort | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Seven Springs | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Hidden Valley | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Laurel Mountain | vail | error | ready (model) | error | runsOpen; runsTotal; groomedRuns; Snow report: Assignment token not found: FR.snowReportData = Terrain report: Terrain feed did not report success. Snow report error: no verified report timestamp. Terrain report error. |
| Perisher | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Falls Creek | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Hotham | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Hakuba Valley | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Rusutsu | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Andermatt-Sedrun | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Verbier (4 Vallées) | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Crans-Montana | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Les 3 Vallées | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Paradiski | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Tignes | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Val d'Isère | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Telluride | telluride | unverified | ready (model) | ready | Snow report unverified: no verified report timestamp. |
| Aspen Snowmass | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Steamboat | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-19T11:56:24-0600. |
| Winter Park | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-07T14:37:49-0600. |
| Copper Mountain | powdr | stale | ready (model) | ready | Snow report stale: 2026-05-03 16:15:00. |
| Eldora | powdr | stale | ready (model) | ready | Snow report stale: 2026-04-05 16:47:12. |
| Arapahoe Basin | abasin | unverified | ready (model) | ready | groomedRuns; Snow report unverified: no verified report timestamp. |
| Big Sky | reportpal | ready | ready (reported) | ready |  |
| Jackson Hole | jacksonhole | unavailable | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns; Snow report unavailable: no verified report timestamp. Terrain report unavailable. |
| Alta | alta | ready | ready (reported) | ready | snow48h; snow72h; groomedRuns |
| Snowbird | powdr | stale | ready (model) | ready | Snow report stale: 2026-10-20 09:00:00. |
| Deer Valley | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-13T12:58:30-0600. |
| Brighton Resort | reportpal | ready | ready (reported) | ready |  |
| Solitude | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-20T15:44:06-0600. |
| Mammoth Mountain | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-20T12:59:27-0700. |
| June Mountain | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-08T13:15:41-0700. |
| Big Bear Mountain | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-03-31T20:07:43-0700 / 2026-05-04T10:16:22-0700 / 2026-10-07T13:50:22-0700. |
| Palisades Tahoe | mtnfeed | unavailable | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns; The official page currently selects a summer feed; summer trails are not ski-run inventory. Snow report unavailable: 2026-09-08T09:50:24-0700. Terrain report unavailable. |
| Killington | killington | unavailable | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns; Snow report unavailable: no verified report timestamp. Terrain report unavailable. |
| Sugarbush | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-20T14:44:22-0400. |
| Stratton | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-04-12T19:21:02-0400. |
| Tremblant | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Blue Mountain (Ontario) | mtnfeed | stale | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns; The official page currently selects a summer feed; summer trails are not ski-run inventory. Snow report stale: 2026-07-19T06:54:23-0400. Terrain report unavailable. |
| SkiBig3 (Banff) | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Revelstoke | revelstoke | unavailable | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns; Snow report unavailable: no verified report timestamp. Terrain report unavailable. |
| Cypress Mountain | reportpal | stale | ready (model) | ready | Snow report stale: 2026-10-09T18:58:57Z. |
| Red Mountain | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Sun Peaks | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Crystal Mountain | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-05-18T12:41:48-0700. |
| The Summit at Snoqualmie | reportpal | stale | ready (model) | ready | Snow report stale: 2026-09-28T19:06:49Z. |
| Loon Mountain | reportpal | unavailable | ready (model) | ready | Snow report unavailable: 2026-10-20T12:31:06Z. |
| Sugarloaf | reportpal | stale | ready (model) | ready | Snow report stale: 2026-10-19T15:52:38Z. |
| Sunday River | reportpal | stale | ready (model) | ready | Snow report stale: 2026-10-20T14:21:51Z. |
| Boyne Highlands | reportpal | unavailable | ready (model) | ready | Snow report unavailable: 2026-10-21T15:00:18Z. |
| Boyne Mountain | reportpal | unavailable | ready (model) | ready | Snow report unavailable: 2026-10-19T18:03:23Z. |
| Taos | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Snowshoe | mtnfeed | stale | ready (model) | ready | Snow report stale: 2026-10-17T13:59:51-0400. |
| Windham Mountain | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Chamonix (Mont Blanc) | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Zermatt | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| St. Moritz (Diavolezza) | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Kitzbühel | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Lech Zürs am Arlberg | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Dolomiti Superski | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Thredbo | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Niseko United | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Lotte Arai | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Valle Nevado | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Panorama | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Schweitzer | mtnfeed | unavailable | ready (model) | ready | Snow report unavailable: 2026-10-12T15:05:38-0700. |
| Sun Valley | snowbasin | unverified | ready (model) | ready | Snow report unverified: no verified report timestamp. |
| Snowbasin | snowbasin | unverified | ready (model) | ready | Snow report unverified: no verified report timestamp. |
| Grand Targhee | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Sugar Bowl | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Whiteface | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Banff Sunshine | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Bromont | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Lake Louise | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Le Massif de Charlevoix | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Marmot Basin | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Megève | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Mt Buller | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| Coronet Peak | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |
| The Remarkables | open-meteo | not-configured | ready (model) | unavailable | runsOpen; runsTotal; groomedRuns |

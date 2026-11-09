# Snow rankings

## Forecast presentation (Nov 9)

Biggest forecast is the public upcoming-snow filter. Its previews show 72h
snowfall and weather tradeoffs: rain plus showers, maximum temperature,
maximum gusts, and possible temperature crossing freezing. These use complete,
fresh model inputs at one terrain elevation. Missing inputs are stated explicitly.
The summaries cannot identify the timing of individual risks within the 72h window,
so do not claim “rain early” or “wind Sunday” from these aggregate fields.

Best upcoming has been removed from the main filters. Old `sort=bestUpcoming`
links open Biggest forecast and preserve their other filters. The internal
`bestUpcoming` calculation and tests are retained for evaluation, without exposing
its score in resort previews. The remaining sections document both the public
Best today score and the retained internal calculation.


Snow potential (`score`) now uses `1.1 × forecast72h + 1.35 × preservationCreditInches`.
The flat dry-day penalty and the original 24h-only recent-snow contribution are removed.
It requires a current forecast and a complete 14-day hourly preservation summary.
It does not verify opening. Unknown preservation is not replaced with the old formula.

## Snow preservation (Nov 9)

The shared `snow-preservation.js` module processes the last 336 complete hourly
intervals in chronological order. The browser parser and scheduled forecast collector
both call it. The forecast API request now uses `past_days=14`; each collector run
rebuilds a bounded history from the API, without a new server or a separate stored
hourly archive. Snapshots contain compact summaries, not raw hourly histories.
Snowfall before that window and base coverage are outside this score's scope.

Each hourly snowfall becomes a separate layer of scoring credit. Existing layers
lose credit as follows, with all factors multiplying:

- Age: half the credit every seven days, even if it remains cold.
- Above-freezing exposure: half per 48 accumulated °C-hours above 0°C.
- Rain plus showers: half per 5 mm falling on that layer.
- Freezing after a layer was warm/wet: halve its remaining credit once for that
  wet-to-frozen transition. Subsequent cold never restores the lost credit.

New snow adds a new layer without resetting the older layers. Within-hour timing
of snow versus liquid precipitation is unavailable; new layers receive the same
hour's temperature/rain deductions, with freezing rain flagged as possible crust.
Credit is not observed remaining snowfall, physical snow depth, or untouched powder.
The coefficients are explicit experimental heuristics, not calibrated snow physics.
Sun exposure, wind redistribution, grooming, skier traffic, and covering a crust
with a sufficient new layer are not modeled. A crust flag refers to older layers,
not a guaranteed crust at the current surface.

No snowfall within a complete window yields zero recent credit; it does not assert
that older snow or the resort's base is absent. Missing timestamps, null readings,
negative precipitation, wrong units, stale summaries or incomplete windows withhold
the score. Reports identify the latest modeled snowfall and summarize weather since
the first snowfall in the window, not necessarily since the latest storm.
The conditions card and Snow potential preview explain this credit and its limits.

Best today (`bestToday`) and Best upcoming (`bestUpcoming`) are experimental
snowfall-opportunity rankings. They are not validated measures of skiing quality
or guarantees of opening, powder, lift operation, or mountain-wide conditions.
Do not describe small differences as meaningful precision.

## Eligibility

Best today requires `liveTerrainStatus=ready`, a report of strictly positive open ski
runs, a checked timestamp within 8 hours, and an operating timestamp within
24 hours (8 hours for feed/checked timestamps). Lift-only reports, closed runs,
and unknown or stale operations are excluded from Best today. Best upcoming
does not check operating reports or open-run counts: closed, unverified and
stale-operation resorts remain eligible when their forecast inputs are complete.

Both also require a fresh, resort-local-date forecast under the existing weather
contract, plus complete finite temperature, rain, showers, sustained wind and
gust inputs with expected units for their respective weather window.
Missing inputs exclude that ranking; they are never treated as zero risk.
Old snapshots remain usable for snowfall but cannot supply quality scores.

## Snow basis and timing

Today uses fresh reported/model snowfall with consistent cumulative windows:
`snow24h + .5 × (snow48h − snow24h) + .25 × (snow72h − snow48h)`.
No forecast snowfall contributes. Its weather window is the union of the last
24 hourly intervals and today's 09:00–16:00 hours in the resort's timezone.
Overlapping hours are counted once. This includes past weather affecting snow
preservation and the ski day's weather; at night it still describes that local
calendar day's skiing, not tomorrow's. It requires a fresh snow report as well.

Upcoming uses only snowfall over the next 72 complete hourly intervals, beginning
after the as-of hour, matching the existing rolling `forecast72h` contract.
Its weather window is those same 72 hours.

The parser records window timestamps. The existing API timezone offset is used
for today's ski-day boundaries. Rain and convective showers are added as liquid
precipitation; total precipitation is not used because it includes snowfall.
Wind values are maxima, not averages. Model wind at 10m above the selected
terrain point is not a ridge wind observation or a lift-closure prediction.

## Explicit, provisional scoring rules

Both start with 10 points per inch of their snow basis, then multiply by:

- Warmth: `max(.2, 1 − max(0, maxTempF − 32) × .05)`.
- Liquid precipitation: `1 / (1 + rainAndShowersMm / 2)`.
- Wind: `max(.25, 1 − max(0, windMph − 20, (gustMph − 30) / 1.5) / 40)`.
- Temperature crossing freezing: `.75` if minimum is below 32°F and maximum
  is above 32°F; otherwise `1`.

Round once to whole points. Zero snow is a real zero score. Negative and missing
weather values cannot enter the score. There is no artificial maximum score.
These thresholds and age weights are transparent product heuristics, not an
empirically calibrated model. Each preview explains the snow basis and deductions.
The main page has an accessible disclosure with the same methodology.

Weather extremes are conservative across a whole window: a warm or rainy hour
can reduce the entire snow basis even if fresh snow comes afterward. Temperature
crossing freezing signals possible freeze–thaw; it does not establish the order
of a thaw and refreeze. Snow density, base coverage, grooming, slope/aspect,
sun exposure, individual lift closures and forecast uncertainty are not scored.

## Data pipeline and verification

The browser and scheduled collector share `weather-data.js`. The hourly collector
writes `skiQuality.version=1` summaries into existing schema-2 forecasts.
Rain/showers are millimeters, wind/gusts are mph (`mp/h` in API unit metadata),
and temperature is Fahrenheit. Existing snowfall conversions remain unchanged.

Relevant checks: `tests/snow-quality.test.mjs`, quality-window cases in
`tests/conditions.test.mjs`, the full Node suite, Python packaging checks,
and browser checks of empty/eligible rankings, preview explanations and mobile
layout. Source API fields: https://open-meteo.com/en/docs .

## Sixteen-day planning outlook and potential powder days

The forecast request and daily parser now retain up to 16 resort-local calendar
days, including today. The chart and daily cards show all available dates, with
horizontal chart scrolling so 16 days remain legible on small screens. Days 8–16
are styled and labeled as a longer-range outlook, not a confidence percentage.
Missing late-day amounts stay unavailable, not zero. The heatmap's Biggest
forecast and Snow potential incoming component still use rolling 72h snowfall.
The existing near-term trip-date helper is not extended to auto-select a distant
storm solely because it is the largest daily total in the 16-day outlook.

The Forecast panel lists Potential powder days at an exact threshold of 6 inches
(15.24 cm, approximately 15 cm) per resort-local calendar day. This threshold is
unit-independent. Entries distinguish today's total, which includes snow that
may already have fallen, from future dates; days 8 onward are longer-range
candidates. Selecting an entry focuses the corresponding daily forecast card.
The daily cards also carry a potential-powder badge. No new heatmap filter,
notification subscription, or outbound alerts are created.

The marker means modeled snowfall reaches the threshold; it does not establish
dry powder, open terrain, or suitable weather. Calendar boundaries can split a
storm across two sub-threshold days. Counts exclude missing daily amounts and
stale forecasts. Do not sum the full outlook into the near-term rankings or
present a distant candidate as an imminent storm.


## Selectable forecast bars (Nov 9 revision)

The forecast now uses one horizontally scrollable 16-day bar chart and a single
selected-day detail panel below. The separate daily-card grid and powder-date
list have been removed. Each full day column is selectable, including days with
zero or missing snowfall. Click/tap selects a day; arrow keys and Home/End move
through dates and scroll the selected bar into view. The selection is retained
by date across data/unit refreshes for the same resort.

Bars meeting the existing exact six-inch daily threshold gently pulse in opacity
without changing height. The accessible label and selected-day text also identify
powder candidates. Reduced-motion preferences disable the animation. Later days
retain their outlook styling and selected-day label. Forecast methodology and
source links live in the About this forecast disclosure. Static comparison charts
remain noninteractive. No scoring or forecast-horizon changes accompany this UI.


## Powder Alert heatmap (Nov 9)

The `powderAlert` filter ranks resorts by their strongest incoming powder day.
A day must have at least 6 inches (15.24 cm) of incoming snowfall. Each eligible
day scores `snowInches × 10 × 0.5^(daysAway / 3)`. The resort's score is the maximum,
not a sum; exact ties use the earlier day. Sorting uses unrounded scores, while
tiles display whole points. This is an experimental priority index, not probability.
Opening status and weather-quality deductions do not affect this filter.

Day offsets and dates are resort-local; the 16-day window includes today and
15 subsequent days. Today uses the remaining portion of forecast hourly intervals,
not the calendar-day total. The current interval is prorated uniformly, an explicit
within-hour assumption rather than an observation. A compact remaining-today hourly
array is generated by the shared parser and written by the existing collector.
Missing intervals do not become zero. If today's summary is missing, other complete
future dates remain eligible and the preview reports missing-day counts.

The tile shows the score, scoring day's incoming snowfall/arrival/date, and the
peak incoming day's snowfall/arrival/date separately. The peak uses today's remaining
amount, not already-fallen snow. Dates from day 8 onward are labeled Outlook.
The preview explains the time discount and missing data. Tile sizes/colors scale
with the priority score for the current filter group. No matching day, or a stale
forecast, excludes the resort. Rankings refresh each minute for today's remaining
snow; hover interactions defer reordering until dismissal when possible.

This is an on-page filter and does not subscribe users to notifications. Per-day
thresholds can miss storms split across midnight. Single-model long-range totals
remain uncertain even when large; no calibrated confidence claim is made.

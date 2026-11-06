# Snowfall data

Current and forecast weather now use separate ski-terrain points in
`js/weather-locations-data.js`, built by `scripts/build_weather_locations.mjs`.
The same points drive browser current-snow checks, browser forecasts and the
hourly forecast collector. Whistler uses Roundhouse / PEAK 2 PEAK at the official
1,850 m elevation; the other points are spatial samples of mapped ski trails
with Open-Meteo DEM elevation. They are not measured weather stations, guaranteed
mid-elevation points, or conditions across every mountain in grouped destinations.
Requested coordinates, returned model grid centers and elevation are recorded in
each forecast. See `docs/mountain-weather-audit.md` for all 105 locations.
Old model snapshots at changed locations are withheld rather than reused.
The historical ERA5 season series below is unchanged and uses its existing
coarse grid/catalog coordinates; do not compare it as an identical mountain station.

Whistler's official October 21, 2026 snow report is currently stale. Its terrain
page explicitly says trail and lift status is offline before winter opening.
The collector recognizes this notice; unknown operations are never zero counts.
Neither this correction nor a positive forecast establishes that it is snowing
at this instant. The snow animation remains explicitly labeled as model output.

`resort-snowfall.json` contains **weather-model estimates**, using Open-Meteo's
ECMWF ERA5 reanalysis at the coordinates in `js/constants.js`. These are not
resort snow-stake measurements. ERA5 has approximately 25 km resolution and
about five days of publication delay. Each resort records its available cutoff,
requested coordinates, returned grid coordinates/elevation, and source.

- Northern seasons: July 1–June 30, labeled `2025/26`.
- Southern seasons: January 1–December 31, labeled `2025`.
- Days use UTC consistently for all locations.
- API daily snowfall is centimeters; stored season totals are inches.
- A missing day makes the season total unavailable. A real zero stays zero.
- Only complete past seasons enter the history page. The current chart uses the
  current season through each location's available model cutoff.
- The archive begins January 1940. Initial partial seasons are excluded from
  complete-season comparisons. Estimates can predate a resort's opening.
- Pass filters use current catalog membership, including shared memberships.

Refresh current totals and continue the full historical backfill:

```sh
python3 scripts/fetch_resort_snowfall.py
```

The fetcher first refreshes current seasons for every resort, then fills older
seasons in ten-year chunks. Each successful request is saved atomically.
Completed seasons are reused; current season totals are replaced, never added
again. Resort archives with the shortest coverage receive priority. A failed
refresh retains prior data with an explicit error status; an HTTP 429 stops the
run. Rerunning resumes checkpoints. The site's history page displays backfill
and refresh status.

`--backfill-budget 1800` bounds estimated weighted API calls for older data per
run. The six-hour GitHub workflow spreads the 1940–present backfill across runs;
it becomes active when these changes are committed and pushed to the repository's
default branch with Actions enabled. Existing conditions and forecasts refresh
year-round to include southern resorts.

Useful bounded checks:

```sh
python3 scripts/fetch_resort_snowfall.py --resort 'Vail' --backfill-budget 0
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/snowfall.test.mjs
```

Source and attribution: [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api),
[ECMWF ERA5](https://doi.org/10.24381/cds.adbb2d47), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The application sums daily snowfall and converts its units. The Mountain
Collective 2026/27 roster is from its [official resort list](https://mountaincollective.com/resorts/).

# Painted 3D mountains

The production viewer is `mountain.html?resort=<name-slug>`. Resort Conditions
and Trail Map panels link to it. It uses the same Cesium browser token and
catalog as the main site, without introducing a JavaScript build step.

All catalog resorts can display painted Cesium World Terrain. The winter
appearance is illustrative, not winter satellite imagery, observed snow cover,
or current trail status. Terrain is exaggerated 1.5×. Painted trees illustrate
forested imagery cells; they are not surveyed individual trees.

All 105 catalog resorts have local trail and lift snapshots. The 104 added
resorts use OpenSkiData's explicit ski-area associations, resolved against
reviewed upstream OSM/Skimap.org identifiers in `scripts/trail-resorts.json`.
Nearby geometry is never assigned by proximity. Group destinations combine
their constituent areas and deduplicate shared segments. The mountain-area
selector flies into individual mountains and child areas of larger domains.
Connected areas that the source groups together retain their source area names
in Data & coverage (for example Tignes–Val d'Isère).

Whistler retains the approved original snapshot: 736 downhill trail segments
and 37 lift segments. All counts refer to geometry segments, not unique named
runs. Community mapping may be incomplete. The viewer exposes source dates,
mapped area names, segment counts, a GeoJSON download, and attribution.
Trail colors follow the source's North American, European or Japanese grading
convention. Gray is ungraded; orange is freeride/extreme. Source `operating`
status describes mapped infrastructure, never daily opening status.

## Files and publishing

- `js/mountain-page.js`: accessible controls, loading/error states, navigation.
- `js/mountain-config.js`: resort links, camera settings, explicit trail coverage.
- `js/trail-catalog.js`: generated coverage, area cameras and source metadata.
- `js/trail-style.js`: regional difficulty colors and legends.
- `js/painted-mountain.js`: terrain, camera interaction, mapped routes and labels.
- `js/painted-material.js`: painted imagery and geographic snow clearings.
- `data/trails/*.geojson`: one compact snapshot per resort, with provenance.
- `assets/gouache-grain.png`, `assets/painted-conifer.png`: generated supporting
  assets from the approved third mockup.
- `assets/mountain-icons/`: SVG assets rendered from Lucide React 0.468.0,
  licensed under ISC (see `assets/mountain-icons/LICENSE`).

Push `main` to deploy through the existing GitHub Pages workflow. The explicit
allowlist in `scripts/package_site.py` includes these assets while continuing
to exclude `output/`, local configuration, logs, and development dependencies.
All asset URLs work under the GitHub Pages `/snow-scout/` path.

Run `python3 -m unittest discover -s tests -p 'test_*.py'` and
`node --test tests/*.test.mjs`, then package into a new directory with
`python3 scripts/package_site.py --output /tmp/snow-scout-site-<unique-name>`.
Serve the package for browser verification before publishing.

## Source and rendering contracts

OpenSkiData's supported bulk downloads are linked at https://www.openskidata.org/:
`https://tiles.openskimap.org/metadata.json` and
`https://tiles.openskimap.org/geojson/{ski_areas,runs,lifts}.geojson`.
Automated downloading is permitted at most once per day. The source is hosted
locally as compact subsets; the viewer does not use their vector tile service.
Full upstream downloads (~1 GB uncompressed) stay outside the repository and
the Pages artifact. The first extraction used schema 16.0.0 and the 2026-10-19
OSM snapshot, built 2026-10-20 at 01:25 UTC.

Refresh using an explicit cache directory:

```sh
python3 scripts/import_resort_trails.py --source-dir /tmp/snow-scout-trail-source --download
```

To rerun extraction from the same snapshot, omit `--download`. The cache records
daily download attempts; failed downloads are raised and not retried that day.
The importer checks schema version, file sizes, feature counts, reviewed area
identities and nonempty trail/lift coverage before replacing published subsets.
If the upstream area identifiers or names change, review the mapping explicitly.
Do not substitute another resort or a distance-based match. No new refresh
schedule is installed; committed snapshots deploy through the usual Pages job.

OpenSkiData is ODbL. Its attribution credits OpenSkiMap.org, OpenStreetMap
contributors, Skimap.org, Who's On First and Mapterhorn. Each subset retains
upstream feature sources and ski-area memberships; modified data is available
through the viewer's download link under the same license.

The original Whistler routes were fetched from `https://overpass-api.de/api/interpreter`, querying
downhill piste ways and aerialways within `(49.99,-123.01,50.16,-122.83)` and
requesting `out tags geom`. Closed piste-area outlines are excluded. Use a
descriptive User-Agent for Overpass requests. The original OpenSkiMap feature
API returned HTTP 403; use the supported bulk download links for other resorts.
Data © OpenStreetMap contributors, licensed under ODbL:
https://www.openstreetmap.org/copyright . Cesium/provider credits remain visible.

Cesium 1.138 Fabric clones image uniforms: use a PNG data URL for the trail mask,
not an HTMLCanvasElement. Use WGS84 geodetic latitude to align the geographic
mask. Paper-backed trail labels use sampled terrain heights and fixed world
positions; ground clamping split the glyphs and backgrounds apart. GLSL reserves
`input`, so the material argument is `materialInput`.

The original local Vite prototype remains in `output/painted-trail-map` for
design reference; production runs the promoted static modules above. Design
comparisons and browser evidence are under its `qa/release/` folder.

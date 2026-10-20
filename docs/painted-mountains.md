# Painted 3D mountains

The production viewer is `mountain.html?resort=<name-slug>`. Resort Conditions
and Trail Map panels link to it. It uses the same Cesium browser token and
catalog as the main site, without introducing a JavaScript build step.

All catalog resorts can display painted Cesium World Terrain. The winter
appearance is illustrative, not winter satellite imagery, observed snow cover,
or current trail status. Terrain is exaggerated 1.5×. Painted trees illustrate
forested imagery cells; they are not surveyed individual trees.

Whistler Blackcomb additionally has an OpenStreetMap snapshot containing 736
downhill trail segments and 37 lift segments. These are geometry segments, not
unique runs. Community mapping may be incomplete. Other resorts explicitly
show that trails and lifts are unavailable; they never reuse Whistler's routes
or a nearby resort's proxy geometry.

## Files and publishing

- `js/mountain-page.js`: accessible controls, loading/error states, navigation.
- `js/mountain-config.js`: resort links, camera settings, explicit trail coverage.
- `js/painted-mountain.js`: terrain, camera interaction, mapped routes and labels.
- `js/painted-material.js`: painted imagery and geographic snow clearings.
- `data/trails/whistler.geojson`: source, license and snapshot timestamp in file.
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

OSM routes were fetched from `https://overpass-api.de/api/interpreter`, querying
downhill piste ways and aerialways within `(49.99,-123.01,50.16,-122.83)` and
requesting `out tags geom`. Closed piste-area outlines are excluded. Use a
descriptive User-Agent for Overpass requests. The original OpenSkiMap feature
API returned HTTP 403; the production renderer uses the saved OSM snapshot.
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

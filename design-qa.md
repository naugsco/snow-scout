# Snow Scout heatmap design QA

Date: 2026-10-21

**Visual truth**
- Selected reference: `/Users/nnaugle/.codex/generated_images/01a156eb-8ead-7e23-b06b-8a720e085f64/exec-7d12eee0-f9bf-4b61-b241-12aa8f6bfd4e.png`.
- Implementation: `http://127.0.0.1:4173/`.
- Desktop screenshot: `output/heatmap-qa/desktop-final.png`.
- Full comparison: `output/heatmap-qa/comparison-final.png`.
- Focused control comparison: `output/heatmap-qa/comparison-controls-final.png`.
- Mobile evidence: `output/heatmap-qa/mobile.png`, `output/heatmap-qa/mobile-map.png`.
- Weather evidence: `output/heatmap-qa/globe-radar.png`, `globe-clouds.png`, `globe-precipitation.png`, `globe-temp.png` in the same directory.

**Comparison setup**
The reference and desktop capture are both 1513 × 1040 pixels. The browser CSS viewport was set to 1513 × 1040; its screenshot API returned the same pixel size, so no density rescaling was used. The combined comparison places the two originals side by side. The control comparison stacks equal-size 1513 × 270 crops. The preview was also inspected at full resolution. The selected metric is Biggest forecast, metric units, dark theme, with one resort preview revealed. The real-data resort names, amounts, proportions, and hovered resort differ from the illustrative reference. Mobile was tested at 390 × 844 CSS pixels with full-page and viewport captures.

**Fidelity review**
- Typography: Inter for controls and body, Barlow Condensed for the existing brand and centered resort names/values. Heading hierarchy, condensed uppercase resort labels, centered metrics, and readable supporting labels follow the reference.
- Layout: slim brand/navigation header, title plus search/pass/region controls, six equally weighted metric buttons, near-full-width row treemap, floating animated preview, and blue/white/orange legend. Four-pixel gutters and small tile radii preserve the stock-heatmap appearance. Low-value tiles have minimum areas so labels remain readable.
- Colors: dark navy background and restrained blue active-control borders; #2589ef for the highest selected metric, #f1f4f7 midpoint, #f39a50 lowest. Unknown data has a separate gray surface. Equal known values use the neutral midpoint. Resort values and accessible labels also communicate the metric independently of color.
- Assets: local, licensed Lucide SVG files provide the line icons. The existing brand treatment is retained. No emoji or raster placeholder substitutes were added to the heatmap. No photographic assets are required by this reference.
- Content: the six requested metrics, selected periods, names and selected numerical values match the product framing. Real values replace the mock data. Current-season totals are explicitly ERA5 estimates. Missing open-run reports are not ranked as fabricated counts. Forecast detail loads on preview; updated values do not move tiles while the preview is being read.

**Intentional product differences**
- Airport preference is editable and saved locally. Airfare says “Flight prices coming soon,” as the user requested; the illustrative C$348 was not implemented as a real offer.
- Map view opens the existing globe, hidden initially. The map rendering loop pauses while closed. Radar is enabled on first open; user choices are preserved on subsequent opens.
- Existing history, theme, unit and comparison functions remain available. A nonfunctional account icon was not added.
- “Rising”/“Steady” movements were not fabricated without historical metric comparisons. Source labels are used instead.
- The first 20 ranked resorts are shown for legibility, with an explicit count and working Show all 105 control. Search and all pass/region filters still cover the full catalog; globe pins cover the complete filtered set.

**Comparison and correction history**
1. Initial desktop capture: P2 low-value rows clipped names because their available heights were smaller than the stacked content. Increased minimum tile weight, used compact type sizes, suppressed supplemental source captions on compact tiles, and prevented primary labels from flex-shrinking. Desktop and mobile DOM-bound checks then found no overflowing tile labels.
2. Globe inspection: P2 the old weather toggle overlapped the panel heading, and the existing light-colored close SVG was incorrectly inverted. Reset the toggle's inherited top/left anchors and normalized icon filters. Subsequent map captures show separate controls and visible close icons.
3. Browser console audit: P1 a zero-width transitional canvas produced an empty layout during resizing. The ResizeObserver now waits for a connected, non-zero-width canvas. Repeated desktop/mobile navigation, filtering and map checks produced no further application errors.
4. Interaction audit: P1 pending pointer timers and replacement of preview buttons during asynchronous forecast loading could change the action target. Preview entry/focus now cancels timers; forecast refresh changes only data elements, preserving action buttons and focus. Retested named Compare actions for Paradiski and St. Moritz: both correct chips appeared, Compare enabled, and the two-resort comparison opened successfully.
5. Final full-view and focused comparisons: no actionable P0/P1/P2 visual or interaction findings remain. The minor type/spacing differences and absent tooltip callout notch are P3 polish; the selected outline and panel position communicate the hover association.

**Verification**
- All six metric selectors change the ranking, values, units and descriptive copy.
- Region and pass filters compose; Japan + Epic shows Rusutsu and Hakuba Valley. Search, zero-result state, favorites, and Show all 105 were tested.
- Airport preference and units survive reload. Both themes render without horizontal overflow.
- Preview, daily forecast refresh, save, comparison, full resort popup and forecast tab were exercised. Mobile taps open the existing resort details within the viewport.
- Radar is active by default on opening the globe. Its first/last timeline frames and playback controls work. Cloud, precipitation and temperature overlays were enabled independently and their actual imagery was visually inspected after loading. Provider manifest/tile requests also returned HTTP 200 image responses.
- Mobile map fills the viewport and can close back to the heatmap. The desktop map preserves the globe and resort markers.
- Node tests: 13 passed. Python unittest suite: 13 passed, including packaging the updated homepage and all relative public dependencies. JavaScript syntax and git whitespace checks passed.
- Console audit found no new application or weather-layer errors after fixes. The existing conditions snapshot reports 17 failed resort feeds and older timestamps; these are shown rather than concealed. Repairing those upstream resort adapters is outside this layout change.
- OpenWeather cloud/precipitation/temperature verification used the existing local config. That config remains excluded from the public package; no API key was committed or placed in QA artifacts.

**Implementation checklist**
- [x] Reference-based heatmap and responsive controls.
- [x] Metric ranking, palette, missing-data treatment and all-resort access.
- [x] Stable preview actions and existing details/comparison integration.
- [x] Hidden globe, default radar and verified additional layers.
- [x] Automated tests, browser checks, and visual evidence.

final result: passed

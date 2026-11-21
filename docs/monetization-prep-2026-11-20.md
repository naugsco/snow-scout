# Monetization prep — licenses and affiliate applications

Prepared 2026-11-20. Facts below were read from the providers' own pages that day;
anything not confirmed is marked **unverified**.

## 1. Data licenses (do these before any affiliate link earns money)

### Open-Meteo — needs a paid plan

- The free API is non-commercial only. The terms list "websites or apps that have
  subscriptions or display advertisements" and "commercial products or promotional
  activities" as commercial. Affiliate links are not named, but earning commission
  almost certainly counts. Ask info@open-meteo.com if you want it in writing.
- Plans (open-meteo.com/en/pricing, monthly billing):
  - **API Standard — €29/month**, 1M calls/month, forecast API. **Does not include the
    Historical Weather (ERA5) API.**
  - **API Professional — €99/month**, 5M calls/month, includes Historical Weather.
  - Yearly billing is offered; price not recorded.
- What Snow Scout uses today:
  - Forecast API — scheduled jobs (`scripts/fetch_resort_forecasts.mjs`,
    `fetch_resort_conditions.mjs`) **and the visitor's browser** (`js/current-snow.js`,
    current snowfall on the dashboard).
  - Historical/ERA5 archive API — `scripts/fetch_resort_snowfall.py`, every 6 hours,
    for season snowfall totals. This alone forces the €99 plan.
- Two technical changes a paid plan requires:
  1. Paid plans use an API key on `customer-api.open-meteo.com`. The key must not ship
     to browsers, so `js/current-snow.js` has to go through the Cloudflare worker (or
     read the scheduled snapshot) instead of calling Open-Meteo directly.
  2. Scheduled jobs read the key from a GitHub Actions secret.
- **Option to stay on €29:** completed seasons are already stored and never change.
  Only the current season needs fresh data. The Standard forecast API returns recent
  past days (`past_days`), so the current season could be accumulated day by day
  from the forecast API instead of the archive. Different model from ERA5, so
  current-season totals would not be strictly comparable with past seasons.
  Decision needed.
- Attribution: data is CC BY 4.0; the existing Open-Meteo credit stays.

### RainViewer — not licensed for commercial use

- Its API page says the free API is for "personal and educational use only".
  Commercial use is by separate agreement (contact RainViewer).
- Choice: contact RainViewer for terms, drop the radar layer before monetizing, or
  replace it. Snow Scout uses it for the radar overlay on the 3D map
  (`js/weather-layers.js`, fetched straight from api.rainviewer.com in the browser).

### Cesium ion

- Token works from snowscout.ski. It is unrestricted, so any site can spend your quota.
  Restrict it to `snowscout.ski` and `www.snowscout.ski` in the Cesium ion dashboard.
- **Unverified:** whether Cesium ion's free (Community) tier allows commercial use.
  Check the ion pricing page before monetizing.

## 2. Affiliate applications

You create these accounts yourself; nothing here has been submitted.

### Booking.com (lodging links)

- Entry point: booking.com/affiliate-program/v2/index.html → Register → choose region.
  For the US the page routes registration through **CJ (Commission Junction)**; other
  regions use other networks (e.g. Awin).
- Commission: **unverified** — an Awin listing says 4% on accommodation; confirm in
  the network's program terms.
- After approval: replace the plain Booking.com search links in
  `js/travel-guides.js` with the network's tracked links. The click counter keeps
  working because it matches on the booking.com domain.

### KAYAK (flight links)

- Apply at **affiliates.kayak.com** → "Apply to join" (or email partnerships@kayak.com).
- Form fields: full name, business email, company name, website link, "Tell us about
  your project", sandbox API access (yes/no), privacy/terms checkbox.
- Payout: "clicks, bookings and ad revenue" with "revenue share"; no rates published.
  No traffic minimum is stated. Approval is manual.
- Link products: Deeplinks (pre-filled results pages — what Snow Scout already builds),
  Whitelabel, search boxes, API.

### Draft answers (edit before pasting)

**Website:** https://snowscout.ski

**Company name:** Snow Scout (sole proprietor — use your legal name if there is no
business entity)

**Tell us about your project:**

> Snow Scout is a free ski-resort snow forecast site covering 105 resorts across
> North America, Europe, Japan and the Southern Hemisphere. Each resort has a
> 7-day snowfall forecast, recent snowfall, season snowfall history and a trip
> planner. When a skier picks a resort with fresh snow coming, the trip planner
> builds a flight search from their home airport to the resort's nearest airports
> for their travel dates, and lists lodging areas near the lifts. We'd like to use
> deeplinks to send those ready-made searches to KAYAK [or: lodging searches to
> Booking.com]. Traffic is organic: search engines (crawlable resort pages and a
> submitted sitemap) and returning skiers. We don't use paid traffic, pop-ups or
> incentivized clicks.

**Traffic:** Snow Scout moved to snowscout.ski on 2026-11-20 and analytics started
that day, so there is no traffic history yet. Say so plainly; don't estimate.
Applying after 2–4 weeks of Cloudflare Web Analytics data gives the application
real numbers.

## 3. Site changes needed before tracked links go live

- **Affiliate disclosure** near the travel links and in the footer (the FTC requires
  it in the US; networks check for it). Draft:
  > Snow Scout may earn a commission when you book through some travel links. It
  > doesn't change the price you pay or which resorts we show.
- **Privacy page.** Networks usually ask for one. State that Cloudflare Web Analytics
  counts page views without cookies, the click counter stores daily counts by partner
  and resort only, and partner sites set their own cookies once you leave Snow Scout.
- **Terms/contact page** with a contact email (networks and KAYAK ask for a business
  email).

## Suggested order

1. Decide Open-Meteo plan (€99 Professional, or €29 + change how current-season
   totals are built). Subscribe, then move browser calls behind the worker.
2. Resolve RainViewer (contact, drop, or replace) and restrict the Cesium token.
3. Add the disclosure, privacy and contact pages.
4. Apply to KAYAK and Booking.com (via CJ) once ~2–4 weeks of traffic exist.
5. Swap in tracked links; compare click counts with network reports.

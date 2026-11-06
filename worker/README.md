# Snow Scout weather backend

Production: https://snow-scout-weather.nick-naugle.workers.dev

This is a dedicated Cloudflare Worker on Nick's existing account. It leaves the GitHub Pages frontend in place. All weather requests use one SQLite-backed Durable Object named `openweather-account-v1`, which persists the account's rolling reservations and circuit-breaker state before upstream calls. Storage errors fail closed. A single object serializes state changes across all Worker instances/tabs/visitors; code restarts retain quota and cooldown state. Successful tile bytes are not persisted. The Worker is configured for the existing Free plan; no subscription upgrade was made.

## Public routes

- GET `/health`: backend health/version, no upstream calls.
- GET `/api/weather/status`: enabled/paused status, retry time and quota policy, no upstream calls.
- GET `/api/weather/tiles/{layer}/{z}/{x}/{y}.png`: controlled tile path, requires the frontend Origin; returns 503 while paused.
- CORS allows only `https://naugsco.github.io`. Arbitrary paths, origins, methods and tile coordinates are rejected. Origin is an integration boundary, not user authentication; the durable quota remains the upstream safety control.

## Deployment

Wrangler 4.132.0 used locally. From this repository run `node /Users/nnaugle/Sites/nicknaugle/node_modules/wrangler/bin/wrangler.js deploy --config worker/wrangler.jsonc` on Nick's Mac, or `npx wrangler deploy --config worker/wrangler.jsonc` with an authenticated installation elsewhere. The configuration includes a one-time SQLite Durable Object migration. No custom domain is required.

The committed `js/weather-config.js` contains only the public gateway URL. Local previews override it with their local gateway URL. GitHub Pages deployment remains its existing push-to-main workflow.

## Credentials and activation

OPENWEATHER_ENABLED remains the string `false` in Wrangler vars. On Nov 6, Nick explicitly approved transferring the existing local OpenWeather credential to Cloudflare. OPENWEATHER_API_KEY was uploaded to the private Worker secret store and its presence verified by name only. Live status still reports enabled=false; no provider request was made.

For future credential updates, supply OPENWEATHER_API_KEY through Cloudflare's private Worker secret store. Never place it in Wrangler vars, frontend files, GitHub or logs. Keep OPENWEATHER_ENABLED=false until the provider account is restored. When ready, explicitly change it to true and deploy. Do not probe the blocked key to see whether it works.

Authentication failures persist across restarts. After fixing rejected credentials, change OPENWEATHER_CIRCUIT_RESET_ID to a new operator-controlled value and deploy. This clears the permanent auth flag but preserves request reservations and any longer quota cooldown; a one-minute warmup applies. Do not change the durable account object's name to clear a limit.

## Verification

Live `/health` and `/api/weather/status` verified; status reports enabled=false and persistentQuota=true. Automated tests exercise persistence across new gateway instances, failed storage, allowed/denied origins, worker routing, budget and provider errors using mocks. No successful real-key tile request is claimed while the service is intentionally paused.

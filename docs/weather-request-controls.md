# OpenWeather request controls

Implemented Nov 6, 2026. This supersedes the uncontrolled direct-tile path described in the incident audit.

## Request path and limits

Browser overlays now use only a configured weather gateway. `js/weather-config.js` defaults to `apiBase: null` in the static artifact, so Pages makes no OpenWeather tile requests. No browser module reads the old `data/config.json` key or includes an appid parameter. Local `server/travel-server.mjs` supplies `/api/weather` as the public gateway path; the key stays in its server environment.

`server/weather-tiles.mjs` owns a rolling 60-second budget of at most 45 upstream attempts across all supported layers and clients served by that gateway instance. Failed attempts count. Concurrent identical tile requests share one promise. Coordinates/layers are allowlisted and restricted to zoom 0–6. Every upstream call uses an 8-second timeout and refuses redirects. Errors do not expose upstream URLs, response bodies or keys.

The service starts paused unless both `OPENWEATHER_ENABLED=true` and `OPENWEATHER_API_KEY` are set. An explicitly enabled process waits 60 seconds after startup before sending requests, draining the preceding process's rate window. HTTP 429 pauses all upstream layers for at least 15 minutes and honors longer Retry-After values. HTTP 401/403 holds the circuit open until service reconfiguration/restart. Connection, response/body and other provider errors cause at least a one-minute pause. There are no automatic upstream retries. Successful responses are not persisted or given new caching freshness; a permitted caching policy is still to be agreed with the provider.

A Cesium tile error disables retry and removes every OpenWeather layer in the current document, including other map viewers sharing the gateway. Those viewers stop requesting images until page reload. Radar remains independent. The gateway enforces the budget across separate tabs even though browser pause state is document-scoped.

## Deployment boundary

The bundled gateway is still loopback-only for local development. Do not remove those safeguards or expose it publicly without the production backend rollout. Use exactly one gateway process per key. Multiple independent processes, other apps using the key, or old browser tabs still running old direct-tile code are outside this limiter. A multi-instance deployment must use a central atomic limiter/circuit store. A restart cannot guarantee preservation of long provider cooldowns across processes; leave the service explicitly disabled during an account suspension and until the provider confirms restoration.

The public static site cannot enable these overlays without a deployed controlled backend. Production hosting/origin controls, persistent global circuit state and caching license review remain required before enabling shared public access. No service was deployed and no account subscription was changed.

## Safe local operation

The preview is running on port 4176 with OpenWeather paused. Clicking Clouds, Precip or Temp reports that state without contacting OpenWeather. Existing Open-Meteo forecasts and RainViewer radar have separate request paths.

Close/reload old maps and tabs, especially generic static previews, so their previously loaded JavaScript cannot continue direct calls. This change cannot unblock a suspended provider account by itself.

Only after the account is restored, use the existing git-ignored `.env.travel` (permission 600) and privately set OPENWEATHER_API_KEY plus OPENWEATHER_ENABLED=true. Do not copy a real key into example files, public config or chat. Stop any generic static server serving the repository root before creating a secret file. Run the existing Node env-file preview command, wait the one-minute warmup, then explicitly reopen a weather layer. For production, use the backend host's secret store. The former local JSON key is ignored by this implementation.

## Verification

77 Node tests and 13 Python tests passed. Tests cover a 55-request burst admitting only 45 upstream calls, 60-second rolling recovery, cross-layer in-flight deduplication, default pause/startup delay, long Retry-After, auth rejection, malformed responses, connection errors, invalid coordinates, secret redaction, shared-viewer shutdown without disabling radar, static no-direct-access behavior, and actual localhost HTTP routes. All OpenWeather responses were mocked: no blocked-key probe was made.

Browser: opening the globe and selecting Clouds showed the paused-service message; Radar remained selected/available. Screenshot: output/travel-build-qa/weather-paused.png. No real-key success path was exercised during the block. Syntax, packaging and diff checks passed.

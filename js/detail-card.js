// Shared resort card markup, mounted before its renderers initialize.
document.body.insertAdjacentHTML('beforeend', `  <!-- Detail panel overlay -->
  <div id="detail-overlay" class="detail-overlay" style="display:none">
    <div id="detail-panel" class="detail-panel glass">
      <div class="detail-head">
        <div class="detail-copy">
          <div class="detail-title"><h2 id="detail-name">Select a resort</h2><span id="detail-pass"></span></div>
        </div>
        <div class="detail-actions">
          <button id="detail-favorite" class="panel-action" title="Favorite">&#x2606;</button>
          <button id="detail-close" class="panel-action" title="Close">&times;</button>
        </div>
      </div>

      <div id="detail-meta" class="detail-meta"></div>
      <a id="detail-mountain" class="detail-mountain-link" href="mountain.html">
        <img src="assets/mountain-icons/mountain-snow.svg" width="19" height="19" alt="" />
        Explore 3D Mtn
      </a>

      <div class="detail-tabs">
        <button class="tab-btn active" data-tab="overview">Conditions</button>
        <button class="tab-btn" data-tab="forecast">Forecast</button>
        <button class="tab-btn" data-tab="trail-map">Trail Map</button>
        <button class="tab-btn" data-tab="webcams">Webcams</button>
        <button class="tab-btn" data-tab="travel">Plan trip</button>
      </div>

      <div class="detail-sections">
      <section id="tab-travel" class="tab-panel"><h3>Plan trip</h3><div id="travel-panel"></div></section>
      <section id="tab-overview" class="tab-panel active"><h3>Conditions</h3><p id="conditions-location" class="measurement-location"></p><details class="preservation-info"><summary>Recent snow preservation · Experimental</summary><p id="detail-preservation" class="detail-note"></p></details>
        <div id="detail-visual-grid" class="detail-visual-grid"></div>
        <div id="detail-snow-bars" class="detail-snow-bars"></div>
        <div id="detail-forecast-bars" class="detail-snow-bars"></div>
        <div id="detail-base-depth" class="detail-base-depth"></div>
        <div class="detail-section-head">
          <h3>&#x26F7; Terrain</h3>
          <span id="run-open-copy">-</span>
        </div>
        <div class="progress-track">
          <div id="run-open-bar" class="progress-bar" style="width: 0%"></div>
        </div>
        <div id="detail-terrain-stats" class="detail-terrain-stats"></div>
        <div id="conditions-actions" class="detail-source-actions"></div>
        <div class="detail-note" id="detail-note"></div>
      </section>

      <section id="tab-forecast" class="tab-panel"><h3>Snowfall forecast</h3><p id="forecast-horizon" class="measurement-location"></p><p id="forecast-location" class="measurement-location"></p>
        <div id="forecast-chart" class="forecast-chart"></div>
        <section id="forecast-day-details" class="forecast-day-details" aria-live="polite" aria-atomic="true"></section>
        <details class="forecast-about"><summary>About this forecast</summary><div id="forecast-actions" class="detail-source-actions"></div></details>
      </section>

      <section id="tab-trail-map" class="tab-panel">
        <div class="detail-section-head">
          <h3>&#x1F5FA; Trail Map</h3>
          <span id="trail-map-copy">Runs and lifts via OpenSkiMap</span>
        </div>
        <div class="trail-map-shell">
          <iframe
            id="trail-map-frame"
            class="trail-map-frame"
            title="OpenSkiMap trail map"
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        </div>
        <div id="trail-map-actions" class="detail-source-actions"></div>
        <div id="trail-map-note" class="detail-note"></div>
      </section>

      <section id="tab-webcams" class="tab-panel">
        <div class="detail-section-head">
          <h3>&#x1F4F7; Cameras</h3>
          <span id="webcam-count">0 feeds</span>
        </div>
        <div id="webcam-list" class="webcam-list"></div>
      </section>
      </div>
    </div>
  </div>

`);

import { DEG2RAD, CESIUM_ION_TOKEN, BILLBOARD_HEIGHT, HOVER_MARKER_HEIGHT, SELECTED_MARKER_HEIGHT } from './constants.js?v=20261020-painted-mountains';
import { state } from './state.js?v=20261020-painted-mountains';
import { clamp, getPassTone, inferStatus, getStatusText, normalizeResortName, getSourceKeyForResort } from './utils.js?v=20261020-painted-mountains';
import { resorts } from './resorts.js?v=20261020-painted-mountains';

Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

export const viewer = new Cesium.Viewer('cesium-container', {
  terrain: Cesium.Terrain.fromWorldTerrain({
    requestVertexNormals: true
  }),
  animation: false,
  timeline: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  selectionIndicator: false,
  baseLayerPicker: false,
  shouldAnimate: false
});

viewer.scene.globe.depthTestAgainstTerrain = false;
viewer.scene.globe.maximumScreenSpaceError = 1.15;
viewer.scene.skyAtmosphere.hueShift = -0.03;
viewer.scene.skyAtmosphere.saturationShift = -0.12;
viewer.scene.skyAtmosphere.brightnessShift = -0.08;
viewer.scene.fxaa = true;
viewer.scene.postProcessStages.fxaa.enabled = true;
viewer.resolutionScale = Math.min(devicePixelRatio, 2);
viewer.scene.screenSpaceCameraController.inertiaSpin = 0.78;
viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.82;
viewer.scene.screenSpaceCameraController.inertiaZoom = 0.72;
viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2200;
viewer.scene.screenSpaceCameraController.maximumZoomDistance = 22000000;
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
viewer.scene.requestRenderMode = false;
viewer.scene.canvas.style.cursor = 'grab';

export const markerEntities = [];
export const markerById = new Map();
const resortViewContexts = new Map();
const resortViewContextPromises = new Map();
export const screenSpaceHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
export let autoRotate = true;

export function setAutoRotate(value) { autoRotate = value; }

const DEFAULT_LABEL_DISTANCE = new Cesium.DistanceDisplayCondition(0, 2200000);
const SELECTED_LABEL_DISTANCE = new Cesium.DistanceDisplayCondition(0, 22000000);

function buildLabelTheme({
  font,
  fill,
  outline,
  outlineWidth,
  background,
  padding = [7, 5]
}) {
  return {
    font,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    fillColor: Cesium.Color.fromCssColorString(fill),
    outlineColor: Cesium.Color.fromCssColorString(outline),
    outlineWidth,
    backgroundColor: Cesium.Color.fromCssColorString(background),
    backgroundPadding: new Cesium.Cartesian2(padding[0], padding[1])
  };
}

function createMarkerTexture(innerColor, glowColor, options = {}) {
  const size = 96;
  const {
    ringColor = 'rgba(255,255,255,0.86)',
    coreColor = 'rgba(255,255,255,0.98)',
    outerGlowColor = 'rgba(255,255,255,0.04)',
    innerRadius = 12,
    ringRadius = 13,
    coreRadius = 7,
    glowStartRadius = 8,
    glowRadius = 36,
    ringWidth = 5,
    outerStrokeColor = null,
    outerStrokeWidth = 0
  } = options;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size / 2, size / 2, glowStartRadius, size / 2, size / 2, glowRadius);
  glow.addColorStop(0, innerColor);
  glow.addColorStop(0.28, innerColor);
  glow.addColorStop(0.52, glowColor);
  glow.addColorStop(0.82, outerGlowColor);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = innerColor;
  ctx.arc(size / 2, size / 2, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  if (outerStrokeColor && outerStrokeWidth > 0) {
    ctx.beginPath();
    ctx.lineWidth = outerStrokeWidth;
    ctx.strokeStyle = outerStrokeColor;
    ctx.arc(size / 2, size / 2, ringRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.lineWidth = ringWidth;
  ctx.strokeStyle = ringColor;
  ctx.arc(size / 2, size / 2, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = coreColor;
  ctx.arc(size / 2, size / 2, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function createMarkerTextureSet(markerConfig) {
  return Object.fromEntries(
    Object.entries(markerConfig.passBase).map(([passTone, innerColor]) => [
      passTone,
      Object.fromEntries(
        Object.entries(markerConfig.statusGlow).map(([status, glowColor]) => [
          status,
          createMarkerTexture(innerColor, glowColor, markerConfig.textureOptions)
        ])
      )
    ])
  );
}

const globeAppearance = {
  atmosphere: { hueShift: -0.03, saturationShift: -0.12, brightnessShift: -0.08 },
  fog: { enabled: true, density: 0.0002, minimumBrightness: 0.06 },
  imagery: { brightness: 1, contrast: 1, saturation: 1, gamma: 1, hue: 0 },
  backgroundColor: '#040810',
  labelTheme: buildLabelTheme({
    font: '600 12px "Avenir Next", "Segoe UI", sans-serif',
    fill: '#f4f8ff',
    outline: 'rgba(7, 16, 30, 0.94)',
    outlineWidth: 3,
    background: 'rgba(7, 16, 30, 0.72)'
  }),
  markerConfig: {
    passBase: {
      'mountain-collective': 'rgba(92,210,175,1)',
      epic: 'rgba(78,140,255,1)',
      ikon: 'rgba(249,199,79,1)',
      dual: 'rgba(182,179,255,1)'
    },
    statusGlow: {
      incoming: 'rgba(176,108,255,0.42)',
      fresh: 'rgba(101,217,255,0.42)',
      dry: 'rgba(255,159,87,0.38)',
      steady: 'rgba(126,199,184,0.36)'
    },
    textureOptions: {}
  }
};

const markerTextures = createMarkerTextureSet(globeAppearance.markerConfig);
Object.assign(viewer.scene.skyAtmosphere, globeAppearance.atmosphere);
viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(globeAppearance.backgroundColor);
if (viewer.scene.fog) Object.assign(viewer.scene.fog, globeAppearance.fog);
if (viewer.imageryLayers.length) Object.assign(viewer.imageryLayers.get(0), globeAppearance.imagery);

function markerHeightForResort(resort) {
  if (state.selectedId === resort.id) return SELECTED_MARKER_HEIGHT;
  if (state.hoveredId === resort.id) return HOVER_MARKER_HEIGHT;
  return BILLBOARD_HEIGHT;
}

function cartesianForResort(resort) {
  return new Cesium.CallbackProperty(() => (
    Cesium.Cartesian3.fromDegrees(resort.lon, resort.lat, markerHeightForResort(resort))
  ), false);
}

function cameraHeightToDetail(height) {
  const normalized = 20 - Math.log2(Math.max(height, 1) / 750);
  return Math.round(clamp(normalized, 2, 19));
}

export function updateZoomReadout() {
  const height = viewer.camera.positionCartographic?.height ?? 22000000;
  document.getElementById('zoom-readout').textContent = String(cameraHeightToDetail(height));
}

export function createMarkerEntity(resort) {
  const passTone = getPassTone(resort);
  const entity = viewer.entities.add({
    position: cartesianForResort(resort),
    billboard: {
      image: markerTextures[passTone][resort.status],
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      scale: 0.84,
      scaleByDistance: new Cesium.NearFarScalar(15000, 1.18, 12000000, 0.5)
    },
    label: {
      text: resort.name,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      font: globeAppearance.labelTheme.font,
      style: globeAppearance.labelTheme.style,
      fillColor: globeAppearance.labelTheme.fillColor,
      outlineColor: globeAppearance.labelTheme.outlineColor,
      outlineWidth: globeAppearance.labelTheme.outlineWidth,
      showBackground: true,
      backgroundColor: globeAppearance.labelTheme.backgroundColor,
      backgroundPadding: globeAppearance.labelTheme.backgroundPadding,
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(14, -34),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2200000),
      translucencyByDistance: new Cesium.NearFarScalar(150000, 1, 2200000, 0),
      show: false
    }
  });
  entity.snowscoutResortId = resort.id;
  markerEntities.push(entity);
  markerById.set(resort.id, entity);
}

export function updateMarkerVisibility(visibleIds) {
  markerEntities.forEach((entity) => {
    entity.show = visibleIds.has(entity.snowscoutResortId);
  });
  if (state.hoveredId && !visibleIds.has(state.hoveredId)) {
    state.hoveredId = null;
    document.getElementById('hover-card').style.display = 'none';
  }
}

export function updateMarkerStyles() {
  const cameraHeight = viewer.camera.positionCartographic?.height ?? 22000000;
  resorts.forEach((resort) => {
    const marker = markerById.get(resort.id);
    if (!marker) return;
    const passTone = getPassTone(resort);
    const isSelected = resort.id === state.selectedId;
    const isHovered = resort.id === state.hoveredId;
    marker.billboard.image = markerTextures[passTone][resort.status];
    const baseScale = isSelected ? 1.16 : isHovered ? 1.02 : 0.9;
    if (!isSelected && !isHovered && resort.status === 'incoming') {
      const pulse = 1 + Math.sin(Date.now() * 0.003 + resort.id.charCodeAt(0)) * 0.08;
      marker.billboard.scale = baseScale * pulse;
    } else {
      marker.billboard.scale = baseScale;
    }
    marker.label.show = Boolean(marker.show && (isSelected || isHovered || cameraHeight < 900000));
    marker.label.pixelOffset = new Cesium.Cartesian2(16, isSelected ? -54 : isHovered ? -42 : -34);
    marker.label.scale = isSelected ? 1.08 : isHovered ? 1 : 0.94;
    marker.label.font = globeAppearance.labelTheme.font;
    marker.label.style = globeAppearance.labelTheme.style;
    marker.label.fillColor = globeAppearance.labelTheme.fillColor;
    marker.label.outlineColor = globeAppearance.labelTheme.outlineColor;
    marker.label.outlineWidth = globeAppearance.labelTheme.outlineWidth;
    marker.label.backgroundColor = globeAppearance.labelTheme.backgroundColor;
    marker.label.backgroundPadding = globeAppearance.labelTheme.backgroundPadding;
    marker.label.distanceDisplayCondition = isSelected ? SELECTED_LABEL_DISTANCE : DEFAULT_LABEL_DISTANCE;
  });
  updateZoomReadout();
}

export function resortForScreenPosition(position) {
  const picked = viewer.scene.pick(position);
  const pickedId = picked?.id;
  if (!pickedId?.snowscoutResortId || !pickedId.show) return null;
  return resorts.find((item) => item.id === pickedId.snowscoutResortId) || null;
}

export function syncHoverCardToEntity() {
  if (!state.hoveredId) return;
  const resort = resorts.find((item) => item.id === state.hoveredId);
  const marker = markerById.get(state.hoveredId);
  if (!resort || !marker || !marker.show) {
    state.hoveredId = null;
    document.getElementById('hover-card').style.display = 'none';
    return;
  }
  const position = marker.position?.getValue(viewer.clock.currentTime);
  if (!position) return;
  const screen = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
  if (!screen) {
    document.getElementById('hover-card').style.display = 'none';
    return;
  }
  const hoverCard = document.getElementById('hover-card');
  document.getElementById('hover-name').textContent = resort.name;
  document.getElementById('hover-copy').textContent = resort.statusText;
  hoverCard.style.display = 'block';
  hoverCard.style.left = `${screen.x}px`;
  hoverCard.style.top = `${screen.y}px`;
}

function offsetLatLonByMeters(lat, lon, eastMeters, northMeters) {
  const latOffset = northMeters / 111320;
  const lonOffset = eastMeters / (111320 * Math.max(Math.cos(lat * DEG2RAD), 0.2));
  return { lat: lat + latOffset, lon: lon + lonOffset };
}

function bearingRadians(fromLat, fromLon, toLat, toLon) {
  const lat1 = fromLat * DEG2RAD;
  const lat2 = toLat * DEG2RAD;
  const dLon = (toLon - fromLon) * DEG2RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

function resortCartographic(resort) {
  return new Cesium.Cartographic(
    Cesium.Math.toRadians(resort.lon),
    Cesium.Math.toRadians(resort.lat),
    0
  );
}

async function resolveResortViewContext(resort) {
  if (resortViewContexts.has(resort.id)) return resortViewContexts.get(resort.id);
  if (resortViewContextPromises.has(resort.id)) return resortViewContextPromises.get(resort.id);

  const promise = (async () => {
    const center = { lat: resort.lat, lon: resort.lon, distance: 0 };
    const samplePoints = [center];
    const radii = [900, 1800, 3200];
    const bearings = [0, 45, 90, 135, 180, 225, 270, 315];

    radii.forEach((radius) => {
      bearings.forEach((bearingDeg) => {
        const bearing = bearingDeg * DEG2RAD;
        const point = offsetLatLonByMeters(
          resort.lat, resort.lon,
          Math.sin(bearing) * radius,
          Math.cos(bearing) * radius
        );
        samplePoints.push({ ...point, distance: radius });
      });
    });

    const sampled = await Cesium.sampleTerrainMostDetailed(
      viewer.terrainProvider,
      samplePoints.map((point) => new Cesium.Cartographic(
        Cesium.Math.toRadians(point.lon),
        Cesium.Math.toRadians(point.lat),
        0
      ))
    );

    const enriched = sampled.map((point, index) => ({
      lat: Cesium.Math.toDegrees(point.latitude),
      lon: Cesium.Math.toDegrees(point.longitude),
      height: Number.isFinite(point.height) ? point.height : 0,
      distance: samplePoints[index].distance
    }));

    const basePoint = enriched[0];
    const scored = enriched.map((point) => ({
      ...point,
      score: point.height - point.distance * 0.08
    }));
    const highest = scored.reduce((best, point) => (point.score > best.score ? point : best), scored[0]);
    const targetPoint = highest.height > basePoint.height + 120 ? highest : basePoint;
    const targetToBaseBearing = bearingRadians(targetPoint.lat, targetPoint.lon, resort.lat, resort.lon);
    const geodesic = new Cesium.EllipsoidGeodesic(
      new Cesium.Cartographic(Cesium.Math.toRadians(targetPoint.lon), Cesium.Math.toRadians(targetPoint.lat), 0),
      resortCartographic(resort)
    );
    const baseDistance = Number.isFinite(geodesic.surfaceDistance) ? geodesic.surfaceDistance : 0;

    const context = {
      baseHeight: basePoint.height,
      targetLat: targetPoint.lat,
      targetLon: targetPoint.lon,
      targetHeight: targetPoint.height,
      relief: Math.max(targetPoint.height - basePoint.height, 0),
      targetToBaseBearing,
      baseDistance
    };
    resortViewContexts.set(resort.id, context);
    return context;
  })().catch(() => {
    const fallback = {
      baseHeight: viewer.scene.globe.getHeight(resortCartographic(resort)) || 0,
      targetLat: resort.lat,
      targetLon: resort.lon,
      targetHeight: viewer.scene.globe.getHeight(resortCartographic(resort)) || 0,
      relief: 0,
      targetToBaseBearing: viewer.camera.heading,
      baseDistance: 0
    };
    resortViewContexts.set(resort.id, fallback);
    return fallback;
  }).finally(() => {
    resortViewContextPromises.delete(resort.id);
  });

  resortViewContextPromises.set(resort.id, promise);
  return promise;
}

export async function flyToResort(resort) {
  autoRotate = false;
  state.isFlying = true;
  const activeFlightId = Date.now();
  state.activeFlightId = activeFlightId;
  const current = viewer.camera.positionCartographic;
  const currentHeight = current?.height ?? 22000000;
  const context = await resolveResortViewContext(resort);
  if (state.activeFlightId !== activeFlightId) return;
  const targetHeight = Math.max(context.targetHeight, 0) + 120;
  const targetCartesian = Cesium.Cartesian3.fromDegrees(context.targetLon, context.targetLat, targetHeight);
  const geodesic = current
    ? new Cesium.EllipsoidGeodesic(
        new Cesium.Cartographic(current.longitude, current.latitude, 0),
        new Cesium.Cartographic(Cesium.Math.toRadians(context.targetLon), Cesium.Math.toRadians(context.targetLat), 0)
      )
    : null;
  const surfaceDistance = Number.isFinite(geodesic?.surfaceDistance) ? geodesic.surfaceDistance : 0;
  const isNearby = surfaceDistance < 350000;
  const isRegional = surfaceDistance < 1400000;
  const duration = clamp(isNearby ? 2.2 : surfaceDistance / 900000 + 2.6, 2.1, 5.4);
  const heading = context.baseDistance > 280 ? context.targetToBaseBearing : viewer.camera.heading;
  const pitch = Cesium.Math.toRadians(isNearby ? -24 : isRegional ? -29 : -34);
  const range = clamp(
    Math.max(context.baseDistance * 1.9, context.relief * 2.5, isNearby ? 4200 : isRegional ? 7000 : 11000),
    4200,
    isRegional ? 18000 : 26000
  );
  const flightOptions = {
    offset: new Cesium.HeadingPitchRange(heading, pitch, range),
    duration,
    easingFunction: Cesium.EasingFunction.QUADRATIC_OUT
  };
  if (!isNearby) {
    flightOptions.maximumHeight = clamp(
      Math.max(currentHeight * 0.92, surfaceDistance * (isRegional ? 0.45 : 0.85), range * 4),
      45000, 16000000
    );
  }
  flightOptions.complete = () => {
    if (state.activeFlightId !== activeFlightId) return;
    state.isFlying = false;
    updateMarkerStyles();
  };
  flightOptions.cancel = () => {
    if (state.activeFlightId !== activeFlightId) return;
    state.isFlying = false;
    updateMarkerStyles();
  };
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(targetCartesian, 160), flightOptions);
}

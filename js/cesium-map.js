import { DEG2RAD, CESIUM_ION_TOKEN, BILLBOARD_HEIGHT, HOVER_MARKER_HEIGHT, SELECTED_MARKER_HEIGHT } from './constants.js?v=20261019-snowfall';
import { state } from './state.js?v=20261019-snowfall';
import { clamp, getPassTone, inferStatus, getStatusText, normalizeResortName, getSourceKeyForResort } from './utils.js?v=20261019-snowfall';
import { resorts } from './resorts.js?v=20261019-snowfall';

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
export const GLOBE_STYLE_IDS = ['default', 'storybook', 'comic'];

export function setAutoRotate(value) { autoRotate = value; }

const DEFAULT_LABEL_DISTANCE = new Cesium.DistanceDisplayCondition(0, 2200000);
const SELECTED_LABEL_DISTANCE = new Cesium.DistanceDisplayCondition(0, 22000000);
const texelStepScratch = new Cesium.Cartesian2();

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

const GLOBE_STYLE_SHADER = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
uniform vec2 texelStep;
uniform float styleMode;
uniform float mixAmount;
uniform float saturation;
uniform float contrast;
uniform float warmth;
uniform float coolness;
uniform float haze;
uniform float grain;
uniform float vignette;
uniform float bandCount;
uniform float edgeStrength;
uniform float halftoneAmount;
uniform float halftoneScale;

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

vec3 applySaturation(vec3 color, float amount) {
  float gray = luminance(color);
  return mix(vec3(gray), color, amount);
}

vec3 applyContrast(vec3 color, float amount) {
  return clamp((color - 0.5) * amount + 0.5, 0.0, 1.0);
}

float hash(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

float edgeSample(vec2 uv) {
  vec3 center = texture(colorTexture, uv).rgb;
  vec3 north = texture(colorTexture, uv + vec2(0.0, texelStep.y)).rgb;
  vec3 south = texture(colorTexture, uv - vec2(0.0, texelStep.y)).rgb;
  vec3 east = texture(colorTexture, uv + vec2(texelStep.x, 0.0)).rgb;
  vec3 west = texture(colorTexture, uv - vec2(texelStep.x, 0.0)).rgb;
  float diff = length(center - north) + length(center - south) + length(center - east) + length(center - west);
  return clamp(diff * 1.8, 0.0, 1.0);
}

float vignetteMask(vec2 uv) {
  vec2 centered = uv - 0.5;
  float radius = dot(centered, centered) * 2.35;
  return smoothstep(0.18, 0.88, radius);
}

vec3 sampleSoft(vec2 uv, float radius) {
  vec2 step = texelStep * radius;
  vec3 center = texture(colorTexture, uv).rgb * 4.0;
  vec3 north = texture(colorTexture, uv + vec2(0.0, step.y)).rgb;
  vec3 south = texture(colorTexture, uv - vec2(0.0, step.y)).rgb;
  vec3 east = texture(colorTexture, uv + vec2(step.x, 0.0)).rgb;
  vec3 west = texture(colorTexture, uv - vec2(step.x, 0.0)).rgb;
  vec3 northEast = texture(colorTexture, uv + step).rgb;
  vec3 southWest = texture(colorTexture, uv - step).rgb;
  return (center + north + south + east + west + northEast + southWest) / 10.0;
}

float quantizeValue(float value, float levels) {
  float safeLevels = max(levels, 2.0);
  return floor(value * (safeLevels - 1.0) + 0.5) / (safeLevels - 1.0);
}

vec3 quantizeColor(vec3 color, float levels) {
  float safeLevels = max(levels, 2.0);
  return floor(color * (safeLevels - 1.0) + 0.5) / (safeLevels - 1.0);
}

float colorVariance(vec3 color) {
  return abs(color.r - color.g) + abs(color.g - color.b) + abs(color.b - color.r);
}

float benDayPattern(vec2 fragCoord, float scale) {
  vec2 cell = fract(fragCoord / max(scale, 1.0)) - 0.5;
  float circle = dot(cell, cell) * 4.0;
  return 1.0 - smoothstep(0.16, 0.58, circle);
}

float hatchLine(vec2 fragCoord, float scale, float angle, float width) {
  vec2 direction = vec2(cos(angle), sin(angle));
  float stripe = abs(fract(dot(fragCoord, direction) / max(scale, 1.0)) - 0.5);
  return 1.0 - smoothstep(width, width + 0.08, stripe);
}

float crossHatchPattern(vec2 fragCoord, float scale, float intensity) {
  float hatchA = hatchLine(fragCoord, scale, 0.55, 0.16);
  float hatchB = hatchLine(fragCoord + vec2(scale * 0.35), scale * 0.92, -0.62, 0.15);
  float hatchC = hatchLine(fragCoord + vec2(scale * 0.18, scale * 0.12), scale * 1.18, 0.18, 0.13);
  float secondary = mix(0.0, hatchC, intensity);
  return max(max(hatchA, hatchB), secondary);
}

void main() {
  vec4 source = texture(colorTexture, v_textureCoordinates);
  vec3 color = source.rgb;
  float lum = luminance(color);
  float vignetteValue = vignetteMask(v_textureCoordinates);
  float grainValue = (hash(gl_FragCoord.xy) - 0.5) * grain;
  vec3 outputColor = color;

  if (styleMode < 1.5) {
    vec3 softened = mix(color, sampleSoft(v_textureCoordinates, 2.8), 0.78);
    vec3 story = applyContrast(softened, contrast);
    story = applySaturation(story, saturation);
    float storyLevels = max(bandCount, 4.0);
    float storyTone = quantizeValue(luminance(story), storyLevels);
    float sourceWaterBias = min(
      color.b - color.r * 0.88,
      color.b - color.g * 0.96
    );
    float waterBlueBias = max(
      min(story.b - story.r * 0.92, story.b - story.g * 0.98),
      min(softened.b - softened.r * 0.94, softened.b - softened.g * 1.02)
    );
    float landGreenBias = max(
      softened.g - max(softened.r * 0.94, softened.b * 0.82),
      story.g - max(story.r * 0.96, story.b * 0.84)
    );
    float dryLandBias = max(story.r, softened.r) - max(story.b, softened.b) * 0.92;
    float waterMask = max(
      smoothstep(0.025, 0.18, waterBlueBias),
      smoothstep(0.03, 0.16, sourceWaterBias)
    );
    waterMask *= 1.0 - smoothstep(0.02, 0.2, landGreenBias) * 0.92;
    waterMask *= 1.0 - smoothstep(0.06, 0.28, dryLandBias) * 0.82;
    waterMask = max(waterMask, smoothstep(0.08, 0.24, sourceWaterBias) * 0.92);
    float landMask = max(
      (1.0 - waterMask) * smoothstep(-0.02, 0.16, story.g - story.r * 0.9),
      smoothstep(0.02, 0.18, landGreenBias)
    );
    float brightMask = smoothstep(0.72, 0.98, storyTone) * (1.0 - smoothstep(0.16, 0.42, colorVariance(story)));
    vec3 oceanShadow = vec3(0.16, 0.44, 0.86);
    vec3 oceanMid = vec3(0.29, 0.73, 0.96);
    vec3 oceanHighlight = vec3(0.76, 0.95, 1.0);
    vec3 landShadow = vec3(0.45, 0.7, 0.16);
    vec3 landMid = vec3(0.73, 0.9, 0.25);
    vec3 landHighlight = vec3(0.96, 0.98, 0.55);
    vec3 neutralShadow = vec3(0.6, 0.74, 0.8);
    vec3 neutralHighlight = vec3(0.94, 0.97, 0.92);
    vec3 oceanWash = mix(
      mix(oceanShadow, oceanMid, smoothstep(0.0, 0.58, storyTone)),
      oceanHighlight,
      smoothstep(0.5, 1.0, storyTone)
    );
    vec3 landWash = mix(
      mix(landShadow, landMid, smoothstep(0.0, 0.56, storyTone)),
      landHighlight,
      smoothstep(0.46, 1.0, storyTone)
    );
    vec3 neutralWash = mix(neutralShadow, neutralHighlight, smoothstep(0.0, 1.0, storyTone));
    vec3 wash = mix(neutralWash, oceanWash, waterMask);
    wash = mix(wash, landWash, landMask);
    story = mix(story, wash, 0.76);
    story = mix(story, landWash, landMask * 0.28);
    story = mix(story, oceanWash, waterMask * 0.82);
    story += vec3(warmth, warmth * 0.4, -warmth * 0.18) * landMask * 0.45;
    story += vec3(-coolness * 0.18, coolness * 0.16, coolness) * waterMask * 0.55;
    story = mix(story, mix(oceanMid, oceanHighlight, smoothstep(0.45, 1.0, storyTone)), waterMask * 0.42);
    story = mix(story, vec3(storyTone), 0.08);
    story += brightMask * vec3(0.16, 0.16, 0.12);
    float storyEdge = clamp(edgeSample(v_textureCoordinates) * edgeStrength, 0.0, 1.0);
    story = mix(story, story * vec3(0.44, 0.56, 0.72), storyEdge * 0.74);
    story = quantizeColor(story, storyLevels - 0.4);
    story += grainValue * 0.5;
    story *= 1.0 - vignette * vignetteValue * 0.22;
    outputColor = mix(color, clamp(story, 0.0, 1.0), mixAmount);
  } else {
    vec3 softened = mix(color, sampleSoft(v_textureCoordinates, 1.9), 0.52);
    vec3 comic = applyContrast(softened, contrast);
    comic = applySaturation(comic, saturation);
    float levels = max(bandCount, 3.0);
    float comicTone = quantizeValue(luminance(comic), levels);
    comic = quantizeColor(comic, levels);
    comic = mix(comic, vec3(comicTone), 0.28);
    float edgeInk = clamp(edgeSample(v_textureCoordinates) * edgeStrength, 0.0, 1.0);
    vec3 outlineColor = vec3(0.05, 0.05, 0.07);
    comic = mix(comic, outlineColor, smoothstep(0.38, 0.92, edgeInk) * 0.48);
    float dotPattern = benDayPattern(gl_FragCoord.xy + vec2(comicTone * 13.0, comicTone * 17.0), halftoneScale);
    float dotZone = smoothstep(0.34, 0.62, comicTone);
    float highlightZone = smoothstep(0.62, 0.92, comicTone) * 0.75;
    float dotAmount = dotPattern * (dotZone + highlightZone) * halftoneAmount;
    vec3 dotInk = mix(comic * vec3(0.58, 0.68, 0.92), vec3(0.3, 0.38, 0.75), 0.35);
    comic = mix(comic, dotInk, clamp(dotAmount, 0.0, 0.95));
    float shadowZone = 1.0 - smoothstep(0.44, 0.76, comicTone);
    float hatchPattern = crossHatchPattern(gl_FragCoord.xy + vec2(comicTone * 19.0, comicTone * 11.0), halftoneScale * 0.82, shadowZone);
    float hatchAmount = hatchPattern * shadowZone * halftoneAmount * 0.52;
    vec3 hatchInk = mix(comic * vec3(0.72, 0.78, 0.9), vec3(0.22, 0.28, 0.44), 0.24);
    comic = mix(comic, hatchInk, clamp(hatchAmount, 0.0, 0.58));
    comic += vec3(warmth, warmth * 0.4, -warmth * 0.12) * 0.35;
    comic = quantizeColor(comic, levels);
    comic += grainValue * 0.2;
    comic *= 1.0 - vignette * vignetteValue * 0.18;
    outputColor = mix(color, clamp(comic, 0.0, 1.0), mixAmount);
  }

  out_FragColor = vec4(clamp(outputColor, 0.0, 1.0), source.a);
}
`;


const GLOBE_STYLE_PRESETS = {
  default: {
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
    },
    post: {
      enabled: false,
      styleMode: 0,
      mixAmount: 0,
      saturation: 1,
      contrast: 1,
      warmth: 0,
      coolness: 0,
      haze: 0,
      grain: 0,
      vignette: 0,
      bandCount: 8,
      edgeStrength: 0,
      halftoneAmount: 0,
      halftoneScale: 1
    }
  },
  storybook: {
    atmosphere: { hueShift: 0.014, saturationShift: -0.14, brightnessShift: 0.08 },
    fog: { enabled: true, density: 0.00018, minimumBrightness: 0.16 },
    imagery: { brightness: 1.08, contrast: 0.7, saturation: 0.42, gamma: 0.9, hue: 0.02 },
    backgroundColor: '#a9dff4',
    labelTheme: buildLabelTheme({
      font: '600 12px "Avenir Next", "Segoe UI", sans-serif',
      fill: '#f7f4ea',
      outline: 'rgba(27, 39, 56, 0.96)',
      outlineWidth: 3,
      background: 'rgba(27, 39, 56, 0.7)',
      padding: [8, 5]
    }),
    markerConfig: {
      passBase: {
        'mountain-collective': 'rgba(92,190,165,0.96)',
        epic: 'rgba(104,150,222,0.96)',
        ikon: 'rgba(243,184,109,0.96)',
        dual: 'rgba(196,181,224,0.96)'
      },
      statusGlow: {
        incoming: 'rgba(164,120,224,0.28)',
        fresh: 'rgba(127,205,233,0.28)',
        dry: 'rgba(228,155,101,0.24)',
        steady: 'rgba(141,190,179,0.24)'
      },
      textureOptions: {
        ringColor: 'rgba(255,251,235,0.94)',
        coreColor: 'rgba(255,253,245,0.98)',
        outerGlowColor: 'rgba(255,251,233,0.08)',
        innerRadius: 11,
        ringRadius: 13,
        coreRadius: 6,
        glowRadius: 34,
        ringWidth: 4
      }
    },
    post: {
      enabled: true,
      styleMode: 1,
      mixAmount: 0.95,
      saturation: 0.78,
      contrast: 0.82,
      warmth: 0.12,
      coolness: 0.08,
      haze: 0.08,
      grain: 0.01,
      vignette: 0.1,
      bandCount: 3,
      edgeStrength: 1.08,
      halftoneAmount: 0,
      halftoneScale: 1
    }
  },
  comic: {
    atmosphere: { hueShift: -0.015, saturationShift: 0.06, brightnessShift: -0.02 },
    fog: { enabled: true, density: 0.00014, minimumBrightness: 0.04 },
    imagery: { brightness: 1.05, contrast: 1.16, saturation: 1.2, gamma: 0.92, hue: -0.01 },
    backgroundColor: '#050913',
    labelTheme: buildLabelTheme({
      font: '700 12px "Barlow Condensed", "Avenir Next", sans-serif',
      fill: '#fff4c6',
      outline: 'rgba(8, 10, 16, 0.98)',
      outlineWidth: 4,
      background: 'rgba(8, 10, 16, 0.82)',
      padding: [8, 5]
    }),
    markerConfig: {
      passBase: {
        'mountain-collective': 'rgba(92,230,175,1)',
        epic: 'rgba(61,120,255,1)',
        ikon: 'rgba(255,155,46,1)',
        dual: 'rgba(181,139,255,1)'
      },
      statusGlow: {
        incoming: 'rgba(255,88,214,0.38)',
        fresh: 'rgba(104,230,255,0.38)',
        dry: 'rgba(255,184,67,0.34)',
        steady: 'rgba(132,223,192,0.32)'
      },
      textureOptions: {
        ringColor: 'rgba(255,255,255,0.98)',
        coreColor: 'rgba(255,255,255,1)',
        outerGlowColor: 'rgba(255,255,255,0.03)',
        innerRadius: 11,
        ringRadius: 13,
        coreRadius: 6,
        glowRadius: 35,
        ringWidth: 4,
        outerStrokeColor: 'rgba(10,12,18,0.88)',
        outerStrokeWidth: 3
      }
    },
    post: {
      enabled: true,
      styleMode: 2,
      mixAmount: 0.96,
      saturation: 1.08,
      contrast: 1.34,
      warmth: 0.05,
      coolness: 0.02,
      haze: 0.02,
      grain: 0.008,
      vignette: 0.08,
      bandCount: 3,
      edgeStrength: 1.42,
      halftoneAmount: 0.5,
      halftoneScale: 21.0
    }
  }
};

const markerTextureSets = Object.fromEntries(
  Object.entries(GLOBE_STYLE_PRESETS).map(([styleId, preset]) => [styleId, createMarkerTextureSet(preset.markerConfig)])
);

const globeStyleUniforms = { ...GLOBE_STYLE_PRESETS.default.post };
const globeStyleStage = viewer.scene.postProcessStages.add(new Cesium.PostProcessStage({
  name: 'snow-scout-globe-style',
  fragmentShader: GLOBE_STYLE_SHADER,
  uniforms: {
    texelStep: () => {
      texelStepScratch.x = 1 / Math.max(viewer.scene.drawingBufferWidth, 1);
      texelStepScratch.y = 1 / Math.max(viewer.scene.drawingBufferHeight, 1);
      return texelStepScratch;
    },
    styleMode: () => globeStyleUniforms.styleMode,
    mixAmount: () => globeStyleUniforms.mixAmount,
    saturation: () => globeStyleUniforms.saturation,
    contrast: () => globeStyleUniforms.contrast,
    warmth: () => globeStyleUniforms.warmth,
    coolness: () => globeStyleUniforms.coolness,
    haze: () => globeStyleUniforms.haze,
    grain: () => globeStyleUniforms.grain,
    vignette: () => globeStyleUniforms.vignette,
    bandCount: () => globeStyleUniforms.bandCount,
    edgeStrength: () => globeStyleUniforms.edgeStrength,
    halftoneAmount: () => globeStyleUniforms.halftoneAmount,
    halftoneScale: () => globeStyleUniforms.halftoneScale
  }
}));
globeStyleStage.enabled = false;

function getActiveGlobeStyleId() {
  return GLOBE_STYLE_IDS.includes(state.globeStyle) ? state.globeStyle : 'default';
}

function getActiveGlobeStylePreset() {
  return GLOBE_STYLE_PRESETS[getActiveGlobeStyleId()];
}

function getBaseImageryLayer() {
  return viewer.imageryLayers.length ? viewer.imageryLayers.get(0) : null;
}

export function applyGlobeStyle(styleId = 'default') {
  const resolvedStyle = GLOBE_STYLE_IDS.includes(styleId) ? styleId : 'default';
  const preset = GLOBE_STYLE_PRESETS[resolvedStyle];
  const baseLayer = getBaseImageryLayer();
  try {
    viewer.scene.skyAtmosphere.hueShift = preset.atmosphere.hueShift;
    viewer.scene.skyAtmosphere.saturationShift = preset.atmosphere.saturationShift;
    viewer.scene.skyAtmosphere.brightnessShift = preset.atmosphere.brightnessShift;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString(preset.backgroundColor);

    if (viewer.scene.fog) {
      viewer.scene.fog.enabled = preset.fog.enabled;
      viewer.scene.fog.density = preset.fog.density;
      viewer.scene.fog.minimumBrightness = preset.fog.minimumBrightness;
    }

    if (baseLayer) {
      baseLayer.brightness = preset.imagery.brightness;
      baseLayer.contrast = preset.imagery.contrast;
      baseLayer.saturation = preset.imagery.saturation;
      baseLayer.gamma = preset.imagery.gamma;
      baseLayer.hue = preset.imagery.hue;
    }

    viewer.scene.globe.material = undefined;
    Object.assign(globeStyleUniforms, preset.post);
    globeStyleStage.enabled = preset.post.enabled;
    document.body.setAttribute('data-globe-style', resolvedStyle);
    viewer.scene.requestRender();
  } catch (error) {
    console.error(`Failed to apply globe style "${resolvedStyle}"`, error);
    viewer.scene.globe.material = undefined;
    Object.assign(globeStyleUniforms, GLOBE_STYLE_PRESETS.default.post);
    globeStyleStage.enabled = false;
    document.body.setAttribute('data-globe-style', 'default');
    viewer.scene.requestRender();
  }
}

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
  const stylePreset = getActiveGlobeStylePreset();
  const passTone = getPassTone(resort);
  const entity = viewer.entities.add({
    position: cartesianForResort(resort),
    billboard: {
      image: markerTextureSets[getActiveGlobeStyleId()][passTone][resort.status],
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      scale: 0.84,
      scaleByDistance: new Cesium.NearFarScalar(15000, 1.18, 12000000, 0.5)
    },
    label: {
      text: resort.name,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      font: stylePreset.labelTheme.font,
      style: stylePreset.labelTheme.style,
      fillColor: stylePreset.labelTheme.fillColor,
      outlineColor: stylePreset.labelTheme.outlineColor,
      outlineWidth: stylePreset.labelTheme.outlineWidth,
      showBackground: true,
      backgroundColor: stylePreset.labelTheme.backgroundColor,
      backgroundPadding: stylePreset.labelTheme.backgroundPadding,
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
  const styleId = getActiveGlobeStyleId();
  const stylePreset = GLOBE_STYLE_PRESETS[styleId];
  const markerTextures = markerTextureSets[styleId];
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
    marker.label.font = stylePreset.labelTheme.font;
    marker.label.style = stylePreset.labelTheme.style;
    marker.label.fillColor = stylePreset.labelTheme.fillColor;
    marker.label.outlineColor = stylePreset.labelTheme.outlineColor;
    marker.label.outlineWidth = stylePreset.labelTheme.outlineWidth;
    marker.label.backgroundColor = stylePreset.labelTheme.backgroundColor;
    marker.label.backgroundPadding = stylePreset.labelTheme.backgroundPadding;
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

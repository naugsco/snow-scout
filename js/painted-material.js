// A geographic terrain material: the grain is painted; the mountains are real.
function createTrailMask(features, bounds, lonMeters) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = ctx.lineJoin = 'round';
  const metersPerPixel = (bounds[2] - bounds[0]) * lonMeters / canvas.width;
  // Draw the mapped routes as soft snow clearings, in geographic coordinates.
  for (const feature of features) {
    if (feature.properties.kind !== 'trail') continue;
    const difficulty = feature.properties.difficulty;
    const width = difficulty === 'easy' || difficulty === 'novice' ? 34
      : difficulty === 'intermediate' ? 25 : 13;
    ctx.beginPath();
    feature.geometry.coordinates.forEach(([lon, lat], index) => {
      const x = (lon - bounds[0]) / (bounds[2] - bounds[0]) * canvas.width;
      const y = (bounds[3] - lat) / (bounds[3] - bounds[1]) * canvas.height;
      if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = '#777';
    ctx.lineWidth = (width + 12) / metersPerPixel;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = width / metersPerPixel;
    ctx.stroke();
  }
  return { canvas, bounds };
}

export function paintedMaterial(C, features, bounds, snowline, lonMeters) {
  const { canvas } = createTrailMask(features, bounds, lonMeters);
  return new C.Material({ fabric: {
    type: 'SnowScoutPaintedTerrain',
    uniforms: {
      grain: new URL('../assets/gouache-grain.png', import.meta.url).href,
      snowline,
      trailMask: canvas.toDataURL('image/png'),
      maskBounds: new C.Cartesian4(
        C.Math.toRadians(bounds[0]), C.Math.toRadians(bounds[1]),
        C.Math.toRadians(bounds[2] - bounds[0]), C.Math.toRadians(bounds[3] - bounds[1])
      )
    },
    source: `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material m = czm_getDefaultMaterial(materialInput);
        vec3 world = (czm_inverseView * vec4(-materialInput.positionToEyeEC, 1.0)).xyz;
        float lon = atan(world.y, world.x);
        // Bowring's WGS84 latitude keeps the mask aligned with the actual routes.
        float radius = length(world.xy);
        float theta = atan(world.z * 1.00336408982, radius);
        float st = sin(theta), ct = cos(theta);
        float lat = atan(world.z + 42841.3115 * st * st * st,
                         radius - 42697.6727 * ct * ct * ct);
        vec2 uv = vec2(lon * 2000.0, lat * 2000.0);
        float brush = texture(grain, fract(uv)).r;
        float height = materialInput.height / 1.5;
        float slope = materialInput.slope;
        float light = clamp(0.64 + 0.36 * cos(materialInput.aspect - 2.4) * sin(slope), 0.25, 1.0);
        light = smoothstep(0.2, 0.9, light);
        vec3 snow = mix(vec3(0.24, 0.44, 0.67), vec3(1.0, 0.99, 0.95), light);
        vec3 rock = mix(vec3(0.14, 0.25, 0.37), vec3(0.64, 0.63, 0.59), light);
        float steep = smoothstep(0.68, 1.12, slope);
        vec3 painted = mix(snow, rock, steep * 0.55);
        painted *= 0.90 + brush * 0.13;
        float contour = abs(fract(height / 100.0) - 0.5);
        float width = min(fwidth(height / 100.0) * 1.1, 0.15);
        float line = 1.0 - smoothstep(0.0, max(width, 0.005), contour);
        painted = mix(painted, vec3(0.30, 0.43, 0.52), line * 0.045);
        vec2 maskUV = (vec2(lon, lat) - maskBounds.xy) / maskBounds.zw;
        float inside = step(0.0, maskUV.x) * step(maskUV.x, 1.0)
                     * step(0.0, maskUV.y) * step(maskUV.y, 1.0);
        float clearing = texture(trailMask, clamp(maskUV, 0.0, 1.0)).r * inside;
        m.diffuse = mix(painted, snow, clearing);
        // Below the treeline, retain the painted aerial forest pattern.
        m.alpha = max(mix(0.03, 0.98, smoothstep(snowline, snowline + 250.0, height)), clearing * 0.96);
        return m;
      }`
  }});
}

export function paintImagery(provider, onForestTile) {
  // Preserve the provider's public contract, credits and request scheduling.
  const painted = Object.create(provider);
  painted.requestImage = (x, y, level, request) => {
    const result = provider.requestImage(x, y, level, request);
    if (!result) return undefined; // Cesium's documented request-throttling signal.
    return Promise.resolve(result).then(image => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.filter = 'blur(1px)';
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onForestTile?.(x, y, level, pixels);
      const d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        const luma = (d[i] * 0.25 + d[i+1] * 0.55 + d[i+2] * 0.2) / 255;
        const shade = Math.round(luma * 7) / 7;
        // Dark forest remains ink-teal; open ground becomes ivory snow.
        const forest = Math.max(0, Math.min(1, (0.39 - luma) / 0.22));
        const snow = [222 + shade * 30, 235 + shade * 18, 242 + shade * 11];
        const trees = [12 + shade * 22, 42 + shade * 35, 66 + shade * 40];
        for (let c = 0; c < 3; c++) d[i+c] = snow[c] * (1-forest) + trees[c] * forest;
      }
      ctx.putImageData(pixels, 0, 0);
      return canvas;
    });
  };
  return painted;
}

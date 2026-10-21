import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutHeatmap, heatColor, rankResorts, metricValue, snowScore } from '../js/heatmap-metrics.js';

test('missing metrics remain distinct from zero and sort after known values', () => {
  const resorts = [
    { name: 'Missing', metrics: { snow24h: null } },
    { name: 'Zero', metrics: { snow24h: 0 } },
    { name: 'Fresh', metrics: { snow24h: 12 } }
  ];
  assert.deepEqual(rankResorts(resorts, 'snow24h').map((row) => row.value), [12, 0, null]);
  assert.equal(metricValue({ metrics: { snow24h: -1 } }, 'snow24h'), null);
  assert.equal(snowScore({ forecast72h: 10, snow24h: null, daysSinceSnow: 0 }), null);
  assert.ok(Math.abs(snowScore({ forecast72h: 10, snow24h: 4, daysSinceSnow: 2 }) - 14.8) < 1e-10);
});

test('the color scale is orange to white to blue; equal values are neutral and missing is separate', () => {
  assert.equal(heatColor(0, 0, 100).background, 'rgb(243, 154, 80)');
  assert.equal(heatColor(50, 0, 100).background, 'rgb(241, 244, 247)');
  assert.equal(heatColor(100, 0, 100).background, 'rgb(37, 137, 239)');
  assert.equal(heatColor(0, 0, 0).background, 'rgb(241, 244, 247)');
  assert.notEqual(heatColor(null, 0, 100).background, heatColor(0, 0, 100).background);
});

test('treemap fills desktop/mobile canvases without overlaps, including all-zero and missing values', () => {
  assert.deepEqual(layoutHeatmap([{ value: 2 }], 0, 600), []);
  for (const count of [1, 2, 20, 105]) {
    for (const [width, height] of [[1465, 690], [366, 960], [366, 6300]]) {
      for (const kind of ['mixed', 'zero']) {
        const rows = Array.from({ length: count }, (_, i) => ({ resort: { id: i }, value: kind === 'zero' ? 0 : i % 7 === 0 ? null : count - i }));
        const rects = layoutHeatmap(rows, width, height);
        assert.equal(rects.length, count);
        const area = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
        assert.ok(Math.abs(area - width * height) < 0.0001);
        for (let i = 0; i < rects.length; i++) {
          const a = rects[i];
          assert.ok(a.width > 0 && a.height > 0);
          assert.ok(a.x >= -0.0001 && a.y >= -0.0001 && a.x + a.width <= width + 0.0001 && a.y + a.height <= height + 0.0001);
          for (let j = i + 1; j < rects.length; j++) {
            const b = rects[j];
            const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            assert.ok(overlapWidth < 0.0001 || overlapHeight < 0.0001);
          }
        }
      }
    }
  }
});

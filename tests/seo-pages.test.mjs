import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSeoPages, pageSlug, appSlug, resortPage, SITE_URL } from '../scripts/build_seo_pages.mjs';
import { resorts } from '../js/resorts.js';

const snapshot = JSON.parse(await readFile(new URL('../data/resort-forecasts.json', import.meta.url), 'utf8'));
const builtAt = Date.parse(snapshot.generatedAt);

test('page slugs are readable ASCII and unique', () => {
  assert.equal(pageSlug('Kitzbühel'), 'kitzbuhel');
  assert.equal(pageSlug('Les 3 Vallées'), 'les-3-vallees');
  assert.equal(pageSlug("Val d'Isère"), 'val-d-isere');
  assert.equal(pageSlug('Blue Mountain (Ontario)'), 'blue-mountain');
  const slugs = resorts.map((r) => pageSlug(r.name));
  assert.equal(new Set(slugs).size, resorts.length);
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('build writes one page per resort plus index, sitemap and robots', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'seo-'));
  const result = await buildSeoPages(out, { now: builtAt });
  assert.equal(result.pages, resorts.length);
  assert.ok(result.current > 0, 'fresh snapshot should yield current forecasts');
  assert.equal((await readdir(path.join(out, 'resorts'))).length, resorts.length + 1);
  const sitemap = await readFile(path.join(out, 'sitemap.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, resorts.length + 3);
  assert.ok(sitemap.includes(`<loc>${SITE_URL}/resorts/kitzbuhel/</loc>`));
  assert.match(await readFile(path.join(out, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/snowscout\.ski\/sitemap\.xml/);
  const page = await readFile(path.join(out, 'resorts/vail/index.html'), 'utf8');
  assert.ok(page.includes(`<link rel="canonical" href="${SITE_URL}/resorts/vail/">`));
  assert.ok(page.includes('href="../../#resort=vail"'));
  assert.ok(page.includes('href="../../resort-page.css'));
  assert.ok(!/(href|src)="\//.test(page), 'links must stay relative for the Pages subpath');
});

test('stale forecasts are withheld instead of shown', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'seo-stale-'));
  const result = await buildSeoPages(out, { now: builtAt + 5 * 86400000 });
  assert.equal(result.current, 0);
  const page = await readFile(path.join(out, 'resorts/vail/index.html'), 'utf8');
  assert.ok(page.includes('No current forecast was available'));
  assert.ok(!page.includes('Next 72 hours'));
});

test('resort page escapes names and labels only interior gaps as missing', () => {
  const resort = { ...resorts.find((r) => r.name === 'Vail'), name: 'A <b>& "Test"' };
  const forecast = { forecast72h: 1, updatedAt: snapshot.generatedAt, weatherLocation: null,
    dailyTime: ['2026-11-21', '2026-11-22', '2026-11-23'], dailySnowfall: [1, 0, null] };
  const { html } = resortPage(resort, forecast, snapshot.generatedAt, []);
  assert.ok(html.includes('A &lt;b&gt;&amp; &quot;Test&quot; snow forecast'));
  assert.ok(html.includes('2-day total'));
  assert.ok(!html.includes('some days missing'));
  const gap = resortPage(resort, { ...forecast, dailySnowfall: [1, null, 2] }, snapshot.generatedAt, []).html;
  assert.ok(gap.includes('some days missing'));
  assert.equal(appSlug('Kitzbühel'), 'kitzb-hel');
});

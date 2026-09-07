// 構図の幾何: HUD を避ける領域、環の外周、周辺表示の範囲を検証する。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/ui/framing.js', import.meta.url), 'utf8');
const ctx = vm.createContext({});
for (const name of ['emptyFrameRect', 'frameRadius', 'fitFrameDistance']) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf('\n  function ', start + 1);
  vm.runInContext(source.slice(start, end), ctx);
}
const run = code => vm.runInContext(code, ctx);
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
for (const [width, height, obstacles] of [
  [1280, 720, [{ x0: 0, x1: 240, y0: 90, y1: 650 }, { x0: 900, x1: 1280, y0: 110, y1: 620 }]],
  [390, 844, [{ x0: 0, x1: 390, y0: 510, y1: 844 }, { x0: 335, x1: 390, y0: 260, y1: 600 }]],
  [844, 390, [{ x0: 0, x1: 200, y0: 50, y1: 390 }, { x0: 600, x1: 844, y0: 50, y1: 390 }]],
]) {
  ctx.bounds = { x0: 20, y0: 100, x1: width - 20, y1: height - 20 };
  ctx.obstacles = obstacles;
  const r = run('emptyFrameRect(bounds, obstacles)');
  assert.ok(r.x0 >= 20 && r.x1 <= width - 20 && r.y0 >= 100 && r.y1 <= height - 20);
  assert.ok(r.x1 > r.x0 && r.y1 > r.y0);
  for (const o of obstacles) assert.equal(overlaps(r, o), false);
}
ctx.SUN = { key: 'sun', radius: 100 };
ctx.earth = { key: 'earth', radius: 1 };
ctx.moon = { key: 'moon', parent: 'earth', radius: 0.27, aKm: 60 };
ctx.saturn = { key: 'saturn', radius: 9, ring: true, obl: [1.05, .95, 1.05] };
ctx.bodyR = b => b.radius;
ctx.KM2W = ctx.K_REAL = 1;
ctx.RING_OUT = 2.4;
ctx.SATELLITES = [ctx.moon];
ctx.BODY_BY_KEY = new Map([['earth', ctx.earth]]);
ctx.PLANETS = [{}, {}, {}, { a: 150, e: .1 }];
assert.equal(run('frameRadius(saturn, "close")'), 9 * 2.4);
assert.ok(run('frameRadius(earth, "context")') > 60); // 地球中心で月の外側まで
assert.ok(run('frameRadius(moon, "context")') > 61); // 月中心で母天体まで
assert.ok(run('frameRadius(SUN, "context")') >= 165);

ctx.FOV = Math.PI / 4;
ctx.cam = { distTgt: 0 };
for (const [width, height] of [[600, 460], [295, 380], [350, 150]]) {
  ctx.H = 844;
  ctx.frameLayout = { rect: { x0: 20, y0: 100, x1: width + 20, y1: height + 100 }, mode: 'close' };
  run('fitFrameDistance(saturn)');
  const d = ctx.cam.distTgt;
  const projected = ctx.H / (2 * Math.tan(ctx.FOV / 2)) * Math.tan(Math.asin(9 * 2.4 / d));
  assert.ok(Number.isFinite(d) && d > 9 * 2.4);
  assert.ok(projected <= Math.min(width, height) * .36 + 1e-8);
}
console.log('framing-test: desktop / portrait / landscape / rings / Earth–Moon / fit passed');

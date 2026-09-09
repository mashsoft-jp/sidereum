// 場面の偏り、暗転中の切替、案内の消去、非表示タブを検証。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { style: {}, addEventListener(type, fn) { this[type] = fn; }, setAttribute() {} });
  return elements.get(id);
};
const listeners = {};
const ctx = vm.createContext({
  document: { hidden: false, getElementById: element }, window: { addEventListener(type, fn) { listeners[type] = fn; } },
  matchMedia: () => ({ matches: false }), lang: 'ja', simDays: 0, J2000: Date.UTC(2000, 0, 1, 12), DAY_MS: 86400000,
  cam: { yaw: 0, yawTgt: 0 }, gAz: 0, gAzTgt: 0,
});
const run = code => vm.runInContext(code, ctx);
run(readFileSync(new URL('../src/ui/screensaver.js', import.meta.url), 'utf8'));
run(`saverState = { bag: [], kind: 'body', phase: 'show', fade: 0, age: 0, elapsed: 0, duration: 40, orbit: true, scenePlaying: true }`);
// 7場面ごとの抽選で全種類を必ず巡り、袋の境界でも同じ種類を続けない。
let previous = 'body';
for (let round = 0; round < 100; round++) {
  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    const kind = run('nextSaverKind()');
    assert.notEqual(kind, previous);
    seen.add(kind); previous = kind;
    run(`saverState.kind = ${JSON.stringify(kind)}`);
  }
  assert.equal(seen.size, 7);
}
run(`saverState.kind = 'body'`);
const scenes = [];
ctx.applyTourScene = () => {};
ctx.recordScene = kind => scenes.push({ kind, opacity: Number(element('saverFade').style.opacity) });
// 描画はブラウザで確認。時計の検証では場面適用の境界を記録する。
run(`applySaverScene = kind => { recordScene(kind); saverState.kind = kind; saverState.elapsed = 0; saverState.duration = 40; }`);
ctx.setPlaying = value => { ctx.playing = value; };
const step = seconds => { for (let i = 0; i < seconds * 60; i++) run('stepScreensaver(1/60)'); };
step(10);
assert.ok(ctx.cam.yawTgt > 0);
step(1);
assert.equal(element('saverBar').style.opacity, '0');
assert.equal(element('saverHint').style.opacity, '0');
const elapsed = run('saverState.elapsed');
ctx.document.hidden = true; step(60);
assert.equal(run('saverState.elapsed'), elapsed);
ctx.document.hidden = false; step(28);
assert.equal(scenes.length, 0);
step(2);
assert.equal(scenes.length, 1);
assert.equal(scenes[0].opacity, 1);
step(2);
assert.equal(element('saverBar').style.opacity, '1', '次の場面ではタイトルが再表示される');
assert.equal(element('saverHint').style.opacity, '0', '終了案内は繰り返さない');
ctx.matchMedia = () => ({ matches: true });
const still = ctx.cam.yawTgt; step(2); assert.equal(ctx.cam.yawTgt, still);
ctx.simDays = 1; step(1);
assert.equal(element('saverDate').textContent, '2000-01-02 12:00 UTC');
let exits = 0;
ctx.recordExit = () => exits++;
run('stopScreensaver = () => { recordExit(); saverState = null; }');
const event = { preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
listeners.click(event);
assert.equal(exits, 1); assert.ok(event.prevented && event.stopped, '終了クリックを背後へ渡さない');
listeners.click(event); assert.equal(exits, 1);
run('saverState = {}'); listeners.keydown({ ...event, key: 'Escape' }); assert.equal(exits, 2);
console.log('screensaver: coverage, fade, temporary titles/hint, hidden tab, reduced motion, date and exit passed');

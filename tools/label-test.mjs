// ラベルの優先順位、密集時の退避、画面端での読みやすさを検証する。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../src/render/body.js', import.meta.url), 'utf8');
const labels = source.slice(source.indexOf('  const LBL_SEL'), source.indexOf('  // ---------- 描画 ----------'));
const drawn = [];
const ctx = vm.createContext({ W: 390, H: 844, octx: {
  measureText: text => ({ width: text.length * 11 }),
  fillText: (text, x, y) => drawn.push({ text, x, y }),
  save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
}});
vm.runInContext(labels, ctx);
function run(code) { drawn.length = 0; vm.runInContext('lblBegin();' + code + ';lblEnd();', ctx); }
run(`lblPut('minor',100,100,lblPri({key:'ceres'}),'white');
     lblPut('planet',100,100,lblPri({key:'jupiter'}),'white');`);
assert.deepEqual(drawn.map(x => x.text), ['planet']);
run(`lblPut('selected',100,100,LBL_SEL,'white');
     lblPut('spotlight',100,100,LBL_SEL,'white');
     lblPut('background',100,100,LBL_SKY,'white');`);
assert.equal(drawn.length, 2);
assert.ok(Math.abs(drawn[0].y - drawn[1].y) > 17);
run(`lblPut('edge',0,0,LBL_SEL,'white');`);
assert.equal(drawn.length, 1);
assert.ok(drawn[0].x >= 27 && drawn[0].y >= 15);
run(`lblPut('outside',-30,50,LBL_SKY,'white');`);
assert.equal(drawn.length, 0);
run(`lblBlock(100,100,30); lblPut('constellation',100,100,LBL_SKY,'white');`);
assert.equal(drawn.length, 0);
console.log('labels: priorities, selected-label separation, viewport edges and disc avoidance passed');

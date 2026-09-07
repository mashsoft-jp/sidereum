// 実際の更新処理で、速度・停止・日時ジャンプと流星の寿命を確認する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({ Math: Object.assign(Object.create(Math), {random: () => 0.5}), Float32Array, localStorage: { getItem: () => null } });
vm.runInContext(`
  const SHOWERS = [], SPORADIC = {zhr:0, acc:0};
  let simDays=100, playing=true, daysPerSec=1/86400, groundView=true, surfaceBody='earth';
  let tourMeteorRealtime=false;
  const DEG=Math.PI/180, MAX_FOV=1.5, gFov=1, W=1000, H=700;
  const _sunG=[0,-1,0], MOON={};
  function computeObs(){ return {alt:-10}; }
  function sunLonDeg(){ return 0; }
`,ctx);
vm.runInContext(readFileSync(new URL('../src/render/meteor.js', import.meta.url),'utf8'),ctx);
const run = code => vm.runInContext(code,ctx);
run('updateMeteors(0); meteors.push({t0:metClock,dur:1,tau:0.2});');
run('simDays+=0.1/86400; updateMeteors(0.1)');
assert.ok(Math.abs(run('metClock')-0.1)<1e-6);
run('daysPerSec=10/86400; simDays+=1/86400; updateMeteors(0.2)');
assert.ok(Math.abs(run('metClock')-1.1)<1e-6);
assert.equal(run('meteors.length'),1);
run('playing=false; SPORADIC.acc=1; updateMeteors(0.3)');
assert.equal(run('SPORADIC.acc'),1,'停止中は繰越分も発生させない');
run('SPORADIC.acc=0');
assert.ok(Math.abs(run('metClock')-1.1)<1e-6);
assert.equal(run('meteors.length'),1);
run('playing=true; simDays+=0.6/86400; updateMeteors(0.36)');
assert.equal(run('meteors.length'),0,'寿命も10倍で進む');
run('meteors.push({t0:metClock,dur:1,tau:1}); SPORADIC.acc=0.8; simDays+=100; updateMeteors(0.4)');
assert.equal(run('meteors.length'),0,'日時ジャンプで古い光跡を消す');
assert.equal(run('SPORADIC.acc'),0,'ジャンプで大量発生させない');
run('meteors.push({t0:metClock,dur:1,tau:1}); simDays-=1; updateMeteors(0.5)');
assert.equal(run('meteors.length'),0,'逆行で古い光跡を消す');
run('meteors.push({t0:metClock,dur:1,tau:1}); updateMeteors(10)');
assert.equal(run('meteors.length'),0,'タブ復帰で古い光跡を消す');
run('meteors.push({t0:metClock,dur:1,tau:1}); surfaceBody="moon"; updateMeteors(10.1)');
assert.equal(run('meteors.length'),0,'月面には表示しない');
// 低いフレームレートでも待ち時間を積み上げ、実際の光跡を生成する。
run(`
  surfaceBody='earth'; daysPerSec=1/86400; metPrevSec=-1;
  var gAz=0, gAlt=Math.PI/2;
  const testShower={zhr:120,acc:0,v:35};
  MET_ALL.unshift(testShower);
  function showerZhr(s){return s.zhr;}
  metRadiantG=function(s,out){out[0]=0;out[1]=1;out[2]=0;};
  let emitted=0;
  const originalSpawn=metSpawn;
  metSpawn=function(...args){
    const before=meteors.length;
    originalSpawn(...args);
    emitted+=meteors.length-before;
  };
  updateMeteors(0);
  for(let i=1;i<=1000;i++){
    simDays+=0.6/86400;
    updateMeteors(i*0.6);
  }
`);
assert.ok(run('emitted')>0,'0.6秒間隔の描画でも120個/時の群から光跡が生成される');
assert.ok(Math.abs(run('testShower.acc')-run('(120*MET_ZSCALE*(1-Math.cos(metConeHalf()))/6)%1'))<1e-4,
  '描画遅延で出現待ちの端数を失わない');
console.log('meteor-test: speed / pause / lifetime / jump / reverse / resume / moon / slow frames passed');
run(`
  showMeteor=false; tourMeteorRealtime=true; daysPerSec=180/86400; updateMeteors(600.1);
  var clockBefore=metClock;
  meteors.push({t0:metClock,dur:1,tau:0.2});
  simDays+=18/86400; updateMeteors(600.2);
`);
assert.ok(Math.abs(run('metClock-clockBefore')-0.1)<1e-6,'ツアーでは180倍速でも光跡は実時間');
assert.ok(run('meteors.length')>0,'生成した光跡が高速再生で即座に消えない');
assert.equal(run('showMeteor'),false,'ツアーで保存済み表示設定を変えない');
run('tourMeteorRealtime=false; showMeteor=true; updateMeteors(600.3)');
assert.equal(run('meteors.length'),0,'ツアー終了時に異なる時計の光跡を持ち越さない');
run('clockBefore=metClock; simDays+=18/86400; updateMeteors(600.4)');
assert.ok(Math.abs(run('metClock-clockBefore')-18)<1e-6,'通常表示はシミュレーション時間へ戻る');
console.log('meteor-test: tour real-time animation / exit passed');

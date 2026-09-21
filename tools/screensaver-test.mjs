// 場面の偏り、暗転中の切替、案内の消去、非表示タブを検証。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { style: {}, addEventListener(type, fn) { this[type] = fn; }, setAttribute() {}, removeAttribute() {} });
  return elements.get(id);
};
const listeners = {};
const ctx = vm.createContext({
  performance: { now: () => 1000 },
  document: { hidden: false, getElementById: element }, window: { addEventListener(type, fn) { listeners[type] = fn; } },
  matchMedia: () => ({ matches: false }), MAX_FOV: Math.PI / 2, lang: 'ja', simDays: 0, J2000: Date.UTC(2000, 0, 1, 12), DAY_MS: 86400000,
  cam: { yaw: 0, yawTgt: 0 }, gAz: 0, gAzTgt: 0,
});
const run = code => vm.runInContext(code, ctx);
run(readFileSync(new URL('../src/ui/screensaver.js', import.meta.url), 'utf8'));
run(`saverState = { bag: [], kind: 'body', phase: 'show', fade: 0, age: 0, elapsed: 0, duration: 40, orbit: true, scenePlaying: true }`);
// 全種類ごとの抽選で全種類を必ず巡り、袋の境界でも同じ種類を続けない。
let previous = 'body';
for (let round = 0; round < 100; round++) {
  const seen = new Set();
  for (let i = 0; i < 14; i++) {
    const kind = run('nextSaverKind()');
    assert.notEqual(kind, previous);
    seen.add(kind); previous = kind;
    run(`saverState.kind = ${JSON.stringify(kind)}`);
  }
  assert.equal(seen.size, 14);
}
run(`saverState.kind = 'body'`);
// 元ツアーを変更せず、全抜粋が有効な日時と照準を持つ。
run(readFileSync(new URL('../src/data/tours.js', import.meta.url), 'utf8'));
ctx.mqNarrow = { matches: true };
const tourSource = readFileSync(new URL('../src/ui/tour.js', import.meta.url), 'utf8');
run(tourSource.slice(tourSource.indexOf('  function tourStateAt('), tourSource.indexOf('  function applyTourStep(')));
const originals = run('JSON.stringify(TOURS)');
const clips = run('Object.values(SAVER_TOUR_CLIPS).flat()');
assert.equal(clips.length, 13);
for (const clip of clips) {
  ctx.clip = clip; const { scene } = run('saverTourScene(clip)');
  assert.ok(Number.isFinite(Date.parse(scene.d + 'Z')));
  assert.ok(scene.spd > 0 && Number.isFinite(scene.spd));
  assert.ok(scene.ride || scene.aim || scene.radiant || clip[0] === 'cassini');
  if (clip[0] === 'cassini') {
    assert.equal(scene.ride,'saturn');assert.equal(scene.on,'cassini');
    assert.equal(scene.dot,true);assert.ok(scene.spd<1);
    assert.equal(scene.until,'2006-03-27');
    assert.equal(scene.spd,.6);
  }
  if (scene.until) assert.ok(Date.parse(scene.until + 'Z') > Date.parse(scene.d + 'Z'));
}
assert.equal(run('JSON.stringify(TOURS)'), originals);
const visualKeys = ['tourProbes','tourProbe','tourRideOn','tourRide','tourRideStay','tourRideSlow',
  'tourRideWarm','tourRideT0','tourRideSpd','tourRideRef','tourRideMag','tourRideZoom',
  'tourProbeDot','tourRideEye','tourProbeHold','tourSpot','tourMeteorRealtime'];
for (const [i, key] of visualKeys.entries()) ctx[key] = i;
ctx.savedVisuals = run('captureSaverTourVisuals()');
for (const key of visualKeys) ctx[key] = null;
run('restoreSaverTourVisuals(savedVisuals)');
for (const [i, key] of visualKeys.entries()) assert.equal(ctx[key], i, key + ' restored');


const realApplySaverScene = run("applySaverScene");
const realStopScreensaver = run("stopScreensaver");
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
assert.equal(element('saverBar').style.opacity, '1', '10秒後もタイトルを残す');
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
// 全種類が低fpsでも同じ量だけ動く。地上・月面の彗星は追尾の方位を変えない。
ctx.matchMedia = () => ({ matches: false });
for (const kind of ['body', 'overview', 'cometSpace', 'cometGround', 'cometMoon', 'earthSky', 'moonSky']) {
  const samples = [];
  for (const fps of [15, 60]) {
    run(`saverState = { kind: '${kind}', orbit: ${kind === 'body'} }; cam.yawTgt = 0; cam.distTgt = 100; gAzTgt = 0; gFovTgt = .8;`);
    for (let i = 0; i < fps * 50; i++) run(`moveSaverCamera(${1 / fps})`);
    const result = run('[cam.yawTgt, cam.distTgt, gAzTgt, gFovTgt]');
    assert.ok(result.some((n, i) => Math.abs(n - [0, 100, 0, .8][i]) > .01), kind + ' moves');
    if (kind === 'cometGround' || kind === 'cometMoon') {
      assert.equal(result[2], 0); assert.ok(result[3] > 1.3 && result[3] < Math.PI / 2);
    }
    if (kind === 'cometSpace') { assert.ok(result[0] > .65); assert.ok(result[1] > 180); }
    samples.push(result);
  }
  samples[0].forEach((n, i) => assert.ok(Math.abs(n - samples[1][i]) < 1e-8, kind + ' frame rate independent'));
}
let exits = 0;
ctx.recordExit = () => exits++;
run('stopScreensaver = () => { recordExit(); saverState = null; }');
const event = { preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
listeners.click(event);
assert.equal(exits, 1); assert.ok(event.prevented && event.stopped, '終了クリックを背後へ渡さない');
listeners.click(event); assert.equal(exits, 1);
run('saverState = {}'); listeners.keydown({ ...event, key: 'Escape' }); assert.equal(exits, 2);
// click が届かないSafari経路でも、指を離すだけで終了する。
for (const type of ['pointerup', 'touchend']) {
  run('saverState = {}');
  const before = exits;
  listeners[type]({ ...event, cancelable: true }); assert.equal(exits, before + 1);
  const click = { ...event, prevented: false, stopped: false };
  listeners.click(click); assert.ok(click.prevented && click.stopped, '互換クリックを復元画面へ渡さない');
  const down = { ...event, stopped: false }; listeners.pointerdown(down);
  const next = { ...event, prevented: false, stopped: false }; listeners.click(next);
  assert.equal(next.stopped, false, '新しい操作は遮らない');
}
console.log('screensaver: coverage, fade, temporary titles/hint, hidden tab, reduced motion, date and exit passed');
// Only the requested distant scenes override the normal label visibility.
ctx.SUN = {key:'sun',showLabel:false};
ctx.PLANETS = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto'].map(key=>({key,showLabel:false,tno:key==='pluto'}));
ctx.PLANETS.push({key:'ceres',ast:true},{key:'halley',comet:true},{key:'eris',tno:true});
ctx.BODY_BY_KEY = new Map(ctx.PLANETS.map(b=>[b.key,b]));
run("saverState={kind:'paleDot'}");
assert.deepEqual(Array.from(run('screensaverLabelBodies().map(b=>b.key)')),['earth']);
run("saverState.kind='overview'");
assert.deepEqual(Array.from(run('screensaverLabelBodies().map(b=>b.key)')),['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto']);
for(const kind of ['body','cometSpace','voyager','cassini','earthSky']) {
 ctx.testKind=kind;run('saverState.kind=testKind');assert.equal(run('screensaverLabelBodies().length'),0);
}
run('saverState=null');assert.equal(run('screensaverLabelBodies().length'),0);
assert.equal(ctx.PLANETS[0].showLabel,false,'normal visibility preferences stay unchanged');
console.log('screensaver labels: Pale Blue Dot, overview, other scenes and preserved preferences passed');

// 環の場面を実際に適用し、次の景色と終了の両方で専用描画を解除する。
Object.assign(ctx, {
 ringExplore:null, frameLayout:{}, ORBIT_BODIES:[],
 refreshObsSiteUI(){}, hideModals(){}, restoreTourState(){}, syncInfoMore(){},
 applyNavVisible(){}, syncFramingUI(){}, moonSiteEl:{},
 frameApp:{classList:{remove(){},toggle(){}}}, immersiveBar:{}, menuBtn:{focus(){}},
});
run('saverState={tourVisuals:savedVisuals};');
realApplySaverScene('saturnRings');
assert.equal(ctx.ringExplore.saver,true);
assert.equal(element('saverDate').hidden,true);
assert.equal(run('saverState.kind'),'saturnRings');
realApplySaverScene('overview');
assert.equal(ctx.ringExplore,null,'次の景色に環の描画が残らない');
assert.equal(element('saverDate').hidden,false);
realApplySaverScene('saturnRings');
run('saverState.saved={}; saverState.extra={frame:{}};');
realStopScreensaver();
assert.equal(ctx.ringExplore,null,'終了時も環の描画を解除する');
assert.equal(run('saverState'),null);
console.log('screensaver rings: entry, next scene and exit passed');

// 写真は全8枚を重複なく巡り、ロード完了前にフェードを開かない。
run(readFileSync(new URL('../src/data/dso-photos.js', import.meta.url), 'utf8'));
ctx.DSO = run('DSO_PHOTOS.map(p=>[p.m])');
ctx.dsoName = i => 'Object '+ctx.DSO[i][0];
ctx.dsoPhotoCreditHTML = p => p.credit;
ctx.dsoTextCreditHTML = () => "Text adapted from ESA/Hubble · CC BY 4.0";
run('saverState={tourVisuals:savedVisuals,bag:[],phase:"in",fade:0,age:0};');
const photos = new Set();
for(let i=0;i<8;i++) {
 realApplySaverScene('dsoPhoto');
 photos.add(element('saverPhotoImage').src);
 assert.equal(element('saverDate').hidden,true);
 assert.equal(element('saverPhoto').hidden,false);
 assert.match(element('saverPhotoCredit').innerHTML,/CC BY 4.0/);
}
assert.equal(photos.size,8);
run('stepScreensaver(.2)');
assert.equal(element('saverFade').style.opacity,'1');
assert.equal(run('saverState.elapsed'),0);
element('saverPhotoImage').onload();
run('stepScreensaver(.2)');
assert.ok(Number(element('saverFade').style.opacity)<1);
assert.notEqual(element('saverPhotoImage').style.transform,'scale(1)');
ctx.matchMedia=()=>({matches:true});
const transform=element('saverPhotoImage').style.transform;
run('moveSaverCamera(2)');assert.equal(element('saverPhotoImage').style.transform,transform);
ctx.matchMedia=()=>({matches:false});
realApplySaverScene('dsoPhoto');
element('saverPhotoImage').onerror();
run('stepScreensaver(.1)');assert.notEqual(run('saverState.kind'),'dsoPhoto');
realApplySaverScene('overview');
assert.equal(element('saverPhoto').hidden,true);
assert.equal(element('saverPhotoCredit').hidden,true);
realApplySaverScene('dsoPhoto');
run('saverState.saved={}; saverState.extra={frame:{}};');
realStopScreensaver();
assert.equal(element('saverPhoto').hidden,true);
assert.equal(element('saverPhotoImage').onload,null);
console.log('screensaver photos: coverage, credits, loading, motion, errors and cleanup passed');

// 縦・横・正方形の写真と長いクレジットでも全体が収まり、説明が直下に続く。
for (const [width,height] of [[390,844],[844,390],[1134,899],[320,568]]) {
 for (const [iw,ih] of [[2000,1000],[1000,2000],[1500,1500]]) {
  for (const caption of [50,110]) {
   ctx.layoutArgs=[width,height,iw,ih,caption,24,32];
   const r=run('saverPhotoLayout(...layoutArgs)');
   assert.ok(r.width<=width-24+.001);
   assert.ok(r.top>=24);
   assert.ok(r.captionTop+caption<=height-32+.001);
   assert.ok(Math.abs(r.width/r.height-iw/ih)<1e-9);
   assert.equal(r.captionTop-r.top-r.height,12);
  }
 }
}
console.log('screensaver photos: aspect ratios, caption spacing and portrait/landscape bounds passed');

// 写真は移動中も領域からはみ出さず、高密度画面でも原画像以上に引き伸ばさない。
for (const m of [31,42,57,13,45,1,16,51]) for (let seconds=0;seconds<=40;seconds++) {
 ctx.poseArgs=[seconds,m];
 const p=run('saverPhotoPose(...poseArgs)');
 assert.ok(p.scale<=1 && p.scale>0);
 assert.ok(Math.abs(p.x)/100+p.scale/2<=.5);
 assert.ok(Math.abs(p.y)/100+p.scale/2<=.5);
}
ctx.layoutArgs=[3000,2000,600,400,100,16,16,2];
const capped=run('saverPhotoLayout(...layoutArgs)');
assert.ok(capped.width*2<=600 && capped.height*2<=400);
console.log('screensaver photos: motion stays in frame and respects source resolution');

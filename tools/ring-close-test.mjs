import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const source=read('render/ring-close.js');
const code=source.slice(source.indexOf('  function makeRingFragments'),source.indexOf('  function initRingCloseMesh'));
const ctx=vm.createContext({Math,Float32Array,Map});
vm.runInContext(code,ctx);
const first=vm.runInContext('makeRingFragments(100)',ctx), second=vm.runInContext('makeRingFragments(100)',ctx);
assert.deepEqual(first.data,second.data,'再表示で粒子の形がランダムに入れ替わらない');
assert.ok(first.data.length>100*80*3*10, "近くで目立つ大粒は輪郭を細分化する");
assert.ok(first.data.every(Number.isFinite));
for(const p of first.pieces){
 const radii=p.shape.map(v=>Math.hypot(...v));
 assert.ok(Math.max(...radii)/Math.min(...radii)>1.3,'粒子は等半径の球ではない');
 for(const v of p.shape)assert.ok(v[1]+p.center[1]<1.7,'最も低いカメラ位置を粒子が貫かない');
}
// 同じ頂点を共有する面では法線も一致し、三角形の継ぎ目に陰影の段差が出ない。
const shared = new Map();
for(let i=0;i<first.data.length;i+=10) {
  const key=[...first.data.slice(i,i+3),...first.data.slice(i+6,i+9)].join(',');
  const normal=[...first.data.slice(i+3,i+6)];
  assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-5);
  if(shared.has(key))assert.deepEqual(normal,shared.get(key));
  else shared.set(key,normal);
}
// 専用の鑑賞景を終了したら、カメラと再生状態を復元する。
const ui=read('ui/ring-close.js');
const uiCtx=vm.createContext({Object,Array,groundView:false,tourActive:false,selected:{key:'saturn'},ringExplore:null,
 document:{getElementById:()=>({})},cam:{dist:42,focus:[1,2,3]},camZoom:2,camZoomTgt:3,playing:true,
 frameLayout:{fit:'saturn'},cameraFlight:{},setImmersive(){},syncFramingUI(){}});
uiCtx.setPlaying=v=>uiCtx.playing=v;
vm.runInContext(ui.slice(0,ui.indexOf("  frameRingBtn.addEventListener")),uiCtx);
vm.runInContext('beginRingExplore(); cam.focus[0]=999; cam.dist=5; endRingExplore();',uiCtx);
assert.equal(uiCtx.cam.focus[0],1);assert.equal(uiCtx.cam.dist,42);assert.equal(uiCtx.playing,true);
assert.equal(uiCtx.camZoom,2);assert.equal(uiCtx.ringExplore,null);
console.log('ring-close: deterministic irregular fragments, camera clearance and state restoration passed');

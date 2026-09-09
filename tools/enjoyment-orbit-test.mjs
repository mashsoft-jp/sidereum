import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../src/ui/framing.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  let enjoymentWait'),src.indexOf('  function setImmersive'));
const results=[];
for(const fps of [15,60,120]) {
  const ctx=vm.createContext({immersiveView:true,screensaverRunning:()=>false,groundView:false,tourActive:false,selected:{},lastCenter:null,
    cameraFlight:null,pointers:new Map(),snapPending:false,snapDlgEl:{classList:{contains:()=>false}},
    document:{hidden:false},matchMedia:()=>({matches:false}),window:{addEventListener(){}},cam:{yawTgt:0}});
  vm.runInContext(code,ctx);
  const step=(seconds)=>{for(let i=0;i<seconds*fps;i++)vm.runInContext(`stepEnjoymentOrbit(${1/fps})`,ctx)};
  step(20);results.push(ctx.cam.yawTgt);
  assert.ok(ctx.cam.yawTgt>0 && ctx.cam.yawTgt<20*Math.PI/120,'ゆっくり加速する');
  ctx.pointers.set(1,{});let yaw=ctx.cam.yawTgt;step(5);assert.equal(ctx.cam.yawTgt,yaw,'ドラッグ中は停止');
  ctx.pointers.clear();step(2);assert.equal(ctx.cam.yawTgt,yaw,'操作後も少し待つ');step(4);assert.ok(ctx.cam.yawTgt>yaw,'操作後に再開');
  for(const flag of ['cameraFlight','snapPending','groundView','tourActive']) {
    ctx[flag]=true;yaw=ctx.cam.yawTgt;step(1);assert.equal(ctx.cam.yawTgt,yaw,flag);ctx[flag]=null;
  }
  vm.runInContext('enjoymentPaused = true',ctx);yaw=ctx.cam.yawTgt;step(10);assert.equal(ctx.cam.yawTgt,yaw,'一時停止は自動で解除しない');
  vm.runInContext('enjoymentPaused = false',ctx);step(5);assert.ok(ctx.cam.yawTgt>yaw,'再開すると周回を再開');
  ctx.immersiveView=false;yaw=ctx.cam.yawTgt;step(5);assert.equal(ctx.cam.yawTgt,yaw,'鑑賞終了で停止');
  ctx.immersiveView=true;ctx.matchMedia=()=>({matches:true});step(5);assert.equal(ctx.cam.yawTgt,yaw,'動きを減らす設定');
}
assert.ok(Math.max(...results)-Math.min(...results)<.001,'フレームレートによらない速度');
console.log('enjoyment orbit: frame rates, pause/resume, flight, snapshot, view exit and reduced motion passed');

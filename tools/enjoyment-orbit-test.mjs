import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../src/ui/framing.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  let enjoymentWait'),src.indexOf('  function setImmersive'));
const results=[];
for(const fps of [15,60,120]) {
  const ctx=vm.createContext({ringExplore:null,immersiveView:true,screensaverRunning:()=>false,groundView:false,tourActive:false,selected:{},lastCenter:null,
    cameraFlight:null,pointers:new Map(),snapPending:false,snapDlgEl:{classList:{contains:()=>false}},
    document:{hidden:false},matchMedia:()=>({matches:false}),window:{addEventListener(){}},cam:{yawTgt:0,pitchTgt:0,distTgt:10}});
  vm.runInContext(code,ctx);
  const step=(seconds)=>{for(let i=0;i<seconds*fps;i++)vm.runInContext(`stepEnjoymentOrbit(${1/fps})`,ctx)};
  step(20);results.push(ctx.cam.yawTgt);
  assert.ok(ctx.cam.pitchTgt > 0 && ctx.cam.pitchTgt < .18,'上下の変化は穏やか');
  assert.ok(ctx.cam.distTgt >= 10 && ctx.cam.distTgt <= 10.6,'寄り引きはフレームを保つ範囲');
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
  ctx.matchMedia=()=>({matches:false});
  const before=ctx.cam.distTgt;
  step(600);
  assert.ok(Number.isFinite(ctx.cam.pitchTgt) && Number.isFinite(ctx.cam.distTgt));
  assert.ok(ctx.cam.distTgt/before>.94 && ctx.cam.distTgt/before<1.07,'長時間でも距離は累積しない');
}
assert.ok(Math.max(...results)-Math.min(...results)<.001,'フレームレートによらない速度');
console.log('enjoyment orbit: frame rates, pause/resume, flight, snapshot, view exit and reduced motion passed');

// 実天体では日照を保って周回し、土星の環を横切らない。
for (const key of ['earth','moon','saturn']) {
 const start=[.8,.3,Math.sqrt(1-.8*.8-.3*.3)];
 const pole=[0,.9,Math.sqrt(.19)];
 const ctx=vm.createContext({ringExplore:null,immersiveView:true,screensaverRunning:()=>false,groundView:false,tourActive:false,
  selected:{key},lastCenter:null,posW:new Map([[key,[-10,0,0]]]),SATURN_POLE_W:pole,
  cameraFlight:null,pointers:new Map(),snapPending:false,snapDlgEl:{classList:{contains:()=>false}},
  document:{hidden:false},matchMedia:()=>({matches:false}),window:{addEventListener(){}},
  cam:{yawTgt:Math.atan2(start[2],start[0]),pitchTgt:Math.asin(start[1]),distTgt:10}});
 vm.runInContext(code,ctx);
 for(let i=0;i<3600;i++){
  vm.runInContext('stepEnjoymentOrbit(1/6)',ctx);
  const {yawTgt:y,pitchTgt:p}=ctx.cam;
  const d=[Math.cos(p)*Math.cos(y),Math.sin(p),Math.cos(p)*Math.sin(y)];
  assert.ok(Math.abs(d[0]-.8)<1e-10,'位相角を保ち、夜側へ回らない');
  assert.ok(d.every(Number.isFinite));
  if(key==='saturn')assert.ok(d.reduce((sum,v,j)=>sum+v*pole[j],0)>.21,'環の開きを保つ');
 }
 assert.ok(ctx.cam.distTgt>=9.99&&ctx.cam.distTgt<=10.61,'距離を累積しない');
}
console.log('scenic orbit: ten minute phase preservation, ring opening and bounded distance passed');

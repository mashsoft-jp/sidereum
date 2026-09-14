// 実際の追走カメラで、縦持ちの天体と機体が横幅に収まるかを確かめる。
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/ui/tour.js',import.meta.url),'utf8');
const start=source.indexOf('  function tourRideCam()');
const code=source.slice(start,source.indexOf('\n  function ',start+1));
const target={key:'target',radius:1}, probe={key:'probe',live:true};
const c=vm.createContext({Math, W:390,H:844, tourRide:'target',groundView:false,
  tourRideOn:'probe',BODY_BY_KEY:new Map([['target',target],['probe',probe]]),
  posW:new Map(),bodyR:b=>b.radius,RING_OUT:2.4,PROBE_PX:44,
  tourRideRef:100,tourRideStay:0,tourRideSpd:1,tourRideSlow:.06,tourRideWarm:0,tourRideEye:false,
  PITCH_MAX:89.99*Math.PI/180,STAY_SOFT:.3,_rq:[0,0,0],
  cam:{focus:[0,0,0],focusTgt:[0,0,0],panOff:[0,0,0],panOffTgt:[0,0,0]}});
c.eFov=()=>Math.PI/4/c.camZoom;
let direction=[0,1,0];
c.rideVel=(pr,tb,out)=>{out.splice(0,3,...direction);return true;};
vm.runInContext(code,c);
let count=0;
for(const w of [320,390,430]) for(const zoom of [2,4.4,40])
for(const ring of [false,true]) for(const distance of [1.05,3,10,100])
for(const velocity of [[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
  c.W=w;c.camZoom=c.tourRideZoom=zoom;target.ring=ring;direction=velocity;
  c.posW.set('target',[0,0,0]);c.posW.set('probe',[distance,0,0]);
  vm.runInContext('tourRideCam()',c);
  const {dist:d,yaw,pitch}=c.cam;
  const eye=[d*Math.cos(pitch)*Math.cos(yaw),d*Math.sin(pitch),d*Math.cos(pitch)*Math.sin(yaw)];
  const delta=[distance-eye[0],-eye[1],-eye[2]];
  const depth=-(delta[0]*eye[0]+delta[1]*eye[1]+delta[2]*eye[2])/d;
  const right=[Math.sin(yaw),0,-Math.cos(yaw)];
  const focal=c.H/2/Math.tan(c.eFov()/2);
  const x=Math.abs(delta.reduce((v,a,i)=>v+a*right[i],0))*focal/depth;
  const probeRadius=44*zoom*c.tourRideMag;
  assert.ok(depth>d*.02,'機体が近クリップ面より奥にある');
  assert.ok(x+probeRadius<c.W*.5,'機体に横方向の余白がある');
  const radius=ring?2.4:1;
  assert.ok(focal*Math.tan(Math.asin(radius/d))<=c.W*.38+1e-8,'環を含めた天体が横幅に収まる');
  count++;
}
console.log(`tour-ride-test: ${count} portrait framing cases passed`);
// 機体位置からの撮影は画面比や接近制限でカメラをずらさない。
c.tourRideEye=true; c.tourRideStay=1000;
const position=[12,7,-9];c.posW.set('probe',position);
for (const [w,h] of [[390,844],[1280,720]]) {
  c.W=w;c.H=h;vm.runInContext('tourRideCam()',c);
  const {dist:d,yaw,pitch}=c.cam;
  const eye=[d*Math.cos(pitch)*Math.cos(yaw),d*Math.sin(pitch),d*Math.cos(pitch)*Math.sin(yaw)];
  eye.forEach((v,i)=>assert.ok(Math.abs(v-position[i])<1e-9));
}
console.log('tour-ride-test: onboard camera position passed');

// カッシーニの周回はPCでも環全体を収め、外側のカメラから追い続ける。
c.tourRideEye=false;c.tourRideStay=0;c.tourRide='saturn';c.tourRideOn='cassini';
probe.key='cassini';target.key='saturn';target.ring=true;
c.BODY_BY_KEY=new Map([['cassini',probe],['saturn',target]]);
c.camZoom=c.tourRideZoom=1;c.simDays=c.tourRideT0=0;
for(const [w,h] of [[390,844],[1280,720]]) {
 c.W=w;c.H=h;
 for(let phase=0;phase<6.28;phase+=.2) {
  const p=[3*Math.cos(phase),.2,3*Math.sin(phase)];
  c.posW.set('saturn',[0,0,0]);c.posW.set('cassini',p);
  vm.runInContext('tourRideCam()',c);
  assert.ok(c.cam.dist>Math.hypot(...p));
  const focal=h/2/Math.tan(c.eFov()/2);
  assert.ok(focal*Math.tan(Math.asin(2.4/c.cam.dist))<=Math.min(w,h)*.38+1e-8);
 }
}

// 同じ機体位置でも撮影位置が移り、画面内の機体が固定されない。
c.W=1280;c.H=720;c.posW.set('cassini',[3,0,0]);
const screenPositions=[];
for(const day of [0,15,30]) {
 c.simDays=day;vm.runInContext('tourRideCam()',c);
 const {dist:d,yaw,pitch}=c.cam;
 const eye=[d*Math.cos(pitch)*Math.cos(yaw),d*Math.sin(pitch),d*Math.cos(pitch)*Math.sin(yaw)];
 const delta=[3-eye[0],-eye[1],-eye[2]];
 const depth=-delta.reduce((s,v,i)=>s+v*eye[i],0)/d;
 const x=delta.reduce((s,v,i)=>s+v*[Math.sin(yaw),0,-Math.cos(yaw)][i],0)*(c.H/2/Math.tan(c.eFov()/2))/depth;
 screenPositions.push(x);
 assert.ok(Math.abs(x)+44*c.tourRideMag<c.W/2);
}
assert.ok(Math.abs(screenPositions[2]-screenPositions[0])>80,'機体が左右に動いて見える');

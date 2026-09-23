import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('../src/ui/framing.js', import.meta.url), 'utf8');
const code = src.slice(src.indexOf('  function enjoymentFeature'), src.indexOf('  function stepFraming'));
const SUN = {key:'sun'}, body = {key:'earth'};
const pole = [0,.9,Math.sqrt(.19)];
const posW = new Map([['sun',[0,0,0]]]);
const cam = {yaw:0,pitch:0};
const ctx = vm.createContext({SUN,body,posW,cam,SATURN_POLE_W:pole});
vm.runInContext(code,ctx);
const dot = (a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
for (const key of ['earth','moon','saturn']) {
  body.key=key;
  for (const light of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
    posW.set(key,light.map(v=>-v*10));
    for (const yaw of [-3,0,3]) for (const pitch of [-1,0,1]) {
      cam.yaw=yaw;cam.pitch=pitch;
      const d = vm.runInContext('enjoymentDirection(body)',ctx);
      assert.ok(d.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...d)-1)<1e-12);
      assert.ok(Math.abs(dot(d,light)-Math.cos((key === "moon" ? 55 : 40)*Math.PI/180))<1e-12,'明るい面と明暗の境目を見せる');
      if(key==='saturn') {
        assert.ok(Math.abs(dot(d,pole))>.40,'環が線にならない');
        if(Math.abs(dot(light,pole))>.05) assert.ok(dot(d,pole)*dot(light,pole)>0,'照らされた環の側を選ぶ');
      }
    }
  }
}
const sunDirection=vm.runInContext('enjoymentDirection(SUN)',ctx);
assert.ok(sunDirection.every(Number.isFinite),'太陽も有限の視点を維持');
console.log('enjoyment: illumination, ring opening, lit ring side and polar directions passed');

// 明るい特徴を画面中心へ寄せ、夜側の場合は無理に回り込まない。
ctx.bodyModel=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
for (const key of ['mars','jupiter']) {
 body.key=key;
 const feature=vm.runInContext('enjoymentFeature(body)',ctx);
 assert.ok(Math.abs(Math.hypot(...feature)-1)<1e-12);
 posW.set(key,feature.map(v=>-v*10));
 const d=vm.runInContext('enjoymentDirection(body)',ctx);
 assert.ok(dot(d,feature)>.7,'特徴が明るいとき画面内に収める');
 posW.set(key,feature.map(v=>v*10));
 const night=vm.runInContext('enjoymentDirection(body)',ctx);
 assert.ok(dot(night,feature)<0,'特徴が夜側なら太陽側の構図を維持');
}
console.log('enjoyment: textured landmarks and night-side fallback passed');
// 任意の明暗境界の角度でも光源との角度を保ち、周回で夜側へ逃げない。
body.key='moon';posW.set('moon',[-10,0,0]);
for(const phase of [76,85,100]) {
 ctx.phase=phase;
 const d=vm.runInContext('enjoymentDirection(body,phase)',ctx);
 assert.ok(Math.abs(d[0]-Math.cos(phase*Math.PI/180))<1e-12);
}

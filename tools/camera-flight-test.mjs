import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('../src/ui/framing.js', import.meta.url), 'utf8');
const code = src.slice(src.indexOf('  let cameraFlight'), src.indexOf('  function frameBody'));
for (const fps of [15, 60, 120]) {
  const body = {key:'test'};
  const cam = {focus:[0,0,0],panOff:[0,0,0],dist:1000,distTgt:.001,yaw:3.1,yawTgt:-3.1,pitch:0,pitchTgt:.3};
  const ctx = vm.createContext({cam,selected:body,groundView:false,tourActive:false,camZoom:1,camZoomTgt:1,
    frameLayout:{fit:body},posW:new Map([['test',[10,0,0]]]),matchMedia:()=>({matches:false}),window:{addEventListener(){}}});
  vm.runInContext(code,ctx);
  vm.runInContext('beginCameraFlight(selected)',ctx);
  let previous=cam.dist;
  for(let i=0;i<Math.ceil(2.2*fps)+1;i++) {
    vm.runInContext(`stepCameraFlight(${1/fps})`,ctx);
    assert.ok(cam.dist<=previous+1e-10 && cam.dist>=.001-1e-10);
    assert.ok(Number.isFinite(cam.focus[0]));previous=cam.dist;
  }
  assert.ok(Math.abs(cam.dist-.001)<1e-10);
  assert.equal(cam.focus[0],10);
  assert.ok(Math.abs(cam.yaw-3.1)<.1,'yaw takes the short arc');
  vm.runInContext('beginCameraFlight(selected); stepCameraFlight(.1); cancelCameraFlight()',ctx);
  assert.equal(cam.distTgt,cam.dist);
  assert.equal(ctx.frameLayout.fit,null);
}
console.log('camera flight: 15/60/120 fps, monotonic distance, exact arrival, short yaw and cancellation passed');

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
  let previous=cam.dist, previousAngle=Math.atan2(10,1000);
  const sizes=[];
  for(let i=0;i<Math.ceil(2.8*fps)+1;i++) {
    vm.runInContext(`stepCameraFlight(${1/fps})`,ctx);
    assert.ok(cam.dist<=previous+1e-10 && cam.dist>=.001-1e-10);
    assert.ok(Number.isFinite(cam.focus[0]));previous=cam.dist;
    sizes.push(.001 / cam.dist);
    const angle=Math.atan2(Math.abs(10-cam.focus[0]),cam.dist);
    assert.ok(angle<=previousAngle+1e-9,'angular offset must decrease throughout approach');
    previousAngle=angle;
    if (i===Math.floor(fps*.5)) {
      assert.ok(cam.dist<1000 && cam.dist>.001,'approach already in progress');
      assert.ok(cam.pitch>0 && cam.pitch<.3,'rotation overlaps approach');
      assert.ok(angle>0,'centering overlaps approach');
    }
  }
  const speeds=sizes.slice(1).map((s,i)=>(s-sizes[i])*fps);
  const late=speeds.slice(Math.floor(2.2*fps));
  for(let i=1;i<late.length;i++) assert.ok(late[i]<=late[i-1]+1e-8,'apparent growth must decelerate near arrival');
  assert.ok(Math.max(...speeds)<1.05,'apparent growth must not spike');
  assert.ok(Math.abs(cam.dist-.001)<1e-10);
  assert.equal(cam.focus[0],10);
  assert.ok(Math.abs(cam.yaw-3.1)<.1,'yaw takes the short arc');
  vm.runInContext('beginCameraFlight(selected); stepCameraFlight(.1); cancelCameraFlight()',ctx);
  assert.equal(cam.distTgt,cam.dist);
  assert.equal(ctx.frameLayout.fit,null);
}
console.log('camera flight: 15/60/120 fps, monotonic distance, exact arrival, short yaw and cancellation passed');

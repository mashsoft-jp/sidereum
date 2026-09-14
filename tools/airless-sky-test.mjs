import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const ctx=vm.createContext({Math,DEG:Math.PI/180,showTerrain:false,surfaceBody:'earth',_rf:[0,0],
 refractRad:()=>{throw Error('airless sky must not refract');},
 computeObs:()=>({az:123,alt:0.5,altGeo:0})});
for(const [file,name] of [['render/ground.js','refractUp'],['render/ground.js','flatK'],['ui/view-mode.js','surfaceAltAz']]){
 const s=read(file),start=s.indexOf('  function '+name+'('),end=s.indexOf('\n  }',start)+4;
 vm.runInContext(s.slice(start,end),ctx);
}
for(const altitude of [-80,-10,-1,0,1,10,80]){
 ctx.u=Math.sin(altitude*Math.PI/180);
 assert.equal(vm.runInContext('flatK(u)',ctx),1);
 assert.equal(vm.runInContext('refractUp(u)[1]',ctx),ctx.u);
}
assert.equal(vm.runInContext('surfaceAltAz({}).alt',ctx),0,'tracking uses geometric altitude when terrain is off');
ctx.showTerrain=true;
assert.equal(vm.runInContext('surfaceAltAz({}).alt',ctx),0.5,'normal observation keeps apparent altitude');
ctx.surfaceBody='moon';
assert.equal(vm.runInContext('flatK(0)',ctx),1);
console.log('airless sky: circular discs, geometric projection and matching tracking passed');

// 日没後も地平線下の太陽付近に黄道光の白い塊を出さない。
const zodiGain = read('render/ground.js').match(/_zodi\.gain = (.*);/)[1];
for (const zAlt of [-80, -16, -8, 0, 30]) {
  ctx.zAlt = zAlt; ctx.showTerrain = false;
  assert.equal(vm.runInContext(zodiGain, ctx), 0);
}
ctx.showTerrain = true; ctx.zAlt = -16;
assert.equal(vm.runInContext(zodiGain, ctx), 1, 'normal night sky retains zodiacal light');

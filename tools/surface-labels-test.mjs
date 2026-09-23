import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({});
const run=s=>vm.runInContext(s,c);
run(readFileSync(new URL('../src/render/surface-labels.js',import.meta.url),'utf8'));
assert.equal(run('SURFACE_FEATURES.earth'),undefined);
const records=run('Object.entries(SURFACE_FEATURES)');
for (const [key,features] of records) for(const f of features){
 c.key=key;c.f=f;
 const v=run('surfaceFeatureLocal(key,f)');
 assert.ok(Math.abs(Math.hypot(...v)-1)<1e-12);
 // Round-trip to the exact shader UV convention, including wrap and latitude.
 const u=.5-Math.atan2(v[2],v[0])/(2*Math.PI);
 const start=['moon','mars'].includes(key)?-180:0;
 const expected=((f.lon-start)%360+360)%360/360;
 assert.ok(Math.abs(u-expected)<1e-12);
 assert.ok(Math.abs(Math.acos(v[1])/Math.PI-(90-f.lat)/180)<1e-12);
}
for (const args of ['80,1,1,5,false','200,-.2,1,5,false','200,1,-.2,5,false','200,1,1,13,true'])
 assert.equal(run(`surfaceLabelOpacity(${args})`),0);
assert.ok(run('surfaceLabelOpacity(200,1,1,5,true)')>.8);
assert.equal(run('surfaceLabelOpacity(200,1,1,0,true)'),0);
// Actual overlay entry: Earth, ground, hidden body and missing textures never label.
Object.assign(c,{selected:{key:'moon',showLabel:true},groundView:false,tourActive:false,ringExplore:null,immersiveView:false,saverState:null,
 texLoaded:new Map(),screenPos:new Map(),posW:new Map(),bodyR:()=>1,bodyModel:()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
 EYE:[10,0,0],performance:{now:()=>5000},W:800,H:600,lang:'en',LBL_BODY:1,LF11:{},
 octx:{save(){},restore(){},beginPath(){},arc(){},moveTo(){},lineTo(){},stroke(){}},project:()=>({x:400,y:300}),lblPut:()=>{c.labels++;},labels:0});
run('drawSurfaceLabels()');assert.equal(c.labels,0);
c.texLoaded.set('moon','ready');c.screenPos.set('moon',{x:400,y:300,r:200,hidden:true});
run('drawSurfaceLabels()');assert.equal(c.labels,0);
c.screenPos.get('moon').hidden=false;c.posW.set('moon',[0,0,0]);c.posW.set('sun',[100,0,0]);
run('drawSurfaceLabels()');assert.ok(c.labels>0);
c.labels=0;c.EYE=[-10,0,0];run('drawSurfaceLabels()');assert.equal(c.labels,0);
c.EYE=[10,0,0];c.posW.set('sun',[-100,0,0]);run('drawSurfaceLabels()');assert.equal(c.labels,0);
console.log('surface labels: UV projection, Earth exclusion, scale, occlusion, lighting, transient fade passed');

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const setup=readFileSync(new URL('../src/gl/setup.js',import.meta.url),'utf8');
const resources=readFileSync(new URL('../src/gl/resources.js',import.meta.url),'utf8');
const raw=readFileSync(new URL('../tex/moon-relief.bin',import.meta.url));
const buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
assert.equal(raw.length,257*129*2);
const uploads=[];let requests=0;
const context=vm.createContext({Float32Array,Uint16Array,DataView,TEX_DIR:'tex/',
 fetch:async()=>{requests++;return {ok:true,arrayBuffer:async()=>buffer}},console,
 gl:{createBuffer:()=>({}),bindBuffer(){},bufferData(_,data){uploads.push(data)},STATIC_DRAW:1,ARRAY_BUFFER:2,ELEMENT_ARRAY_BUFFER:3}});
vm.runInContext(setup.slice(setup.indexOf('  function makeSphere'),setup.indexOf('  // 弦と弧')),context);
vm.runInContext(resources.slice(resources.indexOf('  let moonRelief =')),context);
const geometry=(key,r)=>vm.runInContext(`closeBodyGeometry({key:'${key}'},${r})`,context);
assert.equal(geometry('earth',400),null);assert.equal(geometry('moon',50),null);assert.equal(requests,0);
assert.equal(geometry('moon',400),null);
await new Promise(resolve=>setImmediate(resolve));
const mesh=geometry('moon',400);assert.ok(mesh);assert.equal(requests,1);assert.equal(uploads.length,2);
for(let y=0;y<=128;y++){
 const first=(y*257)*3,last=(y*257+256)*3;
 for(let j=0;j<3;j++)assert.ok(Math.abs(mesh.vertices[first+j]-mesh.vertices[last+j])<1e-6,'seam closes');
}
let lo=Infinity,hi=0;
for(let i=0;i<mesh.vertices.length;i+=3){const r=Math.hypot(...mesh.vertices.slice(i,i+3));lo=Math.min(lo,r);hi=Math.max(hi,r)}
assert.ok(lo>.99&&lo<1);assert.ok(hi>1&&hi<1.01,'real scale, no exaggeration');
assert.ok(mesh.indices.reduce((a,b)=>Math.max(a,b),0)<65536);
assert.equal(geometry('moon',60),null);assert.equal(geometry('moon',400),mesh);assert.equal(uploads.length,2);
console.log('Moon relief: lazy loading, radial scale, closed seam, uint16 indices and GPU reuse passed');

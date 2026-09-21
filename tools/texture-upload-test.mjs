import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/gl/resources.js',import.meta.url),'utf8');
let frames=0,uploads=[],closed=0,current=true,error=0;
const ctx=vm.createContext({requestAnimationFrame:resolve=>{frames++;queueMicrotask(()=>resolve(frames));},
 createImageBitmap:async (img,x,y,w,h)=>({width:w??8192,height:h??4096,close(){closed++;}}),
 gl:{NO_ERROR:0,bindTexture(){},texImage2D(){},getError:()=>error,
 texSubImage2D(...args){uploads.push({frame:frames,y:args[3],height:args[6].height});}}});
vm.runInContext(source.slice(source.indexOf('  const textureFrame'),source.indexOf('  function loadTexInto')),ctx);
const upload=vm.runInContext('uploadDetailTexture',ctx);
assert.equal(await upload({}, {},()=>current),true);
assert.equal(uploads.length,32);assert.equal(closed,33);
assert.equal(new Set(uploads.map(x=>x.frame)).size,32,'each strip has a separate animation frame');
assert.deepEqual(uploads.map(x=>x.y),Array.from({length:32},(_,i)=>i*128));
assert.ok(uploads.every(x=>x.height===128));
uploads=[];closed=0;
assert.equal(await upload({}, {},()=>frames<40),false);
assert.ok(uploads.length<32);assert.ok(closed>0,'cancel releases decoded images');
error=1285;
await assert.rejects(upload({}, {},()=>true),/allocation failed/);
console.log('texture upload: frame-spread strips, complete coverage, cancellation and allocation failure passed');

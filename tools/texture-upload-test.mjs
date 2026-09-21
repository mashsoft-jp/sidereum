import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/gl/resources.js',import.meta.url),'utf8');
let frames=0,uploads=[],closed=0,current=true,error=0,terminated=0,revoked=0,requests=[],fail=false;
class TestURL extends URL {static createObjectURL(){return 'blob:test'} static revokeObjectURL(){revoked++}}
const ctx=vm.createContext({URL:TestURL,Blob,location:{href:'https://example.test/'},detailUploadCancel:null,
 requestAnimationFrame:resolve=>{frames++;queueMicrotask(()=>resolve(frames));},
 createImageBitmap:()=>{throw new Error('main-thread decode forbidden')},
 Worker:class {
  terminate(){terminated++}
  postMessage(data){requests.push(data);queueMicrotask(()=>{
   if(fail)this.onmessage({data:{error:'decode failed'}});
   else this.onmessage({data:data.url?{width:8192,height:4096}:{strip:{height:data.height,close(){closed++}}}});
  })}
 },
 gl:{NO_ERROR:0,bindTexture(){},texImage2D(){},getError:()=>error,
 texSubImage2D(...args){uploads.push({frame:frames,y:args[3],height:args[6].height});}}});
vm.runInContext(source.slice(source.indexOf('  const textureFrame'),source.indexOf('  function loadTexInto')),ctx);
const upload=vm.runInContext('uploadDetailTexture',ctx);
assert.equal((await upload({}, 'tex/8k/moon.jpg',()=>current)).width,8192);
assert.equal(requests[0].url,'https://example.test/tex/8k/moon.jpg');
assert.equal(uploads.length,32);assert.equal(closed,32);
assert.equal(new Set(uploads.map(x=>x.frame)).size,32);
assert.deepEqual(uploads.map(x=>x.y),Array.from({length:32},(_,i)=>i*128));
assert.ok(uploads.every(x=>x.height===128));assert.equal(terminated,1);assert.equal(revoked,1);
uploads=[];closed=0;
assert.equal(await upload({}, 'tex/8k/moon.jpg',()=>frames<40),null);
assert.ok(uploads.length<32);assert.ok(closed>0);
error=1285;
await assert.rejects(upload({}, 'tex/8k/moon.jpg',()=>true),/allocation failed/);
error=0;fail=true;
await assert.rejects(upload({}, 'tex/8k/moon.jpg',()=>true),/decode failed/);
assert.equal(revoked,4);assert.equal(terminated,4);
// ダウンロード中でもキャンセルで即終了し、Worker待ちを残さない。
ctx.Worker=class{postMessage(){} terminate(){terminated++}};
let wanted=true;
const waiting=upload({}, 'tex/8k/moon.jpg',()=>wanted);
wanted=false;ctx.detailUploadCancel();
assert.equal(await waiting,null);assert.equal(ctx.detailUploadCancel,null);
assert.equal(revoked,5);
// Workerを実際の関数で動かし、Blobデコードと所有権移譲のプロトコルを検証。
const replies=[],blob={};let decoded=0;
const workerCtx=vm.createContext({self:{postMessage:(data,transfer)=>replies.push({data,transfer})},
 fetch:async url=>({ok:true,blob:async()=>blob}),
 createImageBitmap:async(input,...crop)=>{decoded++;if(!crop.length)assert.equal(input,blob);return {width:8192,height:crop[3]??4096}}});
vm.runInContext('('+vm.runInContext('detailDecodeWorker.toString()',ctx)+')()',workerCtx);
await workerCtx.self.onmessage({data:{url:'https://example.test/tex/8k/moon.jpg'}});
assert.equal(replies[0].data.height,4096);
await workerCtx.self.onmessage({data:{y:0,height:128}});
assert.equal(replies[1].transfer[0],replies[1].data.strip);assert.equal(decoded,2);
console.log('texture upload: worker-only decode, transferable strips, frame pacing, cancellation, cleanup and failures passed');

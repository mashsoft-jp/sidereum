import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data=readFileSync(new URL('../src/data/textures.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/gl/resources.js',import.meta.url),'utf8');
const images=[],jobs=[],deleted=[];let id=0,now=0;
const ctx=vm.createContext({navigator:{userAgent:'Windows NT'},matchMedia:()=>({matches:true}),localStorage:{getItem:()=> '1'},
 performance:{now:()=>now},texPending:0,texSettled(){},texWarn(){},useMipmap:false,anisoMax:0,
 uploadDetailTexture: (tex,url,current)=>new Promise(resolve=>jobs.push({url,finish:()=>resolve(current()?{width:8192,height:4096}:null)})),
 Image:class{constructor(){images.push(this)}},
 gl:{MAX_TEXTURE_SIZE:1,getParameter:()=>8192,NO_ERROR:0,getError:()=>0,createTexture:()=>({id:++id}),deleteTexture:t=>deleted.push(t.id),bindTexture(){},texParameteri(){},texImage2D(){}}});
const run=s=>vm.runInContext(s,ctx);
run(data);run(source.slice(0,source.indexOf('  const noTex')));
run(source.slice(source.indexOf('  function loadTexInto'),source.indexOf('  function loadTex(key)')));
run(`for(const key of DETAIL_TEXTURES){texByKey.set(key,{id:'base-'+key});texLoaded.set(key,'tex/4k/'+TEXTURES[key]);}`);
const frame=(key,r,ms)=>{now=ms;ctx.tick=ms;ctx.key=key;ctx.r=r;run('finishTextureFades();detailCandidate=null;detailCandidatePx=0;if(key)noteDetailTexture({key},r);stepDetailTextures(tick)')};
frame('moon',30,0);frame('moon',30,1000);assert.equal(jobs.length,0,'遠景では取得しない');
frame('moon',200,1100);frame('moon',200,1500);assert.equal(jobs.length,1);assert.equal(jobs[0].url,'tex/8k/moon.jpg');
jobs[0].finish();await new Promise(resolve=>setImmediate(resolve));const moon8=run('texByKey.get("moon").id');
frame('moon',100,2500);assert.ok(!deleted.includes('base-moon'),'4Kは復帰用に保持');
assert.equal(run('detailTextureKey'),'moon','ヒステリシス内では保持');
frame('mars',210,2600);assert.equal(run('texByKey.get("moon").id'),'base-moon');
frame('mars',210,3000);assert.equal(jobs.length,1,'前の8Kフェード中は次を載せない');
frame('mars',210,3300);assert.ok(deleted.includes(moon8));assert.equal(jobs.length,2);assert.equal(jobs[1].url,'tex/8k/mars.jpg');
frame(null,0,3400);jobs[1].finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(run('texByKey.get("mars").id'),'base-mars','離れた後の応答は無視');
frame('earth',180,6000);frame('earth',180,6400);jobs[2].finish();await new Promise(resolve=>setImmediate(resolve));
run('texHiRes=false');frame('earth',180,6500);assert.equal(run('detailTextureKey'),null);assert.equal(run('texByKey.get("earth").id'),'base-earth');
frame(null,0,7200);assert.equal(run('detailBase.size'),0);assert.equal(run('texPrevious.size'),0);
console.log('detail textures: approach, hysteresis, single 8K, release, stale load, fallback and quality OFF passed');

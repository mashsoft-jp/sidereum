import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data=readFileSync(new URL('../src/data/textures.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/gl/resources.js',import.meta.url),'utf8');
const images=[],deleted=[];let id=0,now=0;
const ctx=vm.createContext({navigator:{userAgent:'Windows NT'},matchMedia:()=>({matches:true}),localStorage:{getItem:()=> '1'},
 performance:{now:()=>now},texPending:0,texSettled(){},texWarn(){},useMipmap:false,anisoMax:0,
 Image:class{constructor(){images.push(this)}},
 gl:{MAX_TEXTURE_SIZE:1,getParameter:()=>8192,NO_ERROR:0,getError:()=>0,createTexture:()=>({id:++id}),deleteTexture:t=>deleted.push(t.id),bindTexture(){},texParameteri(){},texImage2D(){}}});
const run=s=>vm.runInContext(s,ctx);
run(data);run(source.slice(0,source.indexOf('  const noTex')));
run(source.slice(source.indexOf('  function loadTexInto'),source.indexOf('  function loadTex(key)')));
run(`for(const key of DETAIL_TEXTURES){texByKey.set(key,{id:'base-'+key});texLoaded.set(key,'tex/4k/'+TEXTURES[key]);}`);
const frame=(key,r,ms)=>{now=ms;ctx.tick=ms;ctx.key=key;ctx.r=r;run('finishTextureFades();detailCandidate=null;detailCandidatePx=0;if(key)noteDetailTexture({key},r);stepDetailTextures(tick)')};
frame('moon',30,0);frame('moon',30,1000);assert.equal(images.length,0,'遠景では取得しない');
frame('moon',200,1100);frame('moon',200,1500);assert.equal(images.length,1);assert.equal(images[0].src,'tex/8k/moon.jpg');
images[0].onload();const moon8=run('texByKey.get("moon").id');
frame('moon',100,2500);assert.ok(!deleted.includes('base-moon'),'4Kは復帰用に保持');
assert.equal(run('detailTextureKey'),'moon','ヒステリシス内では保持');
frame('mars',210,2600);assert.equal(run('texByKey.get("moon").id'),'base-moon');
frame('mars',210,3000);assert.equal(images.length,1,'前の8Kフェード中は次を載せない');
frame('mars',210,3300);assert.ok(deleted.includes(moon8));assert.equal(images.length,2);assert.equal(images[1].src,'tex/8k/mars.jpg');
frame(null,0,3400);images[1].onload();assert.equal(run('texByKey.get("mars").id'),'base-mars','離れた後の応答は無視');
frame('mercury',180,4000);frame('mercury',180,4400);images[2].onerror();assert.equal(images[2].src,'tex/4k/mercury.jpg');
images[2].onload();frame('mercury',180,5000);frame('mercury',180,5500);assert.equal(images.length,3,'失敗した天体は繰り返し8Kを取得しない');
frame('earth',180,6000);frame('earth',180,6400);images[3].onload();
run('texHiRes=false');frame('earth',180,6500);assert.equal(run('detailTextureKey'),null);assert.equal(run('texByKey.get("earth").id'),'base-earth');
frame(null,0,7200);assert.equal(run('detailBase.size'),0);assert.equal(run('texPrevious.size'),0);
console.log('detail textures: approach, hysteresis, single 8K, release, stale load, fallback and quality OFF passed');

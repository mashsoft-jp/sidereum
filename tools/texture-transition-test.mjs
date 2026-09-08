import vm from 'node:vm';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const s=readFileSync(new URL('../src/gl/resources.js',import.meta.url),'utf8');
const images=[],deleted=[];let next=0,now=0;
const texByKey=new Map([['earth',{id:'original'}]]),texPrevious=new Map();
const ctx=vm.createContext({texByKey,texPrevious,texRequests:new Map(),TEX_FADE_MS:650,performance:{now:()=>now},texPending:0,
 TEXTURES:{earth:'earth.jpg'},texURL:k=>k,texSettled(){},texWarn(){},useMipmap:false,anisoMax:0,
 Image:class{constructor(){images.push(this);this.width=2048;this.height=1024}},
 gl:{createTexture:()=>({id:++next}),deleteTexture:t=>deleted.push(t.id),bindTexture(){},texParameteri(){},texImage2D(){}}});
vm.runInContext(s.slice(s.indexOf('  function finishTextureFades'),s.indexOf('  const noTex')),ctx);
vm.runInContext(s.slice(s.indexOf('  function loadTexInto'),s.indexOf('  function loadTex(key)')),ctx);
const original=texByKey.get('earth');ctx.tex=original;
vm.runInContext('loadTexInto(tex,"earth");loadTexInto(tex,"earth")',ctx);
images[0].onload();assert.equal(texByKey.get('earth'),original,'outdated response ignored');
images[1].onload();assert.notEqual(texByKey.get('earth'),original);assert.equal(texPrevious.get('earth').tex,original);
now=649;vm.runInContext('finishTextureFades()',ctx);assert.equal(deleted.length,0);
now=651;vm.runInContext('finishTextureFades()',ctx);assert.deepEqual(deleted,['original']);
ctx.tex=texByKey.get('earth');vm.runInContext('loadTexInto(tex,"earth")',ctx);images[2].onerror();assert.equal(texByKey.get('earth'),ctx.tex,'failure preserves existing texture');
console.log('texture transitions: stale response, previous image, cleanup and failure passed');

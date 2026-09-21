import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/data/textures.js',import.meta.url),'utf8');
function context(nav,fine,max,high=true) {
 const ctx=vm.createContext({navigator:nav,matchMedia:()=>({matches:fine}),gl:{MAX_TEXTURE_SIZE:1,getParameter:()=>max},localStorage:{getItem:()=>high?'1':'0'}});
 vm.runInContext(source,ctx);return ctx;
}
for(const [nav,fine,max,expected] of [
 [{userAgent:'Windows NT'},true,16384,true],
 [{userAgent:'Macintosh',maxTouchPoints:0},true,8192,true],
 [{userAgent:'Linux x86_64'},true,8192,true],
 [{userAgent:'Windows NT'},true,4096,false],
 [{userAgent:'Macintosh',maxTouchPoints:5},true,16384,false],
 [{userAgent:'Android'},true,16384,false],
 [{userAgent:'iPhone'},false,16384,false],
 [{userAgent:'Linux',userAgentData:{mobile:true}},true,16384,false],
 [{userAgent:'Windows NT'},false,16384,false],
]) {
 const ctx=context(nav,fine,max);
 assert.ok(!vm.runInContext('texAllURLs()',ctx).some(u=>u.includes('/8k/')),'起動時の8K先読みなし');
 vm.runInContext('detailTextureKey="earth"',ctx);
 assert.equal(vm.runInContext('texURL("earth")',ctx),expected?'tex/8k/earth.jpg':'tex/4k/earth.jpg');
 for(const key of ['cloud','night','jupiter','nrm:moon']) assert.match(vm.runInContext(`texURL('${key}')`,ctx),/^tex\/4k\//);
 vm.runInContext('detail8kFailed.add("earth")',ctx);
 assert.equal(vm.runInContext('texURL("earth")',ctx),'tex/4k/earth.jpg');
 assert.ok(!vm.runInContext('texAllURLs()',ctx).some(u=>u.includes('/8k/')));
 vm.runInContext('texHiRes=false',ctx);
 assert.equal(vm.runInContext('texURL("earth")',ctx),'tex/earth.jpg');
}
console.log('earth 8K: desktop, mobile, iPad, GPU limits, normal mode and fallback cache passed');

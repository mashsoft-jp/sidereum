import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const shader=readFileSync(new URL('../src/shaders/body.frag.glsl',import.meta.url),'utf8');
// Run the production GLSL scalar function to catch finite light switching on at the horizon.
const match=shader.match(/float cloudDaylight\(float ndl\)\s*\{([^}]+)\}/);
assert.ok(match,'cloud lighting function is available');
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const cloud=vm.runInNewContext('(ndl)=>{'+match[1].replace(/\bfloat\b/g,'const')+'}',{
 sqrt:Math.sqrt,max:Math.max,pow:Math.pow,smoothstep});
assert.equal(cloud(-1),0);assert.equal(cloud(-.1),0);assert.ok(Math.abs(cloud(1)-1)<1e-12);
let previous=cloud(-1),largest=0;
for(let i=1;i<=20000;i++){
 const value=cloud(-1+i/10000);
 assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
 assert.ok(value>=previous,'daylight increases toward the Sun');
 largest=Math.max(largest,value-previous);previous=value;
}
assert.ok(largest<.001,'no narrow brightness step across the terminator');
assert.ok(cloud(-.03)>0&&cloud(-.03)<cloud(0),'elevated clouds retain a fading twilight');
assert.match(shader,/cloudDaylight\(ndl\) \* 0\.64 \* visibility/,'cloud lighting retains eclipse visibility');
console.log('Cloud lighting: continuous terminator, monotonic daylight, twilight and eclipse integration passed');

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

function scalar(name) {
 const m=shader.match(new RegExp(`float ${name}\\(float ndl\\)\\s*\\{([^}]+)\\}`));
 assert.ok(m);return vm.runInNewContext('(ndl)=>{'+m[1]+'}',{smoothstep});
}
const warmth=scalar('cloudWarmth'),twilight=scalar('earthTwilight');
for(const x of [-1,-.18,-.1,-.06,-.03,0,.04,.1,.18,.24,1]){
 assert.ok(warmth(x)>=0&&warmth(x)<=.22,'warm tint stays subtle');
 assert.ok(twilight(x)>=0&&twilight(x)<=1);
}
assert.equal(warmth(-.06),0);assert.equal(warmth(1),0);
assert.ok(warmth(-.03)<warmth(.04),'colour fades with nightfall');
assert.equal(twilight(-.18),0);assert.equal(twilight(1),0);
assert.ok(twilight(-.08)>0&&twilight(0)>twilight(-.08),'indirect light stays near the terminator');
console.log('Earth twilight: subdued cloud tint, night desaturation and local indirect light passed');

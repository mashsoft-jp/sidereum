import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/gl/post.js',import.meta.url),'utf8');
const context=vm.createContext({localStorage:{getItem(){throw new Error('unavailable')}}});
vm.runInContext(source.slice(0,source.indexOf('  // ---------- Bloom')),context);
const gain=(r,p,key)=>vm.runInContext(`scenicSkyExposure(${r},${p},'${key}')`,context);
assert.equal(vm.runInContext('autoExposureOn',context),true);
assert.equal(gain(0,1,'earth'),1);assert.equal(gain(.3,0,'earth'),1);
assert.ok(gain(.3,1,'earth')<gain(.1,1,'earth'));
assert.ok(gain(.3,1,'earth')<gain(.3,.2,'earth'));
assert.ok(gain(.3,1,'earth')<gain(.3,1,'moon'));
for(const key of ['sun','moon','earth','mars','jupiter'])for(const r of [0,.001,.1,.3,1,100])for(const p of [-1,0,.5,1,2]){
 const value=gain(r,p,key);assert.ok(Number.isFinite(value)&&value>=.08&&value<=1);
}
console.log('Scenic exposure: area, phase, reflectance, gain bounds and storage fallback passed');

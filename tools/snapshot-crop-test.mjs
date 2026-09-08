import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../src/ui/menu.js',import.meta.url),'utf8');
const ctx=vm.createContext({});
vm.runInContext(src.slice(src.indexOf('  function snapshotCrop'),src.indexOf('  function snapshotSubject')),ctx);
for(const [w,h] of [[1280,720],[390,844],[844,390]]) for(const ratio of [16/9,9/16,1]) {
  for(const [x,y] of [[w/2,h/2],[30,30],[w-30,h-30]]) {
    ctx.input=[w,h,ratio,{x,y,r:20}];
    const c=vm.runInContext('snapshotCrop(...input)',ctx);
    assert.ok(c.x>=0 && c.y>=0 && c.x+c.w<=w+1e-9 && c.y+c.h<=h+1e-9);
    assert.ok(Math.abs(c.w/c.h-ratio)<1e-9);
    assert.ok(x-20>=c.x-1e-9 && x+20<=c.x+c.w+1e-9);
    assert.ok(y-20>=c.y-1e-9 && y+20<=c.y+c.h+1e-9);
  }
}
ctx.input=[1280,720,9/16,{x:640,y:360,r:260}];
assert.equal(vm.runInContext('snapshotCrop(...input).contain',ctx),true,'大きな天体・環は切らずに余白を付ける');
console.log('snapshot crop: desktop/portrait/landscape, ratios, edge subjects and oversized bodies passed');

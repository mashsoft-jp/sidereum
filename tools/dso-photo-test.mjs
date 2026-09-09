import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
let requested=0;
const ctx=vm.createContext({Math,Float32Array,performance:{now:()=>2000},Image:class {constructor(){requested++;}},DEG:Math.PI/180,dsoOn:true,
 eqToWorld:(x,y,z,out)=>{const a=23.43928*Math.PI/180;out[0]=x;out[1]=-y*Math.sin(a)+z*Math.cos(a);out[2]=-y*Math.cos(a)-z*Math.sin(a);return out;}});
vm.runInContext(read('src/data/dso-photos.js')+read('src/render/dso-photos.js'),ctx);
const run=s=>vm.runInContext(s,ctx);
const photos=run('DSO_PHOTOS');
assert.equal(photos.length,5);
for(const p of photos){
 assert.ok(existsSync(new URL('../'+p.file,import.meta.url)));
 assert.ok(p.credit.length>20 && p.source.startsWith('https://esahubble.org/'));
 ctx.p=p;
 const center=run('dsoPhotoDirection(p,0,0)'),right=run('dsoPhotoDirection(p,1,0)'),left=run('dsoPhotoDirection(p,-1,0)');
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 assert.ok(Math.abs(Math.hypot(...center)-1)<1e-12);
 assert.ok(Math.abs(Math.acos(dot(left,right))*180/Math.PI*60-p.w)<1e-6,'angular width must match source footprint');
}
// North-up: increasing image x must decrease RA, not mirror the star field.
assert.ok(run('dsoPhotoDirection({ra:0,dec:0,w:60,h:60,north:0},1,0)[2]')>0);
ctx.vp=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
assert.equal(run('dsoPhotoInFrame([[-2,-2,0],[2,-2,0],[-2,2,0],[2,2,0]],vp)'),true,'image covering viewport counts even with corners offscreen');
assert.equal(run('dsoPhotoInFrame([[2,2,0],[3,2,0],[2,3,0],[3,3,0]],vp)'),false);
run('prepareDsoPhotos(vp,1900,0,0.5,400,false)');assert.equal(requested,0,'no daytime downloads');
run('dsoOn=false; prepareDsoPhotos(vp,1900,1,0.5,400,false)');assert.equal(requested,0,'no disabled-layer downloads');
run('DSO_PHOTOS[0].failed=true; loadDsoPhoto(DSO_PHOTOS[0])');assert.equal(requested,0,'failed image keeps procedural fallback without per-frame retries');
for(const [width,height] of [[390,844],[720,405],[720,720]]) {
 const drawn=[];
 ctx.canvasContext={save(){},restore(){},scale(){},measureText:s=>({width:s.length*5}),fillRect(){},fillText:(s,x,y)=>{assert.ok(y>=0 && y<height);drawn.push(s);}};
 ctx.width=width;ctx.height=height;
 run('drawDsoPhotoExportCredit(canvasContext,width,height,1,[DSO_PHOTOS[1]],90)');
 const result=drawn.join('');
 assert.ok(result.includes(photos[1].credit),'full original attribution is retained in exports');
 assert.ok(result.includes(photos[1].source));assert.ok(result.includes(run('DSO_PHOTO_LICENSE')));
}
console.log('DSO photos: assets, angular footprints, handedness, visibility, loading guards and export attribution passed');

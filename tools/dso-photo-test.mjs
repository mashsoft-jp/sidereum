import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
let requests=0;
class Element {
 constructor(){this.children=[];this.open=false;}
 append(...els){this.children.push(...els);}
 replaceChildren(){this.children=[];}
 setAttribute(){} addEventListener(){} remove(){}
 showModal(){this.open=true;} close(){this.open=false;}
 set src(url){requests++;this.url=url;}
}
const dialog=new Element();
const ctx=vm.createContext({Math,DEG:Math.PI/180,W:800,H:600,groundView:true,dsoOn:true,lang:'ja',
 document:{getElementById:()=>dialog,createElement:()=>new Element()},hideModals(){dialog.close();},setMenu(){},dsoLabelled:()=>true});
vm.runInContext(read('src/data/dso.js')+read('src/data/dso-photos.js')+read('src/ui/dso-photos.js')+'\nconst dsoName=i=>DSO[i][8]||"M"+DSO[i][0];',ctx);
const run=s=>vm.runInContext(s,ctx);
assert.equal(requests,0,'images must not load simply because sky is rendered');
for(const p of run('DSO_PHOTOS')){
 assert.ok(existsSync(new URL('../'+p.file,import.meta.url)));
 ctx.m=p.m;run('openDsoPhoto(DSO.findIndex(d=>d[0]===m))');
 assert.ok(dialog.open);
 assert.ok(dialog.children.some(el=>el.url===p.file));
 assert.ok(dialog.children.some(el=>el.innerHTML?.includes(p.credit.replace(/&/g,'&amp;'))));
 assert.ok(dialog.children.some(el=>el.innerHTML?.includes(run('DSO_PHOTO_LICENSE'))));
 run('closeDsoPhoto()');assert.equal(dialog.open,false);
}
assert.equal(requests,5);
run('openDsoPhoto(DSO.findIndex(d=>d[0]===1))');assert.equal(requests,5,'missing photos do not fetch an invalid URL');
assert.equal(dialog.open,false,'missing photos do not open a dialog');
ctx.vp=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
run('dsoHits.length=0; recordDsoHit(DSO.findIndex(d=>d[0]===1),[0,0,0],vp,0.5,300)');
assert.equal(run('hitTestDso(400,300)'),-1,'objects without photos are not interactive');
const photoIndex=run('DSO.findIndex(d=>d[0]===45)');
ctx.photoIndex=photoIndex;
run('recordDsoHit(photoIndex,[0,0,0],vp,0.5,300)');
assert.equal(run('hitTestDso(400,300)'),photoIndex);
assert.equal(run('hitTestDso(20,20)'),-1);
run('dsoOn=false');assert.equal(run('hitTestDso(400,300)'),-1,'hidden layer cannot be selected');
console.log('DSO viewer: deferred image requests, all five credits, close, missing photos and sky hit testing passed');

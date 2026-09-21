import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
let requests=0;
class Element {
 constructor(){this.children=[];this.open=false;}
 append(...els){this.children.push(...els);}
 replaceChildren(){this.children=[];}
 setAttribute(){} addEventListener(){} remove(){this.removed=true;}
 showModal(){this.open=true;} close(){this.open=false;}
 set src(url){requests++;this.url=url;}
}
const dialog=new Element();
const ctx=vm.createContext({W:390,H:844,showConst:true,tourActive:false,immersiveView:false,ringExplore:false,lang:'ja',
 document:{createElement:()=>new Element(),createTextNode:text=>({textContent:text})},
 dsoPhotoDialog:dialog,hideModals(){dialog.close();},setMenu(){},closeDsoPhoto(){dialog.close();},
 octx:{measureText:text=>({width:text.length*11}),fillText(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}});
const body=read('src/render/body.js'),sky=read('src/data/sky.js'),names=read('src/data/starnames.js');
vm.runInContext(body.slice(body.indexOf('  const LBL_SEL'),body.indexOf('  // ---------- 描画 ----------'))+
 sky.slice(sky.indexOf('  const CONST_NAME'),sky.indexOf('  const CONST_SEG'))+
 names.slice(names.indexOf('  const STAR_NAME_LIST'),names.indexOf('  // { ja, en,'))+
 read('src/data/star-info.js')+read('src/ui/star-info.js'),ctx);
const run=s=>vm.runInContext(s,ctx);
assert.equal(requests,0);
for(const [ja,en] of run('STAR_NAME_LIST')){
 ctx.star={ja,en,mag:1.25};
 assert.ok(run('STAR_INFO[star.en] && CONST_NAME[STAR_INFO[star.en].con]'),en);
 for(const lang of ['ja','en']) {
 ctx.lang=lang;run('openNamedStar(star)');assert.ok(dialog.open);
 assert.ok(dialog.children.some(e=>e.textContent===run('STAR_INFO[star.en].note[lang==="ja"?0:1]')));
 const img=dialog.children.find(e=>e.url);
 if(en==='Vega'){
  assert.ok(existsSync(new URL('../'+img.url,import.meta.url)));
  assert.ok(dialog.children.some(e=>e.innerHTML?.includes('CC0')));
  img.onerror();assert.ok(img.removed);assert.ok(dialog.open,'photo errors must leave description accessible');
 }else assert.equal(img,undefined,'no request or placeholder when photo is unavailable');
 run('closeDsoPhoto()');assert.ok(!dialog.open);
 }
}
assert.equal(requests,2,'only the two Vega openings load an image');
ctx.star={ja:'ベガ',en:'Vega',mag:0};
run("lblBegin(); lblPut('Vega',100,100,LBL_DSO,'white',LF11,1,star); lblEnd()");
assert.equal(run('hitTestNamedStar(100,87)?.en'),'Vega','point is tappable');
assert.equal(run('hitTestNamedStar(124,104)?.en'),'Vega','label is tappable');
assert.equal(run('hitTestNamedStar(300,300)'),null);
for(const flag of ['tourActive','immersiveView','ringExplore']){
 ctx[flag]=true;assert.equal(run('hitTestNamedStar(100,87)'),null);ctx[flag]=false;
}
ctx.showConst=false;assert.equal(run('hitTestNamedStar(100,87)'),null);ctx.showConst=true;
run("lblBegin(); lblPut('body',100,100,LBL_BODY,'white'); lblPut('Vega',100,100,LBL_DSO,'white',LF11,1,star); lblEnd()");
assert.equal(run('hitTestNamedStar(100,87)'),null,'decluttered star labels must not leave targets');
run("lblBegin(); lblPut('non-star',100,100,LBL_SKY,'white'); lblEnd()");
assert.equal(run('namedStarHits.length'),0,'reused label slots must clear star metadata');
console.log('Named stars: all 70 bilingual descriptions, deferred CC0 photo, error fallback, label/point hit targets and hidden-layer guards passed');

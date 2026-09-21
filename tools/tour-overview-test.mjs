import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const handlers={};
const close={hidden:true,addEventListener:(name,fn)=>handlers[name]=fn};
const c=vm.createContext({document:{getElementById:()=>close},tourActive:true,tour:null,tourIdx:0});
const run=code=>vm.runInContext(code,c);
run(fs.readFileSync('src/data/tours.js','utf8'));
run(fs.readFileSync('src/render/huygens-overview.js','utf8'));
for (const [id,indices] of [['cassini',[9,10]],['voyager1',[2,6]],['voyager2',[2,4,6,8]]]) {
 run(`tour=TOURS.find(t=>t.id==='${id}')`);
 const found=[];
 for(c.tourIdx=0;c.tourIdx<run('tour.steps.length');c.tourIdx++) {
  const config=run('tourOverviewScene()');
  if(config) {found.push(c.tourIdx);assert.ok(config.scene.d&&config.scene.until);}
 }
 assert.deepEqual(found,indices);
 c.tourIdx=indices[0];
 handlers.click({stopPropagation(){}});
 assert.equal(run('tourOverviewScene()'),null);
 assert.equal(close.hidden,true);
 run('resetTourOverview()');
 assert.ok(run('tourOverviewScene()'));
}
c.tourActive=false;assert.equal(run('tourOverviewScene()'),null);
console.log('Route maps: 8 scenes, per-scene dismissal, re-entry and tour exit passed');

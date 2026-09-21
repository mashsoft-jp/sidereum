// Check real generated catalogue data, named-star matching and constellation registration.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx=vm.createContext({DEG:Math.PI/180,atob:s=>Buffer.from(s,'base64').toString('binary'),
 gl:{createBuffer(){return{};},bindBuffer(){},bufferData(){}},N_STAR:0,STAR_W:null,starVB:null});
const sky=read('src/data/sky.js');
vm.runInContext(read('src/data/star-catalog.js')+sky.slice(0,sky.indexOf('  const CONST_NAME'))+read('src/data/starnames.js'),ctx);
const run=s=>vm.runInContext(s,ctx);
assert.equal(run('N_CAT'),8920);
assert.equal(run('STAR_CATALOG_COUNT'),run('N_CAT'));
assert.equal(run('NAMED_STARS.length'),70);
assert.equal(run('new Set(NAMED_STARS.map(s=>s.i)).size'),70,'each name maps to a distinct catalogue star');
for(const s of run('NAMED_STARS')){
 const ref=run(`STAR_NAME_LIST.find(s=>s[1]===${JSON.stringify(s.en)})`);
 const delta=Math.acos(Math.min(1,Math.sin(s.dec)*Math.sin(ref[3]*Math.PI/180)+Math.cos(s.dec)*Math.cos(ref[3]*Math.PI/180)*Math.cos(s.ra-ref[2]*Math.PI/180)))*180/Math.PI;
 assert.ok(delta<0.1,`${s.en} is registered to its reference position (${delta} deg)`);
}
assert.ok(run('STAR_MAG.every(m=>Number.isFinite(m)&&m>=-2&&m<=6.52)'));
assert.ok(run('STAR_COL.every(c=>c.every(v=>Number.isFinite(v)&&v>=0&&v<=1))'));
// All constellation endpoints must remain close to an actual displayed star.
let points=0,close=0;
for(const segments of Object.values(JSON.parse(run('CONST_JSON'))))for(const line of segments)for(let i=0;i<line.length;i+=2){
 ctx.ra=line[i]*Math.PI/180;ctx.dec=line[i+1]*Math.PI/180;
 const dot=run('Math.max(...STAR_RA.map((a,i)=>STAR_SD[i]*Math.sin(dec)+STAR_CD[i]*Math.cos(dec)*Math.cos(a-ra)))');
 points++;if(dot>Math.cos(0.35*Math.PI/180))close++;
}
assert.ok(close/points>.97,`${close}/${points} constellation endpoints match (some line vertices are not stars)`);
console.log(`HYG: 8920 stars, all 70 names, ${close}/${points} constellation vertices, finite magnitudes/colours passed`);

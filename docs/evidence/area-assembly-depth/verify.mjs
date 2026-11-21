import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { conditionTotals } from '../../../web/src/lib/totals.js';
import { parseProjectArchive } from '../../../web/src/lib/projectArchive.js';
const local=process.argv.includes('--browser'),dir=local?'tmp/area-assembly-depth':'docs/evidence/area-assembly-depth';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const base=await read('docs/evidence/area-assembly-prototype/prototype.takeoff.json'),edited=await read(`${dir}/edited.json`);
assert.deepEqual(await read(`${dir}/after-cancel.json`),base);
assert.deepEqual(edited.shapes,base.shapes);
const expected=structuredClone(base),bed=expected.conditions.find(c=>c.finish_tag==='BED-C1');
const changed=edited.conditions.find(c=>c.id===bed.id);bed.updated_at=changed.updated_at;
Object.assign(bed.materials[0],{per:54,name:'Topsoil — 6 in (depth test)',note:'Temporary public-plan test assumption: uniform 6-inch layer, CY = SF × 6 / 324. Not specified work.'});
Object.assign(bed.materials[1],{per:129.6,name:'Compost — 2.5 in (depth test)',note:'Temporary public-plan test assumption: uniform 2.5-inch layer, CY = SF × 2.5 / 324. Not specified work.'});
assert.deepEqual(edited,expected,'Only two explicit material patches and their condition timestamp may change');
for(const file of ['after-reload','after-reopen','after-source-navigation'])assert.deepEqual(await read(`${dir}/${file}.json`),edited,file);
assert.deepEqual(conditionTotals([changed],edited.shapes)[0].materials.map(m=>m.qty),[2.05,0.85]);
const bundled=await read('docs/evidence/area-assembly-panel/bundled-applied.json');
assert.deepEqual(await read(`${dir}/bundled-after-cancel.json`),bundled);
if(local){
 assert.deepEqual(await read(`${dir}/live-restored.json`),await read(`${dir}/live-baseline.json`));
 const a=await read(`${dir}/live-baseline.otprofile`),b=await read(`${dir}/profile-restored.otprofile`);delete a.created;delete b.created;assert.deepEqual(a,b);
 const aArchive=await parseProjectArchive(await readFile(`${dir}/live-baseline.otk`)),bArchive=await parseProjectArchive(await readFile(`${dir}/live-restored.otk`));
 const hashes=async files=>Promise.all(files.map(async f=>[f.name,createHash('sha256').update(new Uint8Array(await f.arrayBuffer())).digest('hex')]));
 assert.deepEqual(await hashes(aArchive.pdfs),await hashes(bArchive.pdfs));
}
console.log('PASS: inches → existing rates → 2.05/0.85 CY; all shape fields, plant counts, IDs and reviews preserved; cancel, reload/reopen and source navigation exact.'+(local?' Original live workspace/profile/PDF bytes restored.':''));

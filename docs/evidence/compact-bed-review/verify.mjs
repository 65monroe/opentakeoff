import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const dir=dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await readFile(resolve(dir,name),'utf8'));
const baseline=await read('baseline.takeoff.json');
assert.equal(baseline.shapes.length,14);
assert.equal(baseline.conditions.length,12);
for(const name of ['after-cancel.takeoff.json','after-reload.takeoff.json','after-reopen.takeoff.json','final.takeoff.json']) {
  assert.deepEqual(await read(name),baseline,name);
}
const sources=await read('source-checks.json');
assert.equal(sources.length,8);
const bed=baseline.shapes.find(s=>s.id==='shp-cc68c306-e582-4662-be19-f0a2617a0737');
for(const row of sources) {
  const condition=baseline.conditions.find(c=>c.finish_tag===row.code);
  const shape=baseline.shapes.find(s=>s.condition_id===condition.id && bed.source_callout_ids.includes(s.id));
  assert.ok(shape);
  assert.ok(row.detail.includes(shape.id));
  assert.ok(row.detail.includes(shape.quantity_source.text));
  assert.equal(row.selected,'true');
}
assert.deepEqual(await read('bundled-after-cancel.takeoff.json'),await read('bundled-baseline.takeoff.json'));
assert.deepEqual(await read('material-after-cancel.takeoff.json'),JSON.parse(await readFile(resolve(dir,'../area-assembly-prototype/prototype.takeoff.json'),'utf8')));
if(process.argv.includes('--browser')) {
  const require=createRequire(resolve(dir,'../../../web/package.json'));
  const {unzipSync,strFromU8}=require('fflate');
  const archive=async name=>{
    const entries=unzipSync(await readFile(resolve(dir,'../../../tmp/compact-bed-review',name)));
    return {takeoff:JSON.parse(strFromU8(entries['opentakeoff.project.json'])).takeoff,
      pdfs:Object.entries(entries).filter(([name])=>name.startsWith('plans/')).map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]).sort()};
  };
  const original=await archive('baseline.otk');
  for(const name of ['saved.otk','final.otk']) assert.deepEqual(await archive(name),original,name);
}
// Negative controls demonstrate that equal totals alone would not pass this gate.
for(const mutate of [
  p=>{p.shapes[0].id+='changed';},
  p=>{p.shapes[0].origin.reviewed=true;},
  p=>{p.shapes[0].verts_norm[0][0]+=0.001;},
  p=>{p.shapes.find(s=>s.computed?.count).computed.count+=1;},
]) {
  const bad=structuredClone(baseline);mutate(bad);
  assert.throws(()=>assert.deepEqual(bad,baseline));
}
console.log('PASS: all 14 measurements and 12 conditions match exactly after cancel, reload, archive reopen and final restoration; 8 source IDs, bundled Cancel, material Cancel and ID/review/geometry/count negative controls pass.'+(process.argv.includes('--browser')?' All original stored PDF bytes also match.':''));

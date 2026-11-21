import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url)),repo=resolve(dir,'../../..');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const source=await json(resolve(dir,'source.json'));
const base=await json(resolve(dir,'baseline.takeoff.json'));
const saved=await json(resolve(dir,'mixed-bed.takeoff.json'));
function preserved(after){
 assert.equal(after.shapes.length,base.shapes.length+7);
 assert.equal(new Set(after.shapes.map(s=>s.id)).size,after.shapes.length);
 assert.equal(after.conditions.length,base.conditions.length+7);
 for(const old of base.conditions)assert.deepEqual(after.conditions.find(c=>c.id===old.id),old);
 for(const old of base.shapes){
  const next=after.shapes.find(s=>s.id===old.id);assert.ok(next);
  if(old.id===source.bed_id){
   assert.deepEqual({...next,source_callout_ids:old.source_callout_ids,origin:old.origin},old);
   assert.deepEqual(next.origin,{...old.origin,agent_edits:(old.origin.agent_edits??0)+1});
  }else assert.deepEqual(next,old);
 }
 for(const key of Object.keys(base).filter(k=>!['shapes','conditions','proposals'].includes(k)))assert.deepEqual(after[key],base[key],key);
 for(const old of base.proposals)assert.deepEqual(after.proposals.find(p=>p.id===old.id),old);
 assert.equal(after.proposals.length,base.proposals.length+1);
 const linked=after.shapes.find(s=>s.id===source.bed_id).source_callout_ids;
 const ids=[];
 for(const row of source.rows){
  const c=after.conditions.find(c=>c.finish_tag===row.code);assert.ok(c);
  const records=after.shapes.filter(s=>s.condition_id===c.id);assert.equal(records.length,1);
  const record=records[0];ids.push(record.id);
  assert.equal(record.computed.count,row.quantity);assert.equal(record.origin.reviewed,false);
  assert.equal(record.quantity_source.text,row.text);assert.equal(record.quantity_source.id,`C2-${row.code}`);
  assert.deepEqual(record.verts_norm,[row.at.map((n,i)=>n/[5184,3456][i])]);
 }
 assert.deepEqual(linked,[...ids,source.existing_SET_id]);
 assert.equal(linked.reduce((sum,id)=>sum+after.shapes.find(s=>s.id===id).computed.count,0),232);
}
preserved(saved);
// Negative controls: prove the gate rejects plausible accidental regressions.
for(const mutate of [
 p=>{p.shapes[0].origin.reviewed=true;},
 p=>{p.shapes.find(s=>s.id===source.existing_SET_id).computed.count=59;},
 p=>{p.shapes.find(s=>s.id===source.bed_id).verts_norm[0][0]+=0.001;},
 p=>{p.shapes.find(s=>s.id===source.bed_id).source_callout_ids.pop();},
]){const bad=structuredClone(saved);mutate(bad);assert.throws(()=>preserved(bad));}
const report=await json(resolve(dir,'report.json'));
for(const row of source.rows){const c=report.conditions.find(c=>c.finish_tag===row.code);assert.equal(c.ea,row.quantity);assert.deepEqual(c.count_basis,{located_ea:0,printed_ea:row.quantity});}
assert.equal(report.conditions.find(c=>c.finish_tag==='SET').ea,185);
const nav=await json(resolve(dir,'navigation.json')),panel=await json(resolve(dir,'reopened-panel.json'));
assert.equal(nav.length,8);assert.equal(panel.length,8);
for(const row of nav){assert.ok(panel.some(text=>text.startsWith(`${row.code}${row.quantity} EA`)&&text.includes(row.id)));assert.equal(row.sheet,'L1.0');assert.equal(row.panelRetained,true);}
if(process.argv.includes('--browser')){
 const tmp=resolve(repo,'tmp/mixed-bed-callouts');
 assert.deepEqual(await json(resolve(tmp,'live-baseline.json')),base);
 for(const file of ['browser-saved.json','browser-reloaded.json','browser-reopened.json','browser-final.json'])assert.deepEqual(await json(resolve(tmp,file)),saved,file);
 const profile=await json(resolve(tmp,'live-baseline.otprofile')),finalProfile=await json(resolve(tmp,'final.otprofile'));
 assert.deepEqual({...finalProfile,created:profile.created},profile);
 // Inspect the already browser-tested archives without spawning ZIP workers.
 const require=createRequire(resolve(repo,'web/package.json'));
 const {unzipSync,strFromU8}=require('fflate');
 const archive=async file=>{
  const entries=unzipSync(await readFile(resolve(tmp,file)));
  const manifest=JSON.parse(strFromU8(entries['opentakeoff.project.json']));
  assert.equal(manifest.schema,'opentakeoff.project_archive.v1');
  return {takeoff:manifest.takeoff,pdfs:Object.entries(entries).filter(([name])=>name.startsWith('plans/')).map(([name,bytes])=>({name:name.slice(6),bytes}))};
 };
 const oldArchive=await archive('live-baseline.otk'),newArchive=await archive('browser-saved.otk'),portable=await archive('public-mixed-bed.otk');
 assert.deepEqual(newArchive.takeoff,saved);assert.deepEqual(portable.takeoff,saved);
 for(const pdf of oldArchive.pdfs){const next=newArchive.pdfs.find(f=>f.name===pdf.name);assert.ok(next);assert.ok(Buffer.from(next.bytes).equals(Buffer.from(pdf.bytes)),pdf.name);}
 assert.deepEqual(portable.pdfs.map(f=>f.name),['ccfp-L1.0.pdf']);
 await writeFile(resolve(dir,'persistence.json'),JSON.stringify({complete_json_exact:['browser-saved','browser-reloaded','browser-reopened','browser-final'],profile_exact_except_export_timestamp:true,stored_pdf_bytes_preserved:oldArchive.pdfs.map(f=>f.name),public_portable_archive_sheets:portable.pdfs.map(f=>f.name),takeoff_sha256:createHash('sha256').update(JSON.stringify(saved)).digest('hex'),existing_records:7,new_records:7,linked_sources:8,existing_geometry_quantities_reviews_exact:true,negative_controls:4},null,2)+'\n');
}
console.log('PASS: seven preserved records; seven new printed sources; eight links; 232 C2 EA; four negative controls.');

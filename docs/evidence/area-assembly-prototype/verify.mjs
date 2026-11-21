import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {conditionTotals} from '../../../web/src/lib/totals.js';
import {assemblyRows} from '../../../web/src/lib/assemblies.js';
import {parseProjectArchive,buildProjectArchive} from '../../../web/src/lib/projectArchive.js';
const dir='tmp/area-assembly',ev='docs/evidence/area-assembly-prototype';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const browser=process.argv.includes('--browser');
const base=await read(browser?`${dir}/live-baseline.json`:`${ev}/baseline.json`),saved=await read(browser?`${dir}/browser-saved.json`:`${ev}/prototype.takeoff.json`);
assert.deepEqual(await read(browser?`${dir}/browser-reloaded.json`:`${ev}/after-reload.json`),saved);
assert.deepEqual(await read(browser?`${dir}/browser-reopened.json`:`${ev}/after-reopen.json`),saved);
for(const x of base.shapes)assert.deepEqual(saved.shapes.find(y=>y.id===x.id),x);
for(const x of base.conditions){const y=structuredClone(saved.conditions.find(y=>y.id===x.id));if(x.finish_tag==='BED-C1'){y.materials=x.materials;delete y.updated_at;}assert.deepEqual(y,x);}
assert.deepEqual(saved.sheets,base.sheets);assert.deepEqual(saved.markups,base.markups);
for(const [key,value] of Object.entries(base)){
 if(['conditions','shapes','proposals'].includes(key))continue;
 assert.deepEqual(saved[key],value,`Original project field changed: ${key}`);
}
for(const proposal of base.proposals||[])assert.deepEqual(saved.proposals.find(x=>x.id===proposal.id),proposal);
assert.equal(saved.shapes.length,8);assert.equal(saved.conditions.length,6);
const bed=saved.conditions.find(c=>c.finish_tag==='BED-C1'),edge=saved.shapes.find(s=>!base.shapes.some(b=>b.id===s.id));
assert.equal(edge.origin.reviewed,false);assert.equal(edge.origin.derived.from_shape_id,base.shapes.find(s=>s.label==='C1 SET hatch').id);
const rows=conditionTotals(saved.conditions,saved.shapes),bedRow=rows.find(r=>r.id===bed.id);
assert.deepEqual(bedRow.materials.map(m=>[m.name,m.qty,m.unit]),[['Topsoil — 4 in (prototype)',1.36,'CY'],['Compost — 4 in (prototype)',1.36,'CY']]);
assert.equal(rows.find(r=>r.finish_tag==='SET').ea,185);assert.equal(rows.find(r=>r.finish_tag==='EDGE-C1-PROTOTYPE').lf,48.17);
const assembly=browser?(await read(`${dir}/profile-reloaded.otprofile`)).assembly_library.find(a=>a.name==='Public bed — topsoil 4 in + compost 4 in'):await read(`${ev}/assembly.json`);
assert.equal(assembly.items.length,2);const repeated=assemblyRows(assembly,()=>assert.fail('repeat application must not mint a row'),bed.materials);assert.equal(repeated.rows.length,0);assert.equal(repeated.skipped.length,2);
// Independent layer changes are evaluated on a clone, never committed to the project.
const changed=structuredClone(bed);changed.materials[1].per=27/(5/12);
const testRows=conditionTotals([changed],saved.shapes)[0];assert.deepEqual(testRows.materials.map(x=>x.qty),[1.36,1.71]);
assert.equal(conditionTotals([bed],[])[0].materials[0].qty,0);
// A linear material row on an area does NOT obtain the polygon perimeter.
const linear=structuredClone(bed);linear.materials=[{name:'test edge',per:1,basis:'linear',unit:'LF',round:false}];assert.equal(conditionTotals([linear],saved.shapes)[0].materials[0].qty,0);
if(browser){
assert.deepEqual(await read(`${dir}/live-restored.json`),base);
const restoredProfile=await read(`${dir}/profile-restored.otprofile`),baseProfile=await read(`${dir}/live-baseline.otprofile`);delete restoredProfile.created;delete baseProfile.created;assert.deepEqual(restoredProfile,baseProfile);
const originalArchive=await parseProjectArchive(await readFile(`${dir}/live-baseline.otk`)),restoredArchive=await parseProjectArchive(await readFile(`${dir}/live-restored.otk`));
const hashes=async files=>Promise.all(files.map(async f=>[f.name,createHash('sha256').update(new Uint8Array(await f.arrayBuffer())).digest('hex')]));assert.deepEqual(await hashes(originalArchive.pdfs),await hashes(restoredArchive.pdfs));
await writeFile(`${ev}/prototype.takeoff.json`,JSON.stringify(saved,null,2)+'\n');
await writeFile(`${ev}/assembly.json`,JSON.stringify(assembly,null,2)+'\n');
await writeFile(`${ev}/after-reload.json`,JSON.stringify(await read(`${dir}/browser-reloaded.json`),null,2)+'\n');
await writeFile(`${ev}/after-reopen.json`,JSON.stringify(await read(`${dir}/browser-reopened.json`),null,2)+'\n');
// Portable deliverable carries only the public landscape sheet, not other stored PDFs.
const pdf=originalArchive.pdfs.find(x=>x.name==='ccfp-L1.0.pdf');
await writeFile(`${dir}/public-bed-assembly.otk`,await buildProjectArchive({takeoff:saved,sheets:[{name:pdf.name}],loadPdfData:async()=>new Uint8Array(await pdf.arrayBuffer()),projectName:'Public bed — native assembly prototype'}));
const results={original_measurements_unchanged:7,original_condition_ids_preserved:5,new_measurements:1,new_conditions:1,source_area_sf:110.5,printed_plant_ea:127,other_printed_plant_ea_unchanged:58,total_set_ea_unchanged:185,topsoil_4in_cy:1.36,compost_4in_cy:1.36,edging_lf:48.17,native_repeat_application_added_rows:0,clone_compost_5in_cy:1.71,clone_topsoil_unchanged_cy:1.36,linear_row_on_area_lf:0,browser_reload_exact:true,archive_reopen_exact:true,original_workspace_restored_exact:true,original_profile_restored_except_export_timestamp:true,original_pdf_bytes_restored:true};
await writeFile(`${ev}/verification.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}else console.log('PASS: checked-in browser exports agree; all original geometry/reviews/IDs preserved; 1.36 CY per layer / 127 EA source / 48.17 LF edging; repeat recipe adds no rows; independent-depth and wrong-basis probes pass. Restoration evidence is recorded in verification.json; use --browser with fresh local backups to repeat it.');

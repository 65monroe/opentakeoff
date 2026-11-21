import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildProjectArchive} from '../../../web/src/lib/projectArchive.js';
const repo=process.cwd(),out=resolve(process.argv[3]||'tmp/area-assembly/replay');
const pdf=resolve(process.argv[2]||'tmp/area-assembly/ccfp-L1.0.pdf');
const baseline=resolve('docs/evidence/area-assembly-prototype/baseline.json');
const sheet='ccfp-L1.0.pdf';
await mkdir(out,{recursive:true});
const r=createRequire(resolve('mcp/package.json'));
const {Client}=await import(pathToFileURL(r.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(r.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const c=new Client({name:'public-bed-native-assembly',version:'1'}),log=[];
await c.connect(new StdioClientTransport({command:process.execPath,args:['--import','tsx','server.ts'],cwd:resolve('mcp'),stderr:'pipe'}));
const scrub=x=>JSON.parse(JSON.stringify(x).replaceAll(repo.replaceAll('\\','\\\\'),'<REPO>'));
async function call(name,args={},file){
 const result=await c.callTool({name,arguments:args});assert.ok(!result.isError,JSON.stringify(result));
 const value=result.structuredContent??JSON.parse(result.content.find(x=>x.type==='text').text);
 log.push({tool:name,args:scrub(args),result:scrub(value)});
 if(file){const im=result.content.find(x=>x.type==='image');await writeFile(resolve(out,file),im?Buffer.from(im.data,'base64'):JSON.stringify(value,null,2)+'\n');}
 return value;
}
const read=async p=>JSON.parse(await readFile(p,'utf8'));
try{
 await c.readResource({uri:'takeoff://wiki'});log.push({resource:'takeoff://wiki',read:true});
 await call('load_plan',{path:pdf});await call('import_takeoff',{path:baseline});
 await call('export_takeoff',{path:resolve(out,'before.json')});const before=await read(resolve(out,'before.json'));
 const source=await read(baseline);assert.deepEqual({...before,sheet_tabs:source.sheet_tabs},source);
 await call('takeoff_summary');
 const bed=before.shapes.find(s=>s.label==='C1 SET hatch');assert.equal(bed.computed.area_sf,110.5);
 const plant=before.shapes.find(s=>s.id===bed.source_callout_ids[0]);assert.equal(plant.computed.count,127);
 await call('edit_materials',{condition:'BED-C1',add:['Topsoil','Compost'].map(name=>({name:name+' — 4 in (prototype)',per:81,basis:'area',unit:'CY',round:false,note:'User-requested prototype assumption, not a requirement verified on L1.0. Separate uniform 4-inch layer over BED-C1. CY = SF × (4/12) / 27 = SF / 81. No waste or compaction allowance.'}))});
 const derived=await call('derive_base',{source_condition:'BED-C1',condition:'EDGE-C1-PROTOTYPE'});
 assert.equal(derived.committed,1);assert.equal(derived.total_lf,48.17);
 const edgeId=derived.rooms[0].base_shape_id;
 await call('edit_shape',{shape_id:edgeId,label:'C1 full boundary — prototype assumption, no openings deducted'});
 await call('export_takeoff',{path:resolve(out,'prototype.json')});const after=await read(resolve(out,'prototype.json'));
 for(const s of before.shapes)assert.deepEqual(after.shapes.find(x=>x.id===s.id),s);
 for(const old of before.conditions){const current=structuredClone(after.conditions.find(x=>x.id===old.id));if(old.finish_tag==='BED-C1')current.materials=old.materials;assert.deepEqual(current,old);}
 assert.equal(after.shapes.length,before.shapes.length+1);assert.equal(after.conditions.length,before.conditions.length+1);
 const edge=after.shapes.find(s=>s.id===edgeId);assert.equal(edge.origin.reviewed,false);assert.equal(edge.origin.derived.from_shape_id,bed.id);
 const report=await call('export_report',{},'report.json');await call('takeoff_summary',{},'summary.json');
 assert.deepEqual(report.conditions.find(x=>x.finish_tag==='BED-C1').materials.map(x=>[x.qty,x.unit]),[[1.36,'CY'],[1.36,'CY']]);
 // MCP does not retain the browser's open-tab list. Carry it back unchanged.
 const delivery={...after,sheet_tabs:source.sheet_tabs};await writeFile(resolve(out,'delivery.json'),JSON.stringify(delivery,null,2)+'\n');
 await writeFile(resolve(out,'public-bed-assembly.otk'),await buildProjectArchive({takeoff:delivery,sheets:[{name:sheet}],loadPdfData:async()=>new Uint8Array(await readFile(pdf)),projectName:'Public bed — native assembly prototype'}));
 await call('view_sheet',{sheet,region:{x0:2490,y0:710,x1:3070,y1:1140},overlay:true,px:1400},'mcp-bed.png');
 await call('export_marked_pdf',{path:resolve(out,'public-bed-marked.pdf')});
 // Reverse label, derived edge, and material rows: no change to the original project.
 await call('undo_last');await call('undo_last');await call('undo_last');
 await call('export_takeoff',{path:resolve(out,'undo.json')});const undone=await read(resolve(out,'undo.json'));
 // Native derive_base Undo removes its run but retains the newly minted empty condition.
 const originalOnly={...undone,conditions:undone.conditions.filter(x=>before.conditions.some(b=>b.id===x.id))};assert.deepEqual(originalOnly,before);
 const invalid=await c.callTool({name:'derive_base',arguments:{source_condition:'BED-C1',condition:'INVALID-EDGE',openings:[{shape_id:bed.id,lf:48.17}]}});assert.ok(invalid.isError);
 assert.match(JSON.stringify(invalid),/meet or exceed/);
 log.push({tool:'derive_base',negative_case:'openings meet the entire perimeter',isError:true,result:scrub(invalid)});
 await call('export_takeoff',{path:resolve(out,'negative.json')});assert.deepEqual(await read(resolve(out,'negative.json')),undone);
 await writeFile(resolve(out,'transcript.json'),JSON.stringify(log,null,2)+'\n');
 await writeFile(resolve(out,'checks.json'),JSON.stringify({original_shapes_unchanged:7,original_conditions_preserved:5,new_pending_edge:edgeId,source_area_sf:110.5,source_plant_ea:127,each_layer_cy:Math.round(110.5/81*100)/100,edging_lf:48.17,undo_existing_records_exact:true,undo_retains_empty_new_condition:true,invalid_openings_rejected_without_mutation:true,materials:report.materials},null,2)+'\n');
 console.log('PASS: original seven shapes unchanged; 127 EA, 110.5 SF, 1.36 CY per layer, 48.17 LF new pending edging; Undo restores existing records and retains empty new tag; invalid openings rejected.');
}finally{await c.close();}

// Add only the seven visually verified public C2 source rows through fork MCP.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const require=createRequire(resolve(repo,'mcp/package.json'));
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const [planArg,baseArg,outArg]=process.argv.slice(2);
assert.ok(planArg&&baseArg&&outArg,'node record.mjs SOURCE_L1.0.pdf BASELINE.json OUTPUT_DIR');
const plan=resolve(planArg),basePath=resolve(baseArg),out=resolve(outArg);
const base=JSON.parse(await readFile(basePath,'utf8'));
const source=JSON.parse(await readFile(new URL('./source.json',import.meta.url),'utf8'));
await mkdir(out,{recursive:true});
const client=new Client({name:'public-mixed-bed-callouts',version:'1'});
const transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx','server.ts'],cwd:resolve(repo,'mcp'),stderr:'pipe'});
let stderr='';transport.stderr?.on('data',c=>stderr+=c);
const transcript=[];
function scrub(value){let json=JSON.stringify(value);for(const [path,label]of[[plan,'<SOURCE_PDF>'],[basePath,'<BASELINE_JSON>'],[out,'<OUTPUT_DIR>']])json=json.replaceAll(JSON.stringify(path).slice(1,-1),label);return JSON.parse(json);}
async function call(name,args={},imageName){
 const r=await client.callTool({name,arguments:args});
 const data=r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
 transcript.push({tool:name,arguments:scrub(args),isError:!!r.isError,result:scrub(data)});
 assert.ok(!r.isError,JSON.stringify(data));
 if(imageName)await writeFile(resolve(out,imageName),Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));
 return data;
}
try{
 await client.connect(transport);
 const wiki=await client.readResource({uri:'takeoff://wiki'});await writeFile(resolve(out,'wiki.txt'),wiki.contents[0].text);
 await call('load_plan',{path:plan});await call('import_takeoff',{path:basePath});
 const imported=await call('export_takeoff');
 for(const field of ['shapes','conditions','sheets','markups','proposals','rfis'])assert.deepEqual(imported[field]??[],base[field]??[],`baseline ${field}`);
 const area=base.shapes.find(s=>s.id===source.bed_id);assert.ok(area);assert.notEqual(area.origin?.reviewed,true,'Do not change reviewed work');
 assert.equal(base.shapes.find(s=>s.id===source.existing_SET_id).computed.count,58);
 assert.ok(source.rows.every(r=>!base.conditions.some(c=>c.finish_tag===r.code)),'This replay expects the seven new codes to be absent');
 await call('open_suite',{suite:'planting'});
 await call('propose_takeoff',{label:'C2 mixed-bed printed quantities',rationale:'Public L1.0 east group: ACD 26, CPE 24, CPN 24, ERA 24, HAC 24, PHD 26, POR 26. Existing SET 58 remains. Each anchor identifies printed text, not an individual plant. Shared bed extent is provisional; no grid or species allocation inferred.'});
 const inputs=source.rows.map(row=>({sheet:source.sheet,condition:row.code,quantity:row.quantity,unit:'EA',at:row.at,source_id:`C2-${row.code}`,text:row.text,reference:`L1.0 / C2 east shared bed / ${row.code} row in group ending 58 SET / Bid Alternate 2 / Addendum 1, 02.11.2026`}));
 const created=[];for(const input of inputs)created.push(await call('record_callout_quantity',input));
 const beforeRetry=await call('export_takeoff');
 for(let i=0;i<inputs.length;i++){const retry=await call('record_callout_quantity',inputs[i]);assert.equal(retry.created,false);assert.equal(retry.shape_id,created[i].shape_id);}
 assert.deepEqual(await call('export_takeoff'),beforeRetry,'Identical retries must not duplicate or mutate');
 await call('edit_shape',{shape_id:area.id,source_callout_ids:[...created.map(r=>r.shape_id),...area.source_callout_ids]});
 const exported=await call('export_takeoff');
 for(const prior of base.shapes){const next=exported.shapes.find(s=>s.id===prior.id);assert.ok(next);if(prior.id===area.id){assert.deepEqual({...next,source_callout_ids:prior.source_callout_ids,origin:prior.origin},prior,'Bed geometry, counts and IDs exact');assert.deepEqual(next.origin,{...prior.origin,agent_edits:(prior.origin.agent_edits??0)+1});}else assert.deepEqual(next,prior,'Existing source/measurement exact');}
 for(const prior of base.conditions)assert.deepEqual(exported.conditions.find(c=>c.id===prior.id),prior);
 for(const field of ['sheets','markups','rfis'])assert.deepEqual(exported[field]??[],base[field]??[]);
 for(const prior of base.proposals)assert.deepEqual(exported.proposals.find(p=>p.id===prior.id),prior);
 assert.equal(exported.shapes.length,base.shapes.length+7);
 assert.ok(created.every(r=>exported.shapes.find(s=>s.id===r.shape_id).origin.reviewed===false));
 // The MCP export does not carry browser workspace tabs. Keep those original
 // top-level fields; takeoff records themselves are the tool's exact output.
 const payload={...base,...Object.fromEntries(['shapes','conditions','sheets','markups','rfis','proposals'].map(k=>[k,exported[k]??base[k]]))};
 await writeFile(resolve(out,'takeoff.json'),JSON.stringify(payload,null,2)+'\n');
 const summary=await call('takeoff_summary');
 for(const row of source.rows){const c=summary.conditions.find(c=>c.finish_tag===row.code);assert.equal(c.ea,row.quantity);assert.deepEqual(c.count_basis,{located_ea:0,printed_ea:row.quantity});}
 assert.equal(summary.conditions.find(c=>c.finish_tag==='SET').ea,185);
 await call('export_report',{path:resolve(out,'report.json'),project_name:'Public C2 mixed-bed callouts — partial scope, pending review'});
 await call('view_sheet',{sheet:source.sheet,region:{x0:3390,y0:1160,x1:3990,y1:1470},px:1500,overlay:true},'source-overlay.png');
 await call('export_marked_pdf',{path:resolve(out,'marked.pdf'),project_name:'Public C2 mixed-bed callouts — partial scope, pending review'});
 await call('load_plan',{path:plan});await call('import_takeoff',{path:resolve(out,'takeoff.json')});
 const reopened=await call('export_takeoff');for(const key of ['shapes','conditions','sheets','markups','rfis','proposals'])assert.deepEqual(reopened[key]??[],payload[key]??[],`MCP reopen ${key}`);
 await writeFile(resolve(out,'results.json'),JSON.stringify({existing_records:base.shapes.length,new_records:7,total_records:payload.shapes.length,new_printed_ea:174,C2_printed_ea:232,SET_total_ea:185,existing_conditions_exact:true,existing_measurements_exact_except_bed_links_and_agent_edit_counter:true,existing_geometry_quantities_reviews_exact:true,idempotent_retry:true,mcp_reopen_exact:true,created:created.map((r,i)=>({code:source.rows[i].code,quantity:source.rows[i].quantity,shape_id:r.shape_id}))},null,2)+'\n');
 console.log('Recorded seven source quantities; linked eight sources; existing geometry/counts/reviews preserved.');
}finally{await writeFile(resolve(out,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');await writeFile(resolve(out,'stderr.txt'),stderr);await client.close();}

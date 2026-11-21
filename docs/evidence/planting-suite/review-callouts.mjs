// Upgrade only the two public source quantities through the real MCP tools.
// Preserve the baseline's three tree IDs, locations and review decisions.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(repo, 'mcp/package.json'));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const [planArg, outArg] = process.argv.slice(2);
assert.ok(planArg && outArg, 'node review-callouts.mjs SOURCE.pdf OUTPUT_DIR');
const plan = resolve(planArg), out = resolve(outArg);
const baselinePath = resolve(repo,'docs/evidence/planting-suite/results/takeoff.json');
const baseline = JSON.parse(await readFile(baselinePath,'utf8'));
const manifest = JSON.parse(await readFile(new URL('./source.json',import.meta.url),'utf8'));
await mkdir(out,{recursive:true});
const client = new Client({name:'public-callout-review-evidence',version:'1'});
const transport = new StdioClientTransport({command:process.execPath,args:['--import','tsx','server.ts'],cwd:resolve(repo,'mcp'),stderr:'pipe'});
let stderr=''; transport.stderr?.on('data',c=>{stderr+=c;});
const transcript=[];
function scrub(value) {
  let json=JSON.stringify(value);
  for(const [path,label] of [[plan,'<SOURCE_PDF>'],[out,'<OUTPUT_DIR>'],[baselinePath,'<BASELINE_JSON>']]) json=json.replaceAll(path.replaceAll('\\','\\\\'),label);
  return JSON.parse(json);
}
async function call(name,args={},imageName) {
  const reply=await client.callTool({name,arguments:args});
  const raw=reply.content.find(c=>c.type==='text')?.text;
  let data=reply.structuredContent;
  if (!data) { try { data=JSON.parse(raw); } catch { data={message:raw}; } }
  transcript.push({tool:name,arguments:scrub(args),isError:!!reply.isError,result:scrub(data)});
  assert.ok(!reply.isError,`${name}: ${JSON.stringify(data)}`);
  if(imageName) {
    const image=reply.content.find(c=>c.type==='image'); assert.ok(image);
    await writeFile(resolve(out,imageName),Buffer.from(image.data,'base64'));
  }
  return data;
}
try {
  await client.connect(transport);
  const wiki=await client.readResource({uri:'takeoff://wiki'});
  await writeFile(resolve(out,'wiki.txt'),wiki.contents[0].text);
  const loaded=await call('load_plan',{path:plan});
  assert.equal(loaded.sheets[0].width_px,5184); assert.equal(loaded.sheets[0].height_px,3456);
  await call('import_takeoff',{path:baselinePath});
  const imported=await call('export_takeoff');
  for(const field of ['shapes','conditions','sheets','markups','proposals']) assert.deepEqual(imported[field],baseline[field],`baseline ${field}`);
  await call('open_suite',{suite:'planting'});
  const sheet='ccfp-L1.0.pdf';
  await call('view_sheet',{sheet,region:{x0:240,y0:1680,x1:1710,y1:1790},px:1600},'schedule-set.png');
  await call('propose_takeoff',{label:'SET printed bed quantities - Bid Alternate 2',rationale:'L1.0 Addendum 1, 02.11.2026. Visually read 127 SET and 58 SET; Sedum ternatum / Wild Stonecrop, 1 Gal., 12-inch o.c. Schedule 185 EA. Source anchors, not individual plant locations. Existing tree counts are unchanged.'});
  const args=manifest.rows.find(r=>r.code==='SET').printed_callouts.map(c=>({sheet,condition:'SET',quantity:c.qty,unit:'EA',at:c.at,source_id:c.id,text:`${c.qty} - SET`,reference:`L1.0 / ${c.id} / ${c.id==='C1'?'west':'east'} bed / Bid Alternate 2 / Addendum 1, 02.11.2026`}));
  const created=[];
  for(const a of args) created.push(await call('record_callout_quantity',a));
  const beforeRetry=await call('export_takeoff');
  for(let i=0;i<args.length;i++) {
    const retry=await call('record_callout_quantity',args[i]);
    assert.equal(retry.created,false); assert.equal(retry.shape_id,created[i].shape_id);
  }
  assert.deepEqual(await call('export_takeoff'),beforeRetry,'Repeated source recording is nonmutating');
  // Update only generated note text that described the old notes-only model.
  for (const c of args) {
    const note=baseline.markups.find(m=>m.text?.startsWith(`${c.source_id}: ${c.quantity} SET.`));
    assert.ok(note);
    await call('edit_annotation',{annotation_id:note.id,text:`${c.source_id}: ${c.quantity} SET. Printed quantity recorded for review; source anchor only, individual plants not located.`});
  }
  const payload=await call('export_takeoff',{path:resolve(out,'takeoff.json')});
  assert.equal(payload.shapes.length,5);
  assert.deepEqual(payload.shapes.filter(s=>!s.quantity_source),baseline.shapes,'Existing tree records exact');
  assert.deepEqual(payload.conditions,baseline.conditions,'Existing conditions exact');
  assert.deepEqual(payload.sheets,baseline.sheets,'Calibration exact');
  for(const note of baseline.markups) {
    const current=payload.markups.find(m=>m.id===note.id);
    assert.deepEqual({...current,text:note.text},note,'Note IDs, geometry and extensions exact');
  }
  assert.ok(payload.shapes.every(s=>s.origin.reviewed===false));
  const summary=await call('takeoff_summary');
  const rows=Object.fromEntries(summary.conditions.map(c=>[c.finish_tag,c]));
  assert.equal(rows.GDI.ea,1); assert.equal(rows.TAM.ea,2); assert.equal(rows.SET.ea,185);
  assert.deepEqual(rows.SET.count_basis,{located_ea:0,printed_ea:185});
  await call('list_shapes',{condition:'SET'});
  await call('export_report',{path:resolve(out,'report.json'),project_name:'Public planting sample - 3 located trees and 185 printed SET'});
  for(const [name,region] of [['west',{x0:2350,y0:620,x1:2970,y1:1060}],['east',{x0:3440,y0:1090,x1:4090,y1:1550}]]) {
    await call('view_sheet',{sheet,region,px:1600,overlay:true},`${name}-callout.png`);
  }
  await call('export_marked_pdf',{path:resolve(out,'marked.pdf'),project_name:'Public planting sample - partial scope, pending review'});
  await call('load_plan',{path:plan});
  await call('import_takeoff',{path:resolve(out,'takeoff.json')});
  const reopened=await call('export_takeoff');
  for(const field of ['shapes','conditions','sheets','markups','proposals']) assert.deepEqual(reopened[field],payload[field],`reload ${field}`);
  const result={base_commit:'99f83814d18852adb389182f179377f939e40164',baseline_shape_ids:baseline.shapes.map(s=>s.id),preserved_existing_records:true,new_callout_ids:created.map(c=>c.shape_id),located_ea:{GDI:1,TAM:2,SET:0},printed_ea:{SET:185},source_arithmetic:'127 + 58 = 185',schedule_SET_ea:185,shape_records:5,pending_review:5,idempotent_retry:true,reopen_exact:['shapes','conditions','sheets','markups','proposals'],browser_test:'unverified: Computer Use stopped at URL verification'};
  await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {
  await writeFile(resolve(out,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');
  await writeFile(resolve(out,'server-stderr.txt'),stderr);
  await client.close();
}

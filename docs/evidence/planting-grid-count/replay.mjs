// Actual stdio MCP workflow; public source, existing browser baseline, no company helpers.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const require=createRequire(resolve(repo,'mcp/package.json'));
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const [planArg,outArg]=process.argv.slice(2);
assert.ok(planArg&&outArg,'node replay.mjs SOURCE.pdf OUTPUT_DIR');
const plan=resolve(planArg),out=resolve(outArg);
await mkdir(out,{recursive:true});
const baselinePath=resolve(repo,'docs/evidence/planting-grid-count/baseline.json');
const baseline=JSON.parse(await readFile(baselinePath,'utf8'));
const bed=baseline.shapes.find(s=>s.label==='C1 SET hatch'); assert.ok(bed);
const config={source_callout_id:bed.source_callout_ids[0],single_species:true,spacing_ft:1,pattern:'square',angle_deg:0,inset_ft:0,offset_x_ft:.5,offset_y_ft:.5,origin_norm:bed.verts_norm[0],reference:'L1.0 SET: 12 in o.c.; square pattern, 0 deg, 6 in shifts, no edge clearance assumed.'};
const client=new Client({name:'public-planting-grid',version:'1'});
const transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx','server.ts'],cwd:resolve(repo,'mcp'),stderr:'pipe'});
const transcript=[];
const scrub=v=>JSON.parse(JSON.stringify(v).replaceAll(plan.replaceAll('\\','\\\\'),'<PUBLIC_SOURCE>').replaceAll(out.replaceAll('\\','\\\\'),'<OUTPUT>').replaceAll(baselinePath.replaceAll('\\','\\\\'),'<BASELINE>'));
async function call(name,args={},imageName) {
  const r=await client.callTool({name,arguments:args}); assert.ok(!r.isError,JSON.stringify(r));
  const result=r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
  transcript.push({tool:name,arguments:scrub(args),result:scrub(result)});
  if(imageName) await writeFile(resolve(out,imageName),Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));
  return result;
}
try {
  await client.connect(transport);
  await client.readResource({uri:'takeoff://wiki'});
  await call('load_plan',{path:plan});
  await call('import_takeoff',{path:baselinePath});
  const square=await call('edit_shape',{shape_id:bed.id,planting_grid:config}); assert.equal(square.grid_count,110);
  const triangular=await call('edit_shape',{shape_id:bed.id,planting_grid:{...config,pattern:'triangular',reference:config.reference.replace('square','triangular')}}); assert.equal(triangular.grid_count,129);
  await call('undo_last',{});
  await call('view_sheet',{sheet:bed.sheet_id,overlay:true,region:{x0:2770,y0:925,x1:3020,y1:1090},px:1400},'grid-overlay.png');
  await call('export_takeoff',{path:resolve(out,'takeoff.json')});
  await call('export_report',{path:resolve(out,'report.json')});
  const saved=JSON.parse(await readFile(resolve(out,'takeoff.json'),'utf8'));
  const withoutGrid=structuredClone(saved.shapes);
  delete withoutGrid.find(s=>s.id===bed.id).planting_grid;
  assert.deepEqual(withoutGrid,baseline.shapes);
  for(const key of ['conditions','sheets','markups','proposals']) assert.deepEqual(saved[key],baseline[key]);
  await writeFile(resolve(out,'config.json'),JSON.stringify(config,null,2)+'\n');
  await writeFile(resolve(out,'results.json'),JSON.stringify({printed_ea:127,square_grid:110,square_difference:-17,triangular_grid:129,triangular_difference:2,final_pattern:'square',records:7,all_existing_record_fields_exact_except_added_grid:true,all_existing_review_decisions_preserved:true,bed_id:bed.id,source_id:config.source_callout_id,source_spacing:'L1.0 / SET / 12 in o.c.',assumptions:'Patterns, angle, shifts and clearance are trial assumptions. No tuning or quantity adoption.'},null,2)+'\n');
  await writeFile(resolve(out,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');
  console.log('PASS: square 110, triangular 129, printed 127; seven original records preserved; final square grid metadata only.');
} finally {await client.close();}

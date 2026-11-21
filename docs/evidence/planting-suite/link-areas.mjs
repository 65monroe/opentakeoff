// Public source-assisted area tracing through the actual MCP transport.
// Original source records are immutable inputs; only new areas receive links.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const require=createRequire(resolve(repo,'mcp/package.json'));
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const [planArg,baselineArg,outArg]=process.argv.slice(2);
assert.ok(planArg&&baselineArg&&outArg,'node link-areas.mjs SOURCE.pdf BASELINE.json OUTPUT_DIR');
const plan=resolve(planArg),baselinePath=resolve(baselineArg),out=resolve(outArg);
const baseline=JSON.parse(await readFile(baselinePath,'utf8'));
await mkdir(out,{recursive:true});
const client=new Client({name:'public-planting-area-evidence',version:'1'});
const transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx','server.ts'],cwd:resolve(repo,'mcp'),stderr:'pipe'});
let stderr=''; transport.stderr?.on('data',c=>{stderr+=c;});
const transcript=[];
const scrub=value=>JSON.parse(JSON.stringify(value).replaceAll(JSON.stringify(plan).slice(1,-1),'<SOURCE_PDF>').replaceAll(JSON.stringify(baselinePath).slice(1,-1),'<BASELINE_JSON>').replaceAll(JSON.stringify(out).slice(1,-1),'<OUTPUT_DIR>'));
async function call(name,args={},imageName) {
  const r=await client.callTool({name,arguments:args});
  const data=r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
  transcript.push({tool:name,arguments:scrub(args),isError:!!r.isError,result:scrub(data)});
  assert.ok(!r.isError,JSON.stringify(data));
  if(imageName) await writeFile(resolve(out,imageName),Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));
  return data;
}
const beds=[
  {id:'C1',condition:'BED-C1',label:'C1 SET hatch',verts:[[2817,967.5],[2951.5,1007],[2878,1034],[2808,1022.5]],arc_through:[2],note:'SET-only herringbone region at the 127 SET leader. Curved south boundary traced with an arc; no individual plant positions inferred.',region:{x0:2480,y0:730,x1:3080,y1:1160}},
  {id:'C2',condition:'BED-C2',label:'C2 shared bed; north edge approximate',verts:[[3449,1233],[3532,1233],[3532,1315],[3561,1342],[3525,1373],[3514,1426],[3449,1466]],arc_through:[4],note:'Shared mixed-species hatch at the leader for the list ending 58 SET. Excludes the separate herringbone pocket to the east. North edge is provisional beneath shrub/furnishing symbols; verify its extent before using SF. The outline does not allocate the bed among species.',region:{x0:3380,y0:1170,x1:3890,y1:1520}},
];
try {
  await client.connect(transport);
  const wiki=await client.readResource({uri:'takeoff://wiki'});
  await writeFile(resolve(out,'wiki.txt'),wiki.contents[0].text);
  const loaded=await call('load_plan',{path:plan});
  assert.equal(loaded.sheets[0].width_px,5184); assert.equal(loaded.sheets[0].height_px,3456);
  await call('import_takeoff',{path:baselinePath});
  const sheet='ccfp-L1.0.pdf';
  for(const bed of beds) {
    const source=baseline.shapes.find(s=>s.quantity_source?.id===bed.id);
    assert.ok(source);
    await call('propose_takeoff',{label:bed.label,rationale:`Public L1.0 / ${bed.id} / Bid Alternate 2. ${bed.note} Existing ${source.computed.count} EA source is unchanged. Area SF is independent; pending review.`});
    const area=await call('measure_polygon',{sheet,condition:bed.condition,role:'floor_area',verts:bed.verts,arc_through:bed.arc_through});
    await call('edit_shape',{shape_id:area.shape_id,label:bed.label,source_callout_ids:[source.id]});
    await call('view_sheet',{sheet,region:bed.region,overlay:true,px:1400},`${bed.id.toLowerCase()}-area-overlay.png`);
  }
  const payload=await call('export_takeoff',{path:resolve(out,'takeoff.json')});
  const saved=JSON.parse(await readFile(resolve(out,'takeoff.json'),'utf8'));
  for(const original of baseline.shapes) assert.deepEqual(saved.shapes.find(s=>s.id===original.id),original);
  for(const original of baseline.conditions) assert.deepEqual(saved.conditions.find(c=>c.id===original.id),original);
  assert.deepEqual(saved.sheets,baseline.sheets);
  assert.deepEqual(saved.markups,baseline.markups);
  assert.equal(saved.shapes.length,baseline.shapes.length+2);
  const report=await call('export_report',{path:resolve(out,'report.json')});
  await call('export_marked_pdf',{path:resolve(out,'marked.pdf')});
  await writeFile(resolve(out,'source-traces.json'),JSON.stringify({sheet,coordinates:'full-sheet image pixels; 5184 x 3456',beds},null,2)+'\n');
  await writeFile(resolve(out,'results.json'),JSON.stringify({existing_records_exact:true,existing_conditions_exact:true,calibration_exact:true,annotations_exact:true,new_areas:saved.shapes.filter(s=>s.source_callout_ids),review_note:'All source decisions preserved; new areas pending; source-assisted approximate boundaries, not a grid count',browser_test:'Separate actual browser test required'},null,2)+'\n');
  await writeFile(resolve(out,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');
  console.log(JSON.stringify({records:saved.shapes.length,source_records_unchanged:true,new_areas:saved.shapes.filter(s=>s.source_callout_ids).map(s=>({id:s.id,label:s.label,computed:s.computed}))}));
} finally { await client.close(); await writeFile(resolve(out,'server-stderr.txt'),stderr); }

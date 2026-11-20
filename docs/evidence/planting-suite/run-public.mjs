// Replay fresh, visually checked source coordinates through the real stdio MCP
// server. This is not an automatic plant detector or a blind accuracy test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(repo, 'mcp/package.json'));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const [planArg, outArg, serverRootArg] = process.argv.slice(2);
assert.ok(planArg && outArg, 'node run-public.mjs SOURCE.pdf OUTPUT_DIR [SERVER_REPOSITORY_ROOT]');
const plan = resolve(planArg), out = resolve(outArg), serverRoot = resolve(serverRootArg ?? repo);
await mkdir(out, { recursive: true });
const source = JSON.parse(await readFile(new URL('./source.json', import.meta.url), 'utf8'));
const sheet = 'ccfp-L1.0.pdf';
const client = new Client({ name: 'planting-public-plan-evidence', version: '1' });
const transcript = [];
const transport = new StdioClientTransport({command:process.execPath,args:['--import','tsx','server.ts'],cwd:resolve(serverRoot,'mcp'),stderr:'pipe'});
let stderr = '';
transport.stderr?.on('data', c => { stderr += c; });
await client.connect(transport);
function scrub(value) {
  return JSON.parse(JSON.stringify(value).replaceAll(plan.replaceAll('\\','\\\\'), '<SOURCE_PDF>').replaceAll(out.replaceAll('\\','\\\\'), '<OUTPUT_DIR>'));
}
async function call(name, args = {}, { allowError = false, image } = {}) {
  const reply = await client.callTool({name,arguments:args});
  const data = reply.structuredContent ?? JSON.parse(reply.content.find(c=>c.type==='text').text);
  transcript.push({tool:name,arguments:scrub(args),isError:!!reply.isError,result:scrub(data)});
  if (!allowError) assert.ok(!reply.isError, `${name}: ${JSON.stringify(data)}`);
  if (image) {
    const img = reply.content.find(c=>c.type==='image');
    assert.ok(img, `${name} returned an image`);
    await writeFile(resolve(out,image), Buffer.from(img.data,'base64'));
  }
  return data;
}
try {
  const wiki = await client.readResource({uri:'takeoff://wiki'});
  await writeFile(resolve(out,'wiki.txt'),wiki.contents[0].text);
  const catalog = await call('open_suite');
  const hasPlanting = catalog.catalog.some(s=>s.id==='planting');
  const loaded = await call('load_plan',{path:plan});
  assert.equal(loaded.sheets[0].width_px,5184);
  assert.equal(loaded.sheets[0].height_px,3456);
  const empty = await call('export_takeoff');
  if (hasPlanting) {
    const names = (await client.listTools()).tools.map(t=>t.name).sort();
    const opened = await call('open_suite',{suite:'planting'});
    assert.deepEqual(opened.tools_enabled,[]);
    await call('open_suite',{division:'32'});
    assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),names);
    assert.deepEqual(await call('export_takeoff'),empty);
  } else await call('open_suite',{division:'32'},{allowError:true});
  const text = await call('read_sheet_text',{sheet});
  // This source's planting lettering is outlines: preserve the limitation.
  const schedule = await call('find_schedule',{kind:'planting'},{allowError:true});
  for (const [name,region] of [
    ['schedule-trees',{x0:200,y0:35,x1:1740,y1:430}],
    ['schedule-set',{x0:240,y0:1680,x1:1710,y1:1790}],
    ['source-trees',{x0:400,y0:2160,x1:1420,y1:3030}],
    ['source-callout-west',{x0:2450,y0:710,x1:2860,y1:960}],
    ['source-callout-east',{x0:3540,y0:1190,x1:3970,y1:1450}],
    ['scale',{x0:4190,y0:3160,x1:4590,y1:3350}],
  ]) await call('view_sheet',{sheet,region,px:1600},{image:`${name}.png`});
  await call('set_scale',{sheet,upp:source.scale.upp});
  for (const row of source.rows.filter(r=>r.located_points.length)) {
    await call('propose_takeoff',{label:`${row.code} - Bid Alternate 2`,rationale:`L1.0 Addendum 1, 02.11.2026; Plant Schedule / ${row.code}: ${row.botanical} / ${row.common}; ${row.size}; ${row.remarks}; schedule ${row.schedule_qty} EA. Individually located parking-island symbols. Their quantity callout is corroboration, not additional EA.`});
    await call('place_count',{sheet,condition:row.code,points:row.located_points});
    // Source metadata in an existing condition-linked note, not invented spec fields.
    await call('annotate',{sheet,condition:row.code,type:'text',at:row.code==='GDI'?[1550,2460]:[1550,2590],text:`${row.code}: ${row.common}; ${row.size}. L1.0 schedule ${row.schedule_qty} EA. Individually located; Alternate 2.`});
  }
  await call('annotate',{sheet,condition:'SET',type:'callout',at:[1810,390],target:[2555,775],text:'C1: 127 SET. Printed callout only; excluded from measured EA.'});
  await call('annotate',{sheet,condition:'SET',type:'callout',at:[3900,1480],target:[3820,1398],text:'C2: 58 SET. Printed callout only; excluded from measured EA.'});
  await call('annotate',{sheet,condition:'SET',type:'text',at:[1810,470],text:'SET: Sedum ternatum / Wild Stonecrop; 1 Gal.; 12-inch o.c. L1.0 Plant Schedule / SET: 185 EA. C1 + C2 = 185 printed EA; no individual locations counted. Bid Alternate 2.'});
  const payload = await call('export_takeoff',{path:resolve(out,'takeoff.json')});
  const summary = await call('takeoff_summary');
  const report = await call('export_report',{path:resolve(out,'report.json'),project_name:'Public planting sample - GDI, TAM, SET only'});
  const actual = Object.fromEntries(summary.conditions.map(c=>[c.finish_tag,c.ea]));
  assert.equal(actual.GDI,1); assert.equal(actual.TAM,2); assert.equal(actual.SET,0);
  assert.equal(payload.shapes.length,3,'No marker for a printed bed quantity or duplicate tree callout');
  assert.ok(payload.shapes.every(s=>s.origin.reviewed===false));
  assert.equal(source.rows[2].printed_callouts.reduce((n,c)=>n+c.qty,0),185);
  if(hasPlanting) {
    await call('open_suite',{suite:'planting'});
    assert.deepEqual(await call('export_takeoff'),payload,'Reopening the suite does not duplicate or alter work');
  }
  await call('view_sheet',{sheet,region:{x0:400,y0:2160,x1:1420,y1:3030},px:1600,overlay:true},{image:'measured-trees.png'});
  await call('view_sheet',{sheet,px:2000,overlay:true},{image:'marked-overview.png'});
  await call('export_marked_pdf',{path:resolve(out,'marked.pdf'),project_name:'Public planting workflow sample - partial scope, pending review'});
  await call('load_plan',{path:plan});
  await call('import_takeoff',{path:resolve(out,'takeoff.json')});
  const reopened = await call('export_takeoff');
  for(const field of ['sheets','shapes','conditions','markups','proposals']) assert.deepEqual(reopened[field],payload[field],`${field} preserved on reopen`);
  const again=await call('takeoff_summary');
  assert.deepEqual(again.conditions.map(c=>[c.finish_tag,c.ea]),summary.conditions.map(c=>[c.finish_tag,c.ea]));
  const result={suite_available:hasPlanting,core_tools:(await client.listTools()).tools.length,measured_ea:actual,printed_callout_ea:{SET:185},schedule_ea:{GDI:1,TAM:2,SET:185},shape_count:3,pending_review:3,reopen_exact:['sheets','shapes','conditions','markups','proposals'],text_items:text.items.length,planting_schedule_reader:schedule,scale_unconfirmed:summary.scale_unconfirmed};
  await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {
  await writeFile(resolve(out,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');
  await writeFile(resolve(out,'server-stderr.txt'),stderr);
  await client.close();
}

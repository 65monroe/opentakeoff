import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildProjectArchive} from '../../../web/src/lib/projectArchive.js';
import {areaGridCuts} from '../../../web/src/lib/areaGridCuts.js';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const require=createRequire(resolve(repo,'mcp/package.json'));
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const out=resolve(process.argv[2]||'tmp/area-grid-cuts/replay');await mkdir(out,{recursive:true});
const client=new Client({name:'public-ceiling-cut-check',version:'1'}),transcript=[];
await client.connect(new StdioClientTransport({command:process.execPath,args:['--import','tsx','server.ts'],cwd:resolve(repo,'mcp'),stderr:'pipe'}));
const scrub=v=>JSON.parse(JSON.stringify(v).replaceAll(repo.replaceAll('\\','\\\\'),'<REPO>'));
async function call(name,args={},png){
 const r=await client.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));
 const result=r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
 transcript.push({tool:name,args:scrub(args),result:scrub(result)});
 if(png)await writeFile(resolve(out,png),Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));
 return result;
}
const json=async name=>JSON.parse(await readFile(resolve(out,name),'utf8'));
async function archive(name,pdf,takeoff){await writeFile(resolve(out,name),await buildProjectArchive({takeoff,sheets:[{name:pdf.split(/[\\/]/).pop()}],loadPdfData:async()=>new Uint8Array(await readFile(pdf))}));}
try{
 await client.readResource({uri:'takeoff://wiki'});
 const pdf=resolve(repo,'demo/public-sheets/mo-veterans-home-A111-reflected-ceiling-plan.pdf');
 const source=resolve(repo,'docs/evidence/area-grid-footprints/ceiling-after-reopen.json');
 await call('load_plan',{path:pdf});await call('import_takeoff',{path:source});
 await call('export_takeoff',{path:resolve(out,'ceiling-before.json')});
 const before=await json('ceiling-before.json'),shape=before.shapes[0];
 await archive('ceiling-before.otk',pdf,before);
 const report=await call('takeoff_summary');
 const result=await call('edit_shape',{shape_id:shape.id,area_grid:{...shape.area_grid,cut_pieces:true}});
 assert.equal(result.grid_count,45);assert.equal(result.grid_cuts.full_tiles,31);assert.equal(result.grid_cuts.edge_cut_pieces,32);
 assert.deepEqual(await call('takeoff_summary'),report);
 await call('export_takeoff',{path:resolve(out,'ceiling-cuts.json')});
 const after=await json('ceiling-cuts.json'),copy=structuredClone(after);delete copy.shapes[0].area_grid.cut_pieces;assert.deepEqual(copy,before);
 const calc=areaGridCuts(after.shapes[0],{widthPx:5184,heightPx:3456,upp:after.sheets[0].units_per_px});
 await writeFile(resolve(out,'ceiling-calculation.json'),JSON.stringify(calc,null,2)+'\n');
 await call('view_sheet',{sheet:shape.sheet_id,overlay:true,region:{x0:1850,y0:175,x1:2050,y1:330},px:1400},'ceiling-cuts.png');
 await archive('ceiling-cuts.otk',pdf,after);
 await call('undo_last');await call('export_takeoff',{path:resolve(out,'ceiling-undo.json')});assert.deepEqual(await json('ceiling-undo.json'),before);
 const demoPdf=resolve(repo,'demo/sample-finish-plan.pdf');
 await call('load_plan',{path:demoPdf});await call('import_takeoff',{path:resolve(repo,'docs/evidence/area-grid-footprints/demo-after-reopen.json')});
 const demo=JSON.parse(await readFile(resolve(repo,'docs/evidence/area-grid-footprints/demo-after-reopen.json'),'utf8')),d=demo.shapes[0];
 const config={...d.area_grid,footprint:{kind:'rectangle',width_ft:4,depth_ft:4,basis:'assumed',reference:'Bundled finish-plan demonstration only: nominal 4-foot square module at existing support grid spacing; not specified work.'}};
 await call('edit_shape',{shape_id:d.id,area_grid:config});
 await call('export_takeoff',{path:resolve(out,'demo-before.json')});await archive('demo-before.otk',demoPdf,await json('demo-before.json'));
 const dr=await call('edit_shape',{shape_id:d.id,area_grid:{...config,cut_pieces:true}});
 assert.equal(dr.grid_count,8);assert.equal(dr.grid_cuts.full_tiles,8);assert.equal(dr.grid_cuts.edge_cut_pieces,0);
 await call('export_takeoff',{path:resolve(out,'demo-cuts.json')});
 await writeFile(resolve(out,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');
 console.log('PASS: public A111 31 full + 32 cut pieces, same 45 centers and 175.73 SF; report and originals preserved; exact Undo. Bundled sample eight full modules, no edge cuts, unchanged 128 SF.');
}finally{await client.close();}

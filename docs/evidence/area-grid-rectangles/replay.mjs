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
const out=resolve(process.argv[2]||'tmp/area-grid-rectangles/replay');await mkdir(out,{recursive:true});
const client=new Client({name:'public-rectangular-module-check',version:'1'}),transcript=[];
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
const unchanged=(before,after)=>{const copy=structuredClone(after);copy.shapes[0].area_grid=before.shapes[0].area_grid;assert.deepEqual(copy,before);};
try{
 await client.readResource({uri:'takeoff://wiki'});
 const pdf=resolve(repo,'demo/public-sheets/mo-veterans-home-A111-reflected-ceiling-plan.pdf');
 await call('load_plan',{path:pdf});await call('import_takeoff',{path:resolve(repo,'docs/evidence/area-grid-cuts/ceiling-after-reopen.json')});
 await call('export_takeoff',{path:resolve(out,'ceiling-before.json')});
 const before=await json('ceiling-before.json'),shape=before.shapes[0],report=await call('takeoff_summary');
 await archive('ceiling-before.otk',pdf,before);
 const expected=JSON.parse(await readFile(new URL('expected.json',import.meta.url),'utf8'));
 for(const angle of [0,90]){
   const config={...shape.area_grid,pattern:'rectangular',spacing_y_ft:4,angle_deg:angle,reference:`Public A111 assumed 2-by-4 alternative at ${angle} degrees, not the inferred 2-by-2 bay layout. Same boundary, origin, 1-foot shifts and zero clearance; no quantity adoption.`,footprint:{...shape.area_grid.footprint,depth_ft:4,basis:'assumed',reference:'Nominal 2-by-4-foot alternative; A111 legend allows 2-by-2 or 2-by-4, but this bay was previously inferred as 2-by-2. Physical face, joints and specified orientation unverified.'}};
   const result=await call('edit_shape',{shape_id:shape.id,area_grid:config});
   const exp=expected.cases.find(c=>c.angle_deg===angle);
   assert.equal(result.grid_cuts.full_tiles,exp.full_tiles);assert.equal(result.grid_cuts.edge_cut_pieces,exp.cut_cells);
   assert.deepEqual(await call('takeoff_summary'),report);
   const name=`ceiling-${angle}`;await call('export_takeoff',{path:resolve(out,name+'.json')});const after=await json(name+'.json');unchanged(before,after);
   const calc=areaGridCuts(after.shapes[0],{widthPx:5184,heightPx:3456,upp:after.sheets[0].units_per_px});
   assert.equal(calc.error,null);assert.deepEqual(calc.cells.map(c=>[c.key,c.kind]),exp.cells.map(c=>[c.key,c.kind]));
   calc.cells.forEach((c,i)=>assert.ok(Math.abs(c.area_sf-exp.cells[i].area_sf)<1e-8));
   await writeFile(resolve(out,name+'-calculation.json'),JSON.stringify(calc,null,2)+'\n');
   await call('view_sheet',{sheet:shape.sheet_id,overlay:true,region:{x0:1850,y0:175,x1:2050,y1:330},px:1400},name+'.png');
   await archive(name+'.otk',pdf,after);
   await call('undo_last');await call('export_takeoff',{path:resolve(out,name+'-undo.json')});assert.deepEqual(await json(name+'-undo.json'),before);
   console.log(`${angle} degrees: ${result.grid_count} centers, ${result.grid_cuts.full_tiles} full tiles, ${result.grid_cuts.edge_cut_pieces} cuts; identical records except explicit grid configuration, unchanged report, exact Undo.`);
 }
 const demoPdf=resolve(repo,'demo/sample-finish-plan.pdf');
 await call('load_plan',{path:demoPdf});await call('import_takeoff',{path:resolve(repo,'docs/evidence/area-grid-cuts/demo-after-reopen.json')});
 await call('export_takeoff',{path:resolve(out,'demo-before.json')});const demo=await json('demo-before.json'),d=demo.shapes[0];
 await archive('demo-before.otk',demoPdf,demo);
 const config={...d.area_grid,spacing_ft:2,spacing_y_ft:4,pattern:'rectangular',reference:'Bundled AF101 demonstration: nominal 2-by-4 modules on the existing area, not specified work. Original origin and shifts retained.',footprint:{...d.area_grid.footprint,width_ft:2,depth_ft:4,reference:'Assumed nominal 2-by-4 demonstration module; no specified finish or purchase quantity.'}};
 const dr=await call('edit_shape',{shape_id:d.id,area_grid:config});
 await call('export_takeoff',{path:resolve(out,'demo-rectangular.json')});unchanged(demo,await json('demo-rectangular.json'));
 await archive('demo-rectangular.otk',demoPdf,await json('demo-rectangular.json'));
 console.log('Bundled sample',dr.grid_cuts);
 await writeFile(resolve(out,'transcript.json'),JSON.stringify(transcript,null,2)+'\n');
}finally{await client.close();}

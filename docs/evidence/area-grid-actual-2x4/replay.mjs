import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildProjectArchive} from '../../../web/src/lib/projectArchive.js';
import {fitGridLines,centerOffsets} from '../area-grid-source/fit.mjs';
const repo=process.cwd(),out=resolve(process.argv[3]||'tmp/area-grid-actual-2x4/replay');
const pdf=resolve(process.argv[2]||'tmp/area-grid-actual-2x4/rancho-cordova-AM3.10.pdf');
const dir=resolve('docs/evidence/area-grid-actual-2x4'),sheet='rancho-cordova-AM3.10.pdf';
await mkdir(out,{recursive:true});
const r=createRequire(resolve('mcp/package.json'));
const {Client}=await import(pathToFileURL(r.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(r.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const c=new Client({name:'actual-public-2x4',version:'1'}),log=[];
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
const archive=async (name,takeoff)=>writeFile(resolve(out,name),await buildProjectArchive({takeoff,sheets:[{name:sheet}],loadPdfData:async()=>new Uint8Array(await readFile(pdf))}));
try{
 await c.readResource({uri:'takeoff://wiki'});log.push({resource:'takeoff://wiki',read:true});
 await call('load_plan',{path:pdf});
 // Reuse the single fresh measured boundary and its IDs on every replay.
 await call('import_takeoff',{path:resolve(dir,'baseline.json')});
 await call('export_takeoff',{path:resolve(out,'before.json')});
 const before=await read(resolve(out,'before.json')),report=await call('takeoff_summary');
 const region={x0:2300,y0:2950,x1:2900,y1:3600};
 const raw=await call('get_sheet_vectors',{sheet,region},'vectors.json');assert.equal(raw.dropped,0);
 const suggestion=await read(resolve(dir,'suggestion.json'));
 const fit=fitGridLines(suggestion.indices.map(i=>raw.points.slice(i*4,i*4+4)));
 assert.deepEqual(fit,suggestion.fit);assert.deepEqual(centerOffsets(fit,suggestion.origin,1/18),suggestion.center_offsets_ft);
 await call('read_sheet_text',{sheet,region},'text.json');
 await archive('ceiling-before.otk',before);
 const result=await call('edit_shape',{shape_id:before.shapes[0].id,area_grid:suggestion.grid},'result.json');
 assert.equal(result.grid_count,120);assert.equal(result.grid_cuts.full_tiles,78);assert.equal(result.grid_cuts.edge_cut_pieces,42);
 assert.deepEqual(await call('takeoff_summary'),report);
 await call('export_takeoff',{path:resolve(out,'aligned.json')});
 const aligned=await read(resolve(out,'aligned.json')),unchanged=structuredClone(aligned);delete unchanged.shapes[0].area_grid;assert.deepEqual(unchanged,before);
 await archive('public-actual-2x4.otk',aligned);
 await call('view_sheet',{sheet,region,overlay:true,px:1400},'mcp-aligned.png');
 await call('export_marked_pdf',{path:resolve(out,'boundary-marked.pdf')});
 await call('undo_last');await call('export_takeoff',{path:resolve(out,'undo.json')});assert.deepEqual(await read(resolve(out,'undo.json')),before);
 await writeFile(resolve(out,'transcript.json'),JSON.stringify(log,null,2)+'\n');
 console.log('PASS: source-aligned 2x4, 78 full / 42 cuts / 120 centers; 899 SF and 120 LF unchanged; Undo exact; no approvals.');
}finally{await c.close();}

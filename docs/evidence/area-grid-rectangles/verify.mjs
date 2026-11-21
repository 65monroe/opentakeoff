import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {areaGridCuts} from '../../../web/src/lib/areaGridCuts.js';
import {areaGrid} from '../../../web/src/lib/areaGrid.js';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const before=read('ceiling-before.json'),expected=read('expected.json');
const unchanged=(a,b)=>{const copy=structuredClone(b);copy.shapes[0].area_grid=a.shapes[0].area_grid;assert.deepEqual(copy,a,'Only explicit grid settings may change');};
for(const exp of expected.cases){
 const after=read(`ceiling-${exp.angle_deg}.json`);unchanged(before,after);
 assert.deepEqual(read(`ceiling-${exp.angle_deg}-undo.json`),before);
 const frame={widthPx:5184,heightPx:3456,upp:after.sheets[0].units_per_px};
 const calc=areaGridCuts(after.shapes[0],frame);assert.equal(calc.error,null);
 assert.equal(calc.full_tiles,exp.full_tiles);assert.equal(calc.cut_cells,exp.cut_cells);assert.equal(calc.edge_cut_pieces,exp.cut_cells);
 assert.deepEqual(calc.cells.map(c=>[c.key,c.kind]),exp.cells.map(c=>[c.key,c.kind]));
 calc.cells.forEach((c,i)=>assert.ok(Math.abs(c.area_sf-exp.cells[i].area_sf)<1e-8));
 assert.ok(Math.abs(calc.covered_sf-exp.covered_sf)<1e-8);
 assert.deepEqual(calc,read(`ceiling-${exp.angle_deg}-calculation.json`));
 assert.equal(areaGrid(after.shapes[0],frame).count,exp.angle_deg===0?23:22);
}
unchanged(read('demo-before.json'),read('demo-rectangular.json'));
if(!process.argv.includes('--mcp-only')){
 const baseline=read('ceiling-browser-baseline.json');
 for(const angle of [0,90]){
   const saved=read(`ceiling-${angle}-browser-saved.json`),reopened=read(`ceiling-${angle}-after-reopen.json`);
   unchanged(baseline,saved);assert.deepEqual(reopened,saved,'Browser archive reopen preserves complete takeoff JSON');
   assert.equal(saved.shapes[0].area_grid.angle_deg,angle);
   assert.equal(saved.shapes[0].area_grid.spacing_y_ft,4);
 }
 assert.deepEqual(read('ceiling-browser-undo.json'),baseline);
 const demoBefore=read('demo-browser-baseline.json'),demoSaved=read('demo-browser-saved.json');
 unchanged(demoBefore,demoSaved);assert.deepEqual(read('demo-after-reopen.json'),demoSaved);
}
console.log('PASS: public 2-by-4 cells agree with independent oracle at 0/90 degrees; stored IDs, geometry, sources, quantities, calibration and reviews preserved; exact MCP Undo.'+(process.argv.includes('--mcp-only')?'':' Browser Undo, both ceiling archive reopens and bundled sample reopen are exact.'));

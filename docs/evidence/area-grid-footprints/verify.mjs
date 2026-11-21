import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {areaGrid,areaGridFootprintOutline,getAreaGrid} from '../../../web/src/lib/areaGrid.js';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const baseline=read('baseline.json');
const original=baseline.shapes.find(s=>getAreaGrid(s));
const frame=p=>({widthPx:5184,heightPx:3456,upp:p.sheets[0].units_per_px});
function setInvariant(p) {
  const copy=structuredClone(p),bed=copy.shapes.find(s=>s.id===original.id);
  delete bed.area_grid;delete bed.planting_grid;
  if(original.planting_grid)bed.planting_grid=original.planting_grid;
  if(original.area_grid)bed.area_grid=original.area_grid;
  assert.deepEqual(copy,baseline,'Only the existing bed grid metadata may change');
}
for(const name of ['set-browser-saved.json','set-browser-triangular.json','set-before-reopen.json','set-after-reopen.json','browser-final.json'])setInvariant(read(name));
assert.deepEqual(read('set-before-reopen.json'),read('set-after-reopen.json'));
assert.deepEqual(read('browser-final.json'),read('set-after-reopen.json'));
assert.deepEqual(read('set-restored.json').shapes,baseline.shapes,'MCP Undo restores exact originals');
for(const [name,n] of [['set-square.json',110],['set-triangular.json',129],['set-browser-saved.json',110],['set-browser-triangular.json',129]]){
  const p=read(name),bed=p.shapes.find(s=>s.id===original.id);
  assert.equal(areaGrid(bed,frame(p)).count,n);
  const outline=areaGridFootprintOutline(bed,frame(p));
  assert.equal(outline.length,48);
  assert.ok(Math.abs((Math.max(...outline.map(p=>p[0]))-Math.min(...outline.map(p=>p[0])))*5184*p.sheets[0].units_per_px-.625)<1e-10);
  assert.equal(p.shapes.find(s=>s.id===getAreaGrid(bed).source_callout_id).computed.count,127);
}
const ceiling=read('ceiling-footprints.json'),before=read('ceiling-before.json');
const stripped=structuredClone(ceiling);delete stripped.shapes[0].area_grid.footprint;
assert.deepEqual(stripped,before);
assert.equal(areaGrid(ceiling.shapes[0],frame(ceiling)).count,45);
assert.deepEqual(read('ceiling-before-reopen.json'),read('ceiling-after-reopen.json'));
for(const key of ['shapes','conditions','sheets'])assert.deepEqual(read('ceiling-after-reopen.json')[key],ceiling[key]);
const demo=read('demo-footprints.json'),demoOriginal=read('../area-grid-count/demo-takeoff.json');
const demoStripped=structuredClone(demo);delete demoStripped.shapes[0].area_grid.footprint;
assert.deepEqual(demoStripped.shapes,demoOriginal.shapes);
assert.equal(areaGrid(demo.shapes[0],{widthPx:6048,heightPx:4320,upp:demo.sheets[0].units_per_px}).count,8);
assert.deepEqual(read('demo-before-reopen.json'),read('demo-after-reopen.json'));
for(const key of ['shapes','conditions','sheets'])assert.deepEqual(read('demo-after-reopen.json')[key],demo[key]);
console.log('PASS: SET 110/129 centers and printed 127 unchanged; all seven baseline records, five conditions, quantities and review states preserved. Ceiling 45 and demo eight centers unchanged. All three browser archives reopen exactly; MCP Undo restores the SET baseline.');

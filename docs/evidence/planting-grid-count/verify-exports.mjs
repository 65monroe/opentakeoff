import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plantingGrid} from '../../../web/src/lib/plantingGrid.js';

const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const baseline=read('baseline.json');
const config=read('config.json');
const before=read('browser-before-reopen.json');
const after=read('browser-after-reopen.json');
const mcp=read('takeoff.json');
assert.deepEqual(after,before,'Native archive reopen must preserve the complete export');
for(const [name,project] of [['browser',after],['MCP',mcp]]) {
  const bed=project.shapes.find(s=>s.id==='shp-7cca5e9f-60ef-4215-a544-54d3c5e5055a');
  assert.deepEqual(bed.planting_grid,config,`${name}: exact saved grid settings`);
  const originals=structuredClone(project.shapes);
  delete originals.find(s=>s.id===bed.id).planting_grid;
  assert.deepEqual(originals,baseline.shapes,`${name}: preserve every original shape field`);
  for(const key of ['conditions','sheets','markups','rfis','proposals']) assert.deepEqual(project[key],baseline[key],`${name}: preserve ${key}`);
  const frame={widthPx:5184,heightPx:3456,upp:baseline.sheets[0].units_per_px};
  assert.equal(plantingGrid(bed,frame).count,110);
  assert.equal(plantingGrid({...bed,planting_grid:{...config,pattern:'triangular'}},frame).count,129);
  assert.equal(project.shapes.find(s=>s.id===config.source_callout_id).computed.count,127);
}
const browserOriginal=structuredClone(after);
delete browserOriginal.shapes.find(s=>s.planting_grid).planting_grid;
assert.deepEqual(browserOriginal,baseline,'Browser baseline has exactly one additive field change');
console.log('PASS: complete browser reopen equality; seven original records, all quantities/review/source/calibration fields preserved; only C1 planting_grid added. Square 110, triangular 129, printed 127.');

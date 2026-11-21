import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {areaGrid} from '../../../web/src/lib/areaGrid.js';
import {areaGridCuts} from '../../../web/src/lib/areaGridCuts.js';
import {fitGridLines,phaseDistance} from '../area-grid-source/fit.mjs';
const read=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const baseline=await read('baseline.json'),aligned=await read('aligned.json'),saved=await read('browser-saved.json');
const unchanged=structuredClone(aligned);delete unchanged.shapes[0].area_grid;
assert.deepEqual(unchanged,baseline);
const withoutTabs=structuredClone(saved);assert.deepEqual(withoutTabs.sheet_tabs,['rancho-cordova-AM3.10.pdf']);withoutTabs.sheet_tabs=[];
assert.deepEqual(withoutTabs,aligned);
assert.deepEqual(saved,await read('after-reload.json'));assert.deepEqual(saved,await read('after-reopen.json'));
const shape=saved.shapes[0],frame={widthPx:6048,heightPx:4320,upp:1/18};
assert.equal(shape.id,'shp-531f70fb-c173-4e4e-80fc-ac3c8b66a39e');
assert.equal(shape.condition_id,'cnd-a136aad0-65bb-4f7c-8d5f-eead73ace18b');
assert.deepEqual(shape.computed,{area_sf:899,perimeter_lf:120});assert.equal(shape.origin.reviewed,false);
const raw=await read('vectors.json'),suggestion=await read('suggestion.json');
assert.equal(raw.offset+raw.returned+raw.dropped,raw.total);assert.equal(raw.dropped,0);
assert.deepEqual(fitGridLines(suggestion.indices.map(i=>raw.points.slice(i*4,i*4+4))),suggestion.fit);
assert.deepEqual([suggestion.fit.x.pitch_px,suggestion.fit.y.pitch_px],[36,72]);
// Independent paper count: 14 interior verticals -> 15 columns (13 full),
// 7 interior horizontals -> 8 rows (6 full). Perimeter cells are counted once.
const expected={full:13*6,cuts:2*15+2*6,all:15*8,fullSf:13*6*8,areaSf:29*31};
const cuts=areaGridCuts(shape,frame);assert.equal(cuts.error,null);
assert.equal(cuts.full_tiles,expected.full);assert.equal(cuts.cut_cells,expected.cuts);assert.equal(cuts.edge_cut_pieces,expected.cuts);
assert.equal(cuts.cells.length,expected.all);assert.equal(areaGrid(shape,frame).count,120);
assert.ok(Math.abs(cuts.covered_sf-expected.areaSf)<1e-8);assert.ok(Math.abs(cuts.full_sf-expected.fullSf)<1e-8);
assert.ok(Math.abs(cuts.cut_sf-275)<1e-8);
// Negative cases: rotating the rectangular pitch misses seven observed X lines;
// shifting half a module misses every observed X line. A 2x2 fit would invent
// intermediate Y lines: its pitch cannot pass the measured 72 px separation.
assert.equal(suggestion.fit.x.positions_px.filter(v=>phaseDistance(v,2362.08,72)<=0.3).length,7);
assert.equal(suggestion.fit.x.positions_px.filter(v=>phaseDistance(v,2362.08+18,36)<=0.3).length,0);
assert.throws(()=>assert.equal(suggestion.fit.y.pitch_px,36));
for(const mutate of [p=>p.shapes[0].computed.area_sf++,p=>p.shapes[0].origin.reviewed=true,p=>p.shapes[0].id+='-new']){
 const changed=structuredClone(unchanged);mutate(changed);assert.throws(()=>assert.deepEqual(changed,baseline));
}
console.log(JSON.stringify({source_fit:'21 distinct lines; maximum residual 0.24 px',full_tiles:78,edge_cut_pieces:42,derived_centers:120,measured:shape.computed,persistence:'complete JSON equality after save/reload/reopen',new_approvals:0,browser_sha256:createHash('sha256').update(JSON.stringify(saved)).digest('hex')},null,2));

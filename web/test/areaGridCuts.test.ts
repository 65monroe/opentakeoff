import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {areaGridCuts} from '../src/lib/areaGridCuts.js';
import {areaGrid} from '../src/lib/areaGrid.js';
import {applyShapeCommand} from '../src/lib/shapeCommands.js';
const frame={widthPx:10,heightPx:10,upp:1};
const grid={single_item:true,spacing_ft:2,pattern:'square',angle_deg:0,inset_ft:0,offset_x_ft:1,offset_y_ft:1,origin_norm:[0,0],reference:'Test module layout',footprint:{kind:'rectangle',width_ft:2,depth_ft:2,basis:'assumed',reference:'Test nominal module'},cut_pieces:true};
const rect=(x:number,y:number,w:number,h:number)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>p.map(v=>v/10));
const shape=(verts=rect(0,0,4,4),extra={})=>({id:'same',sheet_id:'plan',condition_id:'ACT',measure_role:'floor_area',verts_norm:verts,computed:{area_sf:16},origin:{actor:'agent',reviewed:true},area_grid:structuredClone(grid),...extra});
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('cuts partition the boundary and include modules whose centers are outside',()=>{
  const exact=areaGridCuts(shape(),frame)!;
  assert.equal(exact.error,null);assert.equal(exact.full_tiles,4);assert.equal(exact.edge_cut_pieces,0);near(exact.covered_sf,16);
  const odd=shape(rect(0,0,3,3)),r=areaGridCuts(odd,frame)!;
  assert.equal(r.full_tiles,1);assert.equal(r.cut_cells,3);assert.equal(r.edge_cut_pieces,3);near(r.full_sf,4);near(r.cut_sf,5);near(r.covered_sf,9);
  const sliver=shape(rect(0,0,.2,2));
  assert.equal(areaGrid(sliver,frame).count,0);
  assert.equal(areaGridCuts(sliver,frame)!.edge_cut_pieces,1);
  near(areaGridCuts(sliver,frame)!.covered_sf,.4);
});

test('holes and disconnected fragments remain distinct; touches add no pieces',()=>{
  const hole=areaGridCuts(shape(rect(0,0,2,2),{verts_norm_holes:[rect(.5,.5,1,1)]}),frame)!;
  assert.equal(hole.full_tiles,0);assert.equal(hole.edge_cut_pieces,1);assert.equal(hole.cells[0].pieces[0].holes.length,1);near(hole.covered_sf,3);
  // U shape, one nominal tile clipped into two separate legs in its upper row.
  const u=[[0,0],[6,0],[6,4],[4,4],[4,1],[2,1],[2,4],[0,4]].map(p=>p.map(v=>v/10));
  const r=areaGridCuts(shape(u,{area_grid:{...grid,spacing_ft:4,offset_x_ft:3,offset_y_ft:2,footprint:{...grid.footprint,width_ft:4,depth_ft:4}}}),frame)!;
  assert.equal(r.error,null);near(r.covered_sf,18);
  assert.ok(r.cells.every(c=>c.area_sf>0));
  const split=[[0,0],[6,0],[6,6],[4,6],[4,1],[2,1],[2,6],[0,6]].map(p=>p.map(v=>v/10));
  const rs=areaGridCuts(shape(split,{area_grid:{...grid,spacing_ft:6,offset_x_ft:3,offset_y_ft:6,footprint:{...grid.footprint,width_ft:6,depth_ft:6}}}),frame)!;
  assert.ok(rs.edge_cut_pieces>rs.cut_cells,'disconnected pieces cannot be counted as one cut');
});

test('rotation, offsets and frame aspect preserve coverage; invalid geometry refuses',()=>{
  const a=shape(),r=areaGridCuts({...a,area_grid:{...grid,angle_deg:31,offset_x_ft:.25,offset_y_ft:.75}},frame)!;
  near(r.covered_sf,16);assert.ok(r.edge_cut_pieces>0);
  const scaled={...a,verts_norm:a.verts_norm.map(([x,y])=>[x/2,y])};
  near(areaGridCuts(scaled,{...frame,widthPx:20})!.covered_sf,16);
  for(const patch of [{pattern:'triangular'},{inset_ft:1},{footprint:{...grid.footprint,depth_ft:1}},{cut_pieces:'yes'}])assert.ok(areaGridCuts({...a,area_grid:{...grid,...patch}},frame)?.error);
  assert.ok(areaGridCuts(shape([[0,0],[.4,.4],[0,.4],[.4,0]]),frame)?.error);
  assert.ok(areaGridCuts(shape(),{...frame,upp:0})?.error);
  assert.ok(areaGridCuts({...a,area_grid:{...grid,spacing_ft:.001,footprint:{...grid.footprint,width_ft:.001,depth_ft:.001}}},frame)?.error);
  assert.equal(areaGridCuts({...a,area_grid:{...grid,cut_pieces:false}},frame),null);
});

test('enabling cuts preserves existing geometry, quantities and human decisions; Undo restores absence',()=>{
  const a:any=shape();delete a.area_grid.cut_pieces;
  const before=structuredClone(a),result=applyShapeCommand([a],{type:'areaGrid',id:a.id,grid:{...a.area_grid,cut_pieces:true}});
  const copy=structuredClone(result.shapes[0]);delete copy.area_grid.cut_pieces;assert.deepEqual(copy,before);
  assert.deepEqual(applyShapeCommand(result.shapes,result.inverse).shapes,[before]);
});

test('public A111 unchanged trace conserves coverage with clipped modules',()=>{
  const p=JSON.parse(readFileSync(new URL('../../docs/evidence/area-grid-footprints/ceiling-footprints.json',import.meta.url),'utf8'));
  const a=structuredClone(p.shapes[0]);a.area_grid.cut_pieces=true;
  const f={widthPx:5184,heightPx:3456,upp:p.sheets[0].units_per_px};
  const r=areaGridCuts(a,f)!;
  assert.equal(r.error,null);assert.equal(areaGrid(a,f).count,45);
  const expected=JSON.parse(readFileSync(new URL('../../docs/evidence/area-grid-cuts/expected.json',import.meta.url),'utf8'));
  near(r.covered_sf,expected.covered_sf);
  assert.equal(r.full_tiles,31);assert.equal(r.cut_cells,32);assert.equal(r.edge_cut_pieces,32);
  assert.deepEqual(r.cells.map(c=>[c.key,c.kind]),expected.cells.map((c:any)=>[c.key,c.kind]));
  r.cells.forEach((c,i)=>near(c.area_sf,expected.cells[i].area_sf));
});

test('2 by 4 modules cover full, cut, rotated and holed boundaries without overlaps',()=>{
  const config={...grid,pattern:'rectangular',spacing_y_ft:4,offset_y_ft:2,footprint:{...grid.footprint,depth_ft:4}};
  const a=shape(rect(0,0,4,8),{area_grid:config});
  const exact=areaGridCuts(a,frame)!;
  assert.equal(exact.full_tiles,4);assert.equal(exact.edge_cut_pieces,0);near(exact.covered_sf,32);
  assert.equal(areaGrid(a,frame).count,4);
  const odd=areaGridCuts(shape(rect(0,0,3,5),{area_grid:config}),frame)!;
  assert.equal(odd.full_tiles,1);assert.equal(odd.edge_cut_pieces,3);near(odd.cut_sf,7);near(odd.covered_sf,15);
  const rotated=areaGridCuts(shape(rect(0,0,8,4),{area_grid:{...config,angle_deg:90}}),frame)!;
  assert.equal(rotated.full_tiles,4);assert.equal(rotated.edge_cut_pieces,0);near(rotated.covered_sf,32);
  const hole=areaGridCuts({...a,verts_norm_holes:[rect(.5,.5,1,1)]},frame)!;
  assert.equal(hole.full_tiles,3);assert.equal(hole.edge_cut_pieces,1);near(hole.covered_sf,31);
  for(const spacing_y_ft of [undefined,0,-1,NaN,Infinity])assert.ok(areaGridCuts({...a,area_grid:{...config,spacing_y_ft}},frame)?.error);
  assert.ok(areaGridCuts({...a,area_grid:{...config,pattern:'square'}},frame)?.error);
  assert.ok(areaGridCuts({...a,area_grid:{...config,spacing_y_ft:3}},frame)?.error,'gap/overlap cannot masquerade as contiguous modules');
});

test('public A111 2 by 4 alternatives match independent cells and areas at both orientations',()=>{
  const p=JSON.parse(readFileSync(new URL('../../docs/evidence/area-grid-cuts/ceiling-cuts.json',import.meta.url),'utf8'));
  const expected=JSON.parse(readFileSync(new URL('../../docs/evidence/area-grid-rectangles/expected.json',import.meta.url),'utf8'));
  for(const exp of expected.cases){
    const a=structuredClone(p.shapes[0]);
    Object.assign(a.area_grid,{pattern:'rectangular',spacing_y_ft:4,angle_deg:exp.angle_deg});a.area_grid.footprint.depth_ft=4;
    const f={widthPx:5184,heightPx:3456,upp:p.sheets[0].units_per_px};
    const r=areaGridCuts(a,f)!;assert.equal(r.error,null);
    assert.equal(r.full_tiles,exp.full_tiles);assert.equal(r.cut_cells,exp.cut_cells);assert.equal(r.edge_cut_pieces,exp.cut_cells);
    assert.deepEqual(r.cells.map(c=>[c.key,c.kind]),exp.cells.map((c:any)=>[c.key,c.kind]));
    r.cells.forEach((c,i)=>near(c.area_sf,exp.cells[i].area_sf));near(r.covered_sf,exp.covered_sf);
    assert.equal(areaGrid(a,f).count,exp.angle_deg===0?23:22);
  }
});

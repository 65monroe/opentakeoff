import {test} from 'node:test';
import assert from 'node:assert/strict';
import {areaGrid,areaGridError,getAreaGrid,areaGridFootprintOutline} from '../src/lib/areaGrid.js';
import {applyShapeCommand} from '../src/lib/shapeCommands.js';
import {mergeTakeoffImport} from '../src/lib/importTakeoff.js';
const frame={widthPx:2,heightPx:2,upp:1};
const grid={single_item:true,spacing_ft:1,pattern:'square',angle_deg:0,inset_ft:0,offset_x_ft:.5,offset_y_ft:.5,origin_norm:[0,0],reference:'Test fixture: supports on a one-foot layout; not observed items'};
const area={id:'area',sheet_id:'plan',condition_id:'SUPPORTS',measure_role:'floor_area',verts_norm:[[0,0],[1,0],[1,1],[0,1]],computed:{area_sf:4,perimeter_lf:8},origin:{actor:'agent',reviewed:true}};

test('generic area grid needs no plant identity or printed source; quantity and review stay exact',()=>{
  const original=structuredClone(area);
  const changed=applyShapeCommand([area],{type:'areaGrid',id:area.id,grid});
  assert.equal(areaGrid(changed.shapes[0],frame).count,4);
  const stripped={...changed.shapes[0]}; delete stripped.area_grid;
  assert.deepEqual(stripped,original);
  assert.deepEqual(applyShapeCommand(changed.shapes,changed.inverse).shapes,[original]);
  assert.deepEqual(mergeTakeoffImport({},{schema:'opentakeoff.takeoff_canvas.v1',conditions:[],shapes:changed.shapes}).payload.shapes,changed.shapes);
  const removed=applyShapeCommand(changed.shapes,{type:'areaGrid',id:area.id,grid:null});
  assert.deepEqual(removed.shapes,[original]);
  assert.deepEqual(applyShapeCommand(removed.shapes,removed.inverse).shapes,changed.shapes);
});

test('footprints have physical dimensions independent of spacing, frame aspect and count',()=>{
  const frame={widthPx:1000,heightPx:500,upp:.01}; // 10 by 5 ft, not a square image
  const plain={...area,area_grid:{...grid,spacing_ft:2,offset_x_ft:1,offset_y_ft:1}};
  const circle={...plain,area_grid:{...plain.area_grid,footprint:{kind:'circle',diameter_ft:.625,basis:'assumed',reference:'7.5-inch container footprint; test assumption'}}};
  const ring=areaGridFootprintOutline(circle,frame);
  const ext=(axis:number)=>Math.max(...ring.map(p=>p[axis]))-Math.min(...ring.map(p=>p[axis]));
  assert.equal(ext(0)*10,.625); assert.equal(ext(1)*5,.625);
  assert.deepEqual(areaGrid(circle,frame),areaGrid(plain,frame),'footprint cannot change generated positions');
  const wide={...plain,area_grid:{...plain.area_grid,angle_deg:90,footprint:{kind:'rectangle',width_ft:2,depth_ft:4,basis:'specified',reference:'Synthetic 2 by 4 unit'}}};
  const rotated=areaGridFootprintOutline(wide,frame);
  assert.ok(Math.abs((Math.max(...rotated.map(p=>p[0]))-Math.min(...rotated.map(p=>p[0])))*10-4)<1e-10);
  assert.ok(Math.abs((Math.max(...rotated.map(p=>p[1]))-Math.min(...rotated.map(p=>p[1])))*5-2)<1e-10);
  assert.deepEqual(areaGridFootprintOutline(circle,{...frame,upp:.02}),ring.map(p=>p.map(v=>v/2)),'current calibration controls footprint size');
  assert.deepEqual(areaGridFootprintOutline(plain,frame),[],'old grids keep position markers');
});

test('footprint edits, import and undo preserve every other field including human review',()=>{
  const original={...area,area_grid:grid};
  const changed=applyShapeCommand([original],{type:'areaGrid',id:area.id,grid:{...grid,footprint:{kind:'rectangle',width_ft:2,depth_ft:2,basis:'assumed',reference:'Test module'}}});
  const stripped=structuredClone(changed.shapes);delete stripped[0].area_grid.footprint;
  assert.deepEqual(stripped,[original]);
  assert.deepEqual(applyShapeCommand(changed.shapes,changed.inverse).shapes,[original]);
  assert.deepEqual(mergeTakeoffImport({},{schema:'opentakeoff.takeoff_canvas.v1',conditions:[],shapes:changed.shapes}).payload.shapes,changed.shapes);
  for(const footprint of [null,{}, {kind:'circle',diameter_ft:0,basis:'assumed',reference:'Test'}, {kind:'circle',diameter_ft:Infinity,basis:'assumed',reference:'Test'}, {kind:'rectangle',width_ft:2,basis:'specified',reference:'Test'}, {kind:'circle',diameter_ft:1,basis:'approved',reference:'Test'}, {kind:'circle',diameter_ft:1,basis:'assumed',reference:' '}]) {
    assert.ok(areaGridError({...area,area_grid:{...grid,footprint}}));
  }
});

test('legacy planting grid is read unchanged; explicit edit and undo preserve exact legacy fields',()=>{
  const {single_item,...rest}=grid;
  const source={id:'callout',sheet_id:'plan',measure_role:'count',verts_norm:[[.9,.9]],computed:{count:7},quantity_source:{kind:'printed_callout',unit:'EA',id:'C1',text:'7 items',reference:'Fixture'}};
  const legacy={...area,source_callout_ids:['callout'],planting_grid:{...rest,single_species:true,source_callout_id:'callout'}};
  const before=structuredClone([legacy,source]);
  const normalized=getAreaGrid(legacy);
  assert.equal(areaGrid(legacy,frame).count,4);
  assert.deepEqual(mergeTakeoffImport({},{schema:'opentakeoff.takeoff_canvas.v1',conditions:[],shapes:before}).payload.shapes,before);
  const changed=applyShapeCommand(before,{type:'areaGrid',id:area.id,grid:normalized});
  assert.equal(changed.shapes[0].planting_grid,undefined);
  assert.equal(changed.shapes[0].area_grid.single_item,true);
  assert.deepEqual(applyShapeCommand(changed.shapes,changed.inverse).shapes,before);
  assert.deepEqual([legacy,source],before);
});

test('ambiguous grids and unsupported roles refuse; optional references must be valid when supplied',()=>{
  for(const record of [
    {...area,area_grid:grid,planting_grid:{}},
    {...area,measure_role:'surface_area',area_grid:grid},
    {...area,area_grid:{...grid,single_item:false}},
    {...area,area_grid:{...grid,source_callout_id:'missing'}},
  ]) assert.ok(areaGridError(record,[]));
  assert.equal(areaGrid({...area,area_grid:grid,verts_norm:undefined},frame).count,null);
  assert.equal(areaGridError({...area,area_grid:grid},[]),null);
});

test('rectangular spacing is explicit, rotates with the grid and preserves saved records',()=>{
  const config={...grid,pattern:'rectangular',spacing_y_ft:2,offset_y_ft:1};
  const changed=applyShapeCommand([area],{type:'areaGrid',id:area.id,grid:config});
  assert.deepEqual(areaGrid(changed.shapes[0],frame).points_norm,[[.25,.5],[.75,.5]]);
  const rotated=areaGrid({...area,area_grid:{...config,angle_deg:90}},frame);
  assert.equal(rotated.count,2);
  rotated.points_norm.forEach(p=>assert.ok(Math.abs(p[0]-.5)<1e-10));
  const stripped=structuredClone(changed.shapes[0]);delete stripped.area_grid;assert.deepEqual(stripped,area);
  assert.deepEqual(mergeTakeoffImport({},{schema:'opentakeoff.takeoff_canvas.v1',conditions:[],shapes:changed.shapes}).payload.shapes,changed.shapes);
  assert.deepEqual(applyShapeCommand(changed.shapes,changed.inverse).shapes,[area]);
  for(const spacing_y_ft of [undefined,0,-1,NaN,Infinity])assert.ok(areaGridError({...area,area_grid:{...config,spacing_y_ft}}));
  assert.ok(areaGridError({...area,area_grid:{...config,pattern:'triangular'}}));
});

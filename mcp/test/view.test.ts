// view_sheet's pure half: grid-spec math (image px per real foot). The drawing
// itself is covered by the conformance suite's rendered-image assertions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gridPxPerFoot, drawShapes } from "../src/view.ts";
import { UserError } from "../src/format.ts";

test("drawing-scale specs: inches-per-foot → image px per foot at render scale 2.0", () => {
  // 1/4" = 1'-0" → 0.25 in × 72 pt × 2 px/pt = 36 image px per real foot
  assert.equal(gridPxPerFoot("1/4", null), 36);
  assert.equal(gridPxPerFoot("0.25", null), 36);
  assert.equal(gridPxPerFoot("3/16", null), 27);
  assert.equal(gridPxPerFoot("1/8", null), 18);
  assert.equal(gridPxPerFoot(" 1/4 ", null), 36, "whitespace-tolerant");
});

test('MCP overlay draws physical footprints at the same grid centers without clipping edge outlines',()=>{
  const paths:number[][][]=[];let path:number[][]=[];
  const ctx={strokeStyle:'',fillStyle:'',lineWidth:0,font:'',beginPath(){path=[];},moveTo(x:number,y:number){path.push([x,y]);},lineTo(x:number,y:number){path.push([x,y]);},closePath(){},stroke(){paths.push(path);},setLineDash(){},fillText(){}};
  const shape:any={id:'area',sheet_id:'sheet',condition_id:'ACT',measure_role:'floor_area',verts_norm:[[0,0],[1,0],[1,1],[0,1]],computed:{area_sf:4},origin:{reviewed:false},area_grid:{single_item:true,spacing_ft:2,pattern:'square',angle_deg:0,inset_ft:0,offset_x_ft:1,offset_y_ft:1,origin_norm:[0,0],reference:'Test grid',footprint:{kind:'rectangle',width_ft:4,depth_ft:2,basis:'assumed',reference:'Test rectangle'}}};
  drawShapes(ctx,(x,y)=>[x*3+10,y*3+20],[shape],100,100,300,.02);
  assert.equal(paths.length,2,'one boundary and one footprint; no extra count marks');
  assert.deepEqual(paths[1],[[-140,20],[460,20],[460,320],[-140,320]],'4-by-2-ft footprint at the center; full extent remains visible beyond the 2-by-2-ft area');
});

test('MCP cut overlay separates full modules and clipped pieces with dash cues',()=>{
  const paths:{points:number[][],dash:number[]}[]=[];let path:number[][]=[],dash:number[]=[];
  const ctx={strokeStyle:'',fillStyle:'',lineWidth:0,font:'',beginPath(){path=[];},moveTo(x:number,y:number){path.push([x,y]);},lineTo(x:number,y:number){path.push([x,y]);},closePath(){},stroke(){paths.push({points:path,dash});},setLineDash(v:number[]){dash=v;},fillText(){}};
  const shape:any={id:'same',sheet_id:'s',condition_id:'ACT',measure_role:'floor_area',verts_norm:[[0,0],[1,0],[1,1],[0,1]],computed:{area_sf:9},area_grid:{single_item:true,spacing_ft:2,pattern:'square',angle_deg:0,inset_ft:0,offset_x_ft:1,offset_y_ft:1,origin_norm:[0,0],reference:'Test',cut_pieces:true,footprint:{kind:'rectangle',width_ft:2,depth_ft:2,basis:'assumed',reference:'Test'}}};
  drawShapes(ctx,(x,y)=>[x,y],[shape],300,300,300,.01);
  assert.equal(paths.length,5,'one source boundary, one full tile and three cut pieces');
  assert.equal(paths.slice(1).filter(p=>p.dash.length===0).length,1);
  assert.equal(paths.slice(1).filter(p=>p.dash.length>0).length,3);
  assert.ok(paths.every(p=>p.points.every(([x,y])=>x>=0&&y>=0&&x<=300&&y<=300)),'cuts stay within source boundary');
});

test("auto: reciprocal of the sheet's upp; refused until the scale is set", () => {
  const fromAuto = gridPxPerFoot("auto", 1 / 36);
  assert.ok(fromAuto !== null && Math.abs(fromAuto - 36) < 1e-9, "auto agrees with the 1/4\" drawing scale");
  assert.throws(() => gridPxPerFoot("auto", null), UserError);
  assert.throws(() => gridPxPerFoot("auto", null), /set_scale/);
});

test("no grid asked for → null", () => {
  assert.equal(gridPxPerFoot(undefined, null), null);
  assert.equal(gridPxPerFoot("", null), null);
  assert.equal(gridPxPerFoot("   ", 1 / 36), null);
});

test("junk and out-of-range specs are clean UserErrors", () => {
  for (const bad of ["banana", "1/0", "0/4", "-1/4", "0", "20", "0.005"]) {
    assert.throws(() => gridPxPerFoot(bad, null), UserError, `spec ${JSON.stringify(bad)}`);
  }
  assert.throws(() => gridPxPerFoot("banana", null), /inches-per-foot/);
  assert.throws(() => gridPxPerFoot("20", null), /out of range/);
});

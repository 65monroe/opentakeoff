import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../server.ts";
import { Session } from "../src/session.ts";

test("editable planting areas link over MCP without touching accepted source records", async () => {
  const session = new Session();
  const [ct,st] = InMemoryTransport.createLinkedPair();
  const server = buildServer(session); await server.connect(st);
  const client = new Client({name:"area-link-test",version:"1"}); await client.connect(ct);
  const call = async (name:string,args:Record<string,unknown>,error=false) => {
    const reply:any=await client.callTool({name,arguments:args});
    assert.equal(!!reply.isError,error,JSON.stringify(reply));
    if(error) return reply;
    return reply.structuredContent ?? JSON.parse(reply.content[0].text);
  };
  try {
    await session.loadPlan(fileURLToPath(new URL("../../demo/sample-plan.pdf",import.meta.url)));
    const sheet="sample-plan.pdf"; session.setScale(sheet,{use_detected:true});
    const source=session.recordCalloutQuantity({sheet,condition:"pa",quantity:12,at:[100,100],source_id:"C1",text:"12 pa",reference:"Synthetic source"});
    session.shapes[0].origin!.reviewed=true; // Fixture only; no agent approval tool.
    const original=structuredClone(session.shapes[0]);
    const area=session.measurePolygon(sheet,[[200,200],[400,200],[400,400],[200,400]],{condition:"BED",role:"floor_area"});
    const before=structuredClone(session.exportPayload());
    await call("edit_shape",{shape_id:area.shape_id,source_callout_ids:[source.shape_id]});
    assert.deepEqual(session.shapes[0],original);
    assert.deepEqual(session.shapes[1].source_callout_ids,[source.shape_id]);
    const linked=structuredClone(session.exportPayload());
    const grid={source_callout_id:source.shape_id,single_species:true,spacing_ft:1,pattern:'square',angle_deg:0,inset_ft:0,offset_x_ft:0,offset_y_ft:0,origin_norm:[.1,.1],reference:'Synthetic grid; no quantity adoption'};
    const gridReply=await call('edit_shape',{shape_id:area.shape_id,planting_grid:grid});
    assert.ok(gridReply.grid_count>0);
    assert.deepEqual(session.shapes[0],original);
    const gridArea={...session.shapes[1]}; delete gridArea.planting_grid;
    assert.deepEqual(gridArea,linked.shapes[1]);
    const gridSaved=structuredClone(session.exportPayload());
    for(const patch of [{planting_grid:{...grid,spacing_ft:0}},{planting_grid:{...grid,source_callout_id:'missing'}},{planting_grid:grid,label:'mixed edit'}]) {
      await call('edit_shape',{shape_id:area.shape_id,...patch},true);
      assert.deepEqual(session.exportPayload(),gridSaved);
    }
    await call('undo_last',{}); assert.deepEqual(session.exportPayload(),linked);
    for(const patch of [{source_callout_ids:["missing"]},{source_callout_ids:[source.shape_id,source.shape_id]},{role:"count"}]) {
      await call("edit_shape",{shape_id:area.shape_id,...patch},true);
      assert.deepEqual(session.exportPayload(),linked);
    }
    await call("edit_shape",{shape_id:area.shape_id,verts:[[200,200],[500,200],[400,400],[200,400]]});
    assert.deepEqual(session.shapes[0],original);
    assert.deepEqual(session.shapes[1].source_callout_ids,[source.shape_id]);
    await call("undo_last",{}); assert.deepEqual(session.exportPayload(),linked);
    await call("undo_last",{}); assert.deepEqual(session.exportPayload(),before);
  } finally { await client.close(); await server.close(); }
});

test("printed EA: source receipts, idempotency, refusal, review preservation and undo over MCP", async () => {
  const session = new Session();
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = buildServer(session);
  await server.connect(st);
  const client = new Client({ name: "callout-test", version: "1" });
  await client.connect(ct);
  const call = async (name: string, args: Record<string, unknown> = {}, error = false) => {
    const r: any = await client.callTool({ name, arguments: args });
    assert.equal(!!r.isError, error, JSON.stringify(r));
    if (error) return r;
    return r.structuredContent ?? JSON.parse(r.content[0].text);
  };
  try {
    await call("load_plan", { path: fileURLToPath(new URL("../../demo/sample-plan.pdf", import.meta.url)) });
    const sheet = "sample-plan.pdf";
    await call("place_count", { sheet, condition: "pa", points: [[100,100]] });
    // Synthetic pre-existing human decision, not a tool-created approval.
    session.shapes[0].origin!.reviewed = true;
    const before = structuredClone(session.shapes);
    const args = { sheet, condition: "pa", quantity: 12, unit: "EA", at: [200,150], source_id: "C1", text: "(12) pa", reference: "Synthetic bundled-plan source, west bed" };
    const a = await call("record_callout_quantity", args);
    const b = await call("record_callout_quantity", { ...args, quantity: 8, at: [300,200], source_id: "C2", text: "(8) pa" });
    assert.notEqual(a.shape_id, b.shape_id);
    assert.deepEqual(session.shapes[0], before[0]);
    const stable = structuredClone(session.exportPayload());
    assert.equal((await call("record_callout_quantity", args)).created, false);
    assert.deepEqual(session.exportPayload(), stable);
    for (const changed of [{ quantity: 13 }, { at: [201,150] }, { text: "(12) Pa" }, { reference: "Different source" }, { quantity: 0 }, { quantity: -1 }, { quantity: 1.5 }, { unit: "SF" }, { source_id: " " }, { at: [-1,150] }]) {
      await call("record_callout_quantity", { ...args, ...changed }, true);
      assert.deepEqual(session.exportPayload(), stable, "Refusal is atomic");
    }
    const rows = (await call("takeoff_summary")).conditions;
    for (const patch of [{ role:"linear", verts:[[200,150],[220,150]] }, { verts:[[200,150],[220,150]] }, { verts:[[-1,150]] }, { condition:"different" }]) {
      await call("edit_shape",{shape_id:a.shape_id,...patch},true);
      assert.deepEqual(session.exportPayload(),stable,"invalid source edits refuse atomically");
    }
    await call("edit_shape",{shape_id:a.shape_id,verts:[[210,160]]});
    assert.equal(session.shapes[1].computed.count,12,"moving the source preserves its printed quantity");
    assert.deepEqual(session.shapes[1].quantity_source,stable.shapes[1].quantity_source);
    await call("undo_last");
    assert.deepEqual(session.exportPayload(),stable);
    assert.equal(rows[0].ea, 21);
    assert.deepEqual(rows[0].count_basis, { located_ea: 1, printed_ea: 20 });
    const listed = (await call("list_shapes")).shapes;
    assert.equal(listed[1].quantity_source.text, "(12) pa");
    assert.equal(listed[1].reviewed, false);
    assert.equal(listed.length, 3, "one record per callout, no invented individual points");
    await call("undo_last");
    assert.equal(session.shapes.length, 2, "idempotent retry and refusals did not add undo entries");
    assert.deepEqual(session.shapes[0], before[0]);
    session.shapes[1].origin!.reviewed = true;
    const reviewed = structuredClone(session.exportPayload());
    assert.equal((await call("record_callout_quantity", args)).shape_id, a.shape_id);
    assert.deepEqual(session.exportPayload(), reviewed, "retry cannot undo a human decision");
  } finally { await client.close(); await server.close(); }
});

test('generic area_grid is available over MCP without a printed callout and preserves accepted work',async()=>{
  const session=new Session();
  const [ct,st]=InMemoryTransport.createLinkedPair(); const server=buildServer(session); await server.connect(st);
  const client=new Client({name:'generic-grid-test',version:'1'}); await client.connect(ct);
  const call=async(args:Record<string,unknown>,error=false)=>{
    const r:any=await client.callTool({name:'edit_shape',arguments:args}); assert.equal(!!r.isError,error,JSON.stringify(r));
    return error?r:r.structuredContent??JSON.parse(r.content[0].text);
  };
  try {
    await session.loadPlan(fileURLToPath(new URL('../../demo/sample-plan.pdf',import.meta.url)));
    const sheet='sample-plan.pdf'; session.setScale(sheet,{use_detected:true});
    const area=session.measurePolygon(sheet,[[200,200],[400,200],[400,400],[200,400]],{condition:'SUPPORT-LAYOUT',role:'floor_area'});
    const original=structuredClone(session.exportPayload());
    const grid={single_item:true,spacing_ft:1,pattern:'square',angle_deg:0,inset_ft:0,offset_x_ft:.5,offset_y_ft:.5,origin_norm:[.1,.1],reference:'Synthetic support grid on bundled plan; spacing assumed'};
    const result=await call({shape_id:area.shape_id,area_grid:grid}); assert.ok(result.grid_count>0);
    const changed=structuredClone(session.shapes[0]); delete changed.area_grid;
    assert.deepEqual(changed,original.shapes[0]);
    const saved=structuredClone(session.exportPayload());
    const cutConfig={...grid,cut_pieces:true,footprint:{kind:'rectangle',width_ft:1,depth_ft:1,basis:'assumed',reference:'Nominal square module for this test'}};
    const cuts=await call({shape_id:area.shape_id,area_grid:cutConfig});
    assert.equal(cuts.grid_count,result.grid_count);
    assert.ok(cuts.grid_cuts.full_tiles>0);assert.ok(cuts.grid_cuts.edge_cut_pieces>0);
    assert.equal(Math.round(cuts.grid_cuts.covered_sf*100)/100,original.shapes[0].computed.area_sf);
    await client.callTool({name:'undo_last',arguments:{}});assert.deepEqual(session.exportPayload(),saved);
    for(const patch of [{pattern:'triangular'},{inset_ft:.5},{footprint:{...cutConfig.footprint,width_ft:2}}]){
      await call({shape_id:area.shape_id,area_grid:{...cutConfig,...patch}},true);assert.deepEqual(session.exportPayload(),saved);
    }
    for (const footprint of [{kind:'circle',diameter_ft:.625,basis:'assumed',reference:'Test container'}, {kind:'rectangle',width_ft:2,depth_ft:2,basis:'specified',reference:'Test module'}]) {
      const footprintResult=await call({shape_id:area.shape_id,area_grid:{...grid,footprint}});
      assert.equal(footprintResult.grid_count,result.grid_count);
      assert.deepEqual(session.shapes[0].area_grid?.footprint,footprint);
      await client.callTool({name:'undo_last',arguments:{}});assert.deepEqual(session.exportPayload(),saved);
    }
    for (const footprint of [{kind:'circle',diameter_ft:0,basis:'assumed',reference:'Test'}, {kind:'rectangle',width_ft:2,basis:'assumed',reference:'Test'}, {kind:'circle',diameter_ft:1,basis:'approved',reference:'Test'}]) {
      await call({shape_id:area.shape_id,area_grid:{...grid,footprint}},true);assert.deepEqual(session.exportPayload(),saved);
    }
    for(const patch of [{area_grid:{...grid,single_item:false}},{area_grid:{...grid,source_callout_id:'missing'}},{area_grid:grid,label:'combined'},{area_grid:grid,planting_grid:null},{planting_grid:null}]) {
      await call({shape_id:area.shape_id,...patch},true); assert.deepEqual(session.exportPayload(),saved);
    }
    await client.callTool({name:'undo_last',arguments:{}}); assert.deepEqual(session.exportPayload(),original);
    await call({shape_id:area.shape_id,area_grid:grid});
    session.shapes[0].origin!.reviewed=true; // Test fixture only.
    const accepted=structuredClone(session.exportPayload());
    await call({shape_id:area.shape_id,area_grid:null},true); assert.deepEqual(session.exportPayload(),accepted);
  } finally {await client.close();await server.close();}
});

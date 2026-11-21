import { test } from "node:test";
import assert from "node:assert/strict";
import { calloutQuantityError, countBasisText } from "../src/lib/calloutQuantity.js";
import { conditionTotals, totalsToCsv, reportJson, sheetTotals } from "../src/lib/totals.js";
import { reportWorkbook } from "../src/lib/xlsx.js";
import { mergeTakeoffImport } from "../src/lib/importTakeoff.js";
import { applyShapeCommand } from "../src/lib/shapeCommands.js";
import { filterWork, workMethod, workQuantity } from "../src/lib/workReview.js";
import { buildContribution } from "../src/lib/contribute.js";
import { computeShapeMetrics, recalibrateShapes } from "../src/lib/shapeMetrics.js";
import { buildSheetDxf } from "../src/lib/dxf.ts";

const cond = { id: "c", finish_tag: "pa", multiplier: 1, waste_pct: 5, materials: [] };
const located = { id: "one", condition_id: "c", sheet_id: "source.pdf", measure_role: "count", verts_norm: [[.1,.1]] as [number,number][], computed: {count:1}, origin: { method: "manual", actor: "agent", reviewed: true } };
const callout = { ...located, id: "callout", verts_norm: [[.2,.2]] as [number,number][], computed: {count:12}, quantity_source: {kind:"printed_callout",unit:"EA",id:"C1",text:"(12) pa",reference:"L1.0 west bed"}, origin:{method:"printed_callout",actor:"agent",reviewed:false} };
test("printed callout import preserves IDs and decisions, refuses invalid quantities before merging", () => {
  const before = { schema:"opentakeoff.takeoff_canvas.v1", conditions:[cond], shapes:[located], sheets:[], markups:[] };
  const incoming = {...before, shapes:[callout]};
  const merged = mergeTakeoffImport(before,incoming).payload;
  assert.deepEqual(merged.shapes,[located,callout]);
  assert.deepEqual(mergeTakeoffImport(merged,incoming).payload.shapes,merged.shapes);
  const approved = {...callout, origin:{...callout.origin,reviewed:true}};
  assert.deepEqual(mergeTakeoffImport({...merged,shapes:[located,approved]},incoming).payload.shapes,[located,approved]);
  for (const patch of [{computed:{count:0}}, {computed:{count:-1}}, {computed:{count:1.5}}, {verts_norm:[]}, {verts_norm:["ab"]}, {verts_norm:[[NaN,0]]}, {measure_role:"linear"}, {quantity_source:{...callout.quantity_source,unit:"SF"}}]) {
    assert.throws(()=>mergeTakeoffImport(before,{...incoming,shapes:[{...callout,...patch}]}), /Couldn't import/);
  }
  assert.equal(calloutQuantityError(callout), null);
});
test("printed EA stays separate through report, CSV, workbook, search, review and geometry-only contribution", () => {
  const shapes=[located,callout], rows=conditionTotals([cond],shapes), bySheet=sheetTotals([cond],shapes);
  assert.equal(rows[0].ea,13);
  assert.deepEqual(rows[0].count_basis,{located_ea:1,printed_ea:12});
  assert.equal(countBasisText(rows[0]),"1 EA located; 12 EA from printed callouts");
  assert.deepEqual(reportJson({rows,bySheet}).conditions[0].count_basis,rows[0].count_basis);
  assert.match(totalsToCsv(rows), /Located EA,Printed callout EA/);
  assert.ok(reportWorkbook({rows,bySheet,shapeRows:[]})[0].rows.some((r:any[])=>r[0]==="pa"&&r[1]===1&&r[2]===12));
  assert.deepEqual(conditionTotals([{...cond,multiplier:2}],shapes)[0].count_basis,{located_ea:2,printed_ea:24});
  assert.equal(conditionTotals([cond],[located])[0].count_basis,undefined,"legacy output remains unchanged");
  assert.equal(workMethod(callout),"Printed callout");
  assert.equal(workQuantity(callout).value,12);
  assert.deepEqual(computeShapeMetrics(callout,{w:1000,h:1000},.2),{count:12},"moving a source anchor cannot reprice its printed quantity");
  assert.deepEqual(recalibrateShapes(shapes,{w:1000,h:1000},.2,[cond]),shapes);
  const dxf=buildSheetDxf({sheet_id:"source.pdf",dims:{w:1000,h:1000},upp:.2,shapes,conditions:[cond]});
  assert.equal(dxf.shapes,1);
  assert.equal(dxf.skipped[0].id,callout.id);
  assert.match(dxf.skipped[0].reason,/source anchor/);
  assert.deepEqual(filterWork(shapes,{query:"west bed"}),[callout]);
  const contribution=buildContribution({conditions:[cond],shapes});
  assert.equal(contribution.shapes.length,1);
  assert.equal(contribution.excluded_printed_callouts,1);
  assert.ok(!JSON.stringify(contribution).includes("west bed"));
  const reviewed=applyShapeCommand(shapes,{type:"review",ids:[callout.id]});
  assert.equal(reviewed.shapes[1].origin.reviewed,true);
  assert.deepEqual(reviewed.shapes[1].quantity_source,callout.quantity_source);
  assert.deepEqual(applyShapeCommand(reviewed.shapes,reviewed.inverse).shapes,shapes);
});

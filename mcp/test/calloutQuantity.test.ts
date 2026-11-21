import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../server.ts";
import { Session } from "../src/session.ts";

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

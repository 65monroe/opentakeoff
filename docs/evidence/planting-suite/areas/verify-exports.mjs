// Compare actual UI downloads with the backed-up browser project and MCP output.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const baseline = await read('baseline.json');
const measured = await read('takeoff.json');
const before = await read('browser-before-reopen.json');
const after = await read('browser-after-reopen.json');
const areas = measured.shapes.filter((s) => s.source_callout_ids);
assert.equal(baseline.shapes.length, 5);
assert.equal(areas.length, 2);
for (const saved of [before, after]) {
  assert.equal(saved.shapes.length, 7);
  assert.equal(new Set(saved.shapes.map((s) => s.id)).size, 7);
  for (const source of baseline.shapes) assert.deepEqual(saved.shapes.find((s) => s.id === source.id), source);
  for (const condition of baseline.conditions) assert.deepEqual(saved.conditions.find((c) => c.id === condition.id), condition);
  for (const area of areas) assert.deepEqual(saved.shapes.find((s) => s.id === area.id), area);
  assert.deepEqual(saved.sheets, baseline.sheets);
  assert.deepEqual(saved.markups, baseline.markups);
  assert.deepEqual(saved.proposals, measured.proposals);
  assert.equal(saved.shapes.filter((s) => s.origin?.reviewed === false).length, 7);
  const set = saved.shapes.filter((s) => s.quantity_source);
  assert.deepEqual(set.map((s) => s.computed.count), [127, 58]);
  assert.equal(set.reduce((n, s) => n + s.computed.count, 0), 185);
}
assert.deepEqual(after, before);
console.log('PASS: all 5 baseline records exact; 2 linked areas exact after edit/undo; 127 + 58 = 185 EA; 7 pending; complete browser export equal after archive reopen.');

// Verify actual UI downloads. This does not drive the browser or create data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const baseline = await read('../reviewable/takeoff.json');
const snapshots = [
  'takeoff-before-reopen.json',
  'takeoff-after-reload.json',
  'takeoff-after-archive-reopen.json',
];
const files = [];
let first;
for (const name of snapshots) {
  const current = await read(name);
  assert.deepEqual(current, { ...baseline, sheet_tabs: ['ccfp-L1.0.pdf'] }, name);
  assert.equal(current.shapes.length, 5);
  assert.equal(current.shapes.filter((shape) => shape.origin.reviewed === false).length, 5);
  if (first) assert.deepEqual(current, first, name);
  else first = current;
  files.push({ file: name, sha256: createHash('sha256').update(await readFile(new URL(name, import.meta.url))).digest('hex') });
}
const reportBefore = await read('report-before-reopen.json');
const reportAfter = await read('report-after-archive-reopen.json');
assert.deepEqual(reportAfter, reportBefore, 'Report changes after archive reopen');
assert.deepEqual(Object.fromEntries(reportAfter.conditions.map((condition) => [condition.finish_tag, condition.ea])), { GDI: 1, TAM: 2, SET: 185 });
const set = reportAfter.conditions.find((condition) => condition.finish_tag === 'SET');
assert.deepEqual(set.count_basis, { located_ea: 0, printed_ea: 185 });
assert.deepEqual(set.printed_callouts.map((source) => [source.source_id, source.quantity, source.reviewed]), [['C1', 127, false], ['C2', 58, false]]);
assert.equal(reportAfter.totals.ea, 188);

console.log(JSON.stringify({
  status: 'pass',
  scope: 'Recorded browser downloads; this script does not repeat the UI test',
  comparison: 'Complete takeoff objects match the MCP baseline, except the expected open-sheet tab list',
  permitted_difference: { field: 'sheet_tabs', baseline: [], browser: ['ccfp-L1.0.pdf'] },
  browser_exports_equal: true,
  report_exports_equal: true,
  shapes: baseline.shapes.map((shape) => ({ id: shape.id, condition_id: shape.condition_id, quantity: shape.computed.count, reviewed: shape.origin.reviewed, source_id: shape.quantity_source?.id ?? null })),
  condition_totals_ea: { GDI: 1, TAM: 2, SET: 185 },
  set_count_basis: set.count_basis,
  files,
}, null, 2));

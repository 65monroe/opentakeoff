import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areaAssembly, assemblyAreas, materialDraftError, materialDraftPatch, hasMaterialDepth, materialDepthInches, materialDepthEdit } from '../src/lib/areaAssembly.js';
import { conditionTotals } from '../src/lib/totals.js';

const fixture = () => JSON.parse(readFileSync(new URL('../../docs/evidence/area-assembly-prototype/prototype.takeoff.json', import.meta.url), 'utf8'));
const setup = () => {
  const p = fixture(), conditions = Object.fromEntries(p.conditions.map((c: any) => [c.id, c]));
  const bed = p.shapes.find((s: any) => s.label === 'C1 SET hatch');
  return { p, conditions, bed };
};

test('public bed joins native materials, 127 source EA and one 48.17 LF run without mutation', () => {
  const { p, conditions, bed } = setup(), before = structuredClone(p);
  const view = areaAssembly(bed, p.shapes, conditions);
  assert.deepEqual(view.materials.map((r: any) => [r.total.qty, r.total.unit, r.depth]), [[1.36, 'CY', 4], [1.36, 'CY', 4]]);
  assert.deepEqual(view.sources.map((r: any) => r.shape.computed.count), [127]);
  assert.deepEqual(view.edges.map((r: any) => [r.shape.computed.perimeter_lf, r.stale]), [[48.17, false]]);
  assert.equal(view.editReason, '');
  assert.deepEqual(assemblyAreas(view.sources[0].shape, p.shapes).map((s: any) => s.id), [bed.id]);
  assert.deepEqual(assemblyAreas(view.edges[0].shape, p.shapes).map((s: any) => s.id), [bed.id]);
  assert.deepEqual(p, before);
});

test('shared source quantities are disclosed, never allocated or matched by plant name', () => {
  const { p, conditions, bed } = setup();
  p.shapes.push({ ...structuredClone(bed), id: 'second-bed', condition_id: 'other-condition' });
  bed.source_callout_ids.push('missing-source');
  const view = areaAssembly(bed, p.shapes, conditions);
  assert.equal(view.sources.length, 2);
  assert.equal(view.sources[0].shared, true);
  assert.equal(view.sources[0].shape.computed.count, 127);
  assert.equal(view.sources[1].shape, undefined);
  const source = view.sources[0].shape;
  assert.equal(assemblyAreas(source, p.shapes).length, 2);
  assert.equal(assemblyAreas({ ...source, sheet_id: 'different-sheet' }, p.shapes).length, 0);
  bed.source_callout_ids.push(bed.source_callout_ids[0]);
  assert.equal(areaAssembly(bed, p.shapes, conditions).sources.length, 2);
});

test('bed-local editing withholds shared condition and material-family writes', () => {
  const { p, conditions, bed } = setup();
  p.shapes.push({ ...bed, id: 'same-condition-second-area' });
  assert.match(areaAssembly(bed, p.shapes, conditions).editReason, /every measurement/);
  p.shapes.pop();
  conditions[bed.condition_id].variant_of = 'family-parent';
  assert.match(areaAssembly(bed, p.shapes, conditions).editReason, /family/);
  delete conditions[bed.condition_id].variant_of;
  conditions.child = { id: 'child', variant_of: bed.condition_id };
  assert.match(areaAssembly(bed, p.shapes, conditions).editReason, /family/);
});

test('a changed bed boundary warns without recomputing the independent run', () => {
  const { p, conditions, bed } = setup();
  bed.verts_norm[0][0] += 0.001;
  const view = areaAssembly(bed, p.shapes, conditions);
  assert.equal(view.edges[0].stale, true);
  assert.equal(view.edges[0].shape.computed.perimeter_lf, 48.17);
  assert.equal(view.edges[0].shape.origin.reviewed, false);
});

test('material draft is a patch on the same row; invalid rates and units are refused', () => {
  const { p, conditions, bed } = setup();
  const row = conditions[bed.condition_id].materials[1];
  assert.deepEqual(materialDraftPatch(row, row), {});
  const draft = { ...row, per: 64.8, note: 'Assumed five-inch test layer', name: 'Compost — test 5 in' };
  assert.equal(materialDraftError(draft), '');
  assert.deepEqual(materialDraftPatch(row, draft), { name: draft.name, per: 64.8, note: draft.note });
  assert.match(materialDraftError({ ...draft, per: 0 }), /positive/);
  assert.match(materialDraftError({ ...draft, unit: '' }), /unit/);
  assert.match(materialDraftError({ ...draft, per: NaN }), /positive/);
  const changed = structuredClone(conditions);changed[bed.condition_id].materials[1] = draft;
  assert.deepEqual(areaAssembly(bed, p.shapes, changed).materials.map((r: any) => r.total.qty), [1.36, 1.71]);
  changed[bed.condition_id].materials[1].rule = 'each';
  assert.equal(areaAssembly(bed, p.shapes, changed).materials[1].depth, null);
});

test('inch edits use native CY coverage and preserve every other material and measurement field', () => {
  const { p, conditions, bed } = setup(), before = structuredClone(p), c = conditions[bed.condition_id];
  for (const [inches, per, cy] of [[4, 81, 1.36], [6, 54, 2.05], [2.5, 129.6, 0.85]]) {
    const change = materialDepthEdit(c.materials[0], String(inches));
    assert.deepEqual(change, { patch: { per } });
    const row = { ...c.materials[0], ...change.patch };
    assert.equal(materialDepthInches(row), inches);
    assert.equal(conditionTotals([{ ...c, materials: [row] }], p.shapes)[0].materials[0].qty, cy);
    const copy = { ...row, per: c.materials[0].per }; assert.deepEqual(copy, c.materials[0]);
  }
  assert.deepEqual(p, before);
});

test('invalid inch inputs cannot create a rate; unrelated units and rules do not expose depth', () => {
  const { conditions, bed } = setup(), row = conditions[bed.condition_id].materials[0];
  for (const input of ['', ' ', '0', '-2', 'abc', 'Infinity', '1e-320']) assert.ok(materialDepthEdit(row, input).error);
  for (const patch of [{ unit: 'EA' }, { unit: 'TON' }, { basis: 'linear' }, { rule: 'each' }]) {
    const other = { ...row, ...patch };
    assert.equal(hasMaterialDepth(other), false);
    assert.equal(materialDepthInches(other), null);
    assert.ok(materialDepthEdit(other, '6').error);
  }
  assert.equal(materialDepthInches({ ...row, per: Infinity }), null);
  assert.equal(materialDepthInches({ ...row, basis: undefined, unit: 'cy' }), 4);
});

test('depth keeps native multiplier, item waste and package rounding semantics', () => {
  const { p, conditions, bed } = setup(), c = structuredClone(conditions[bed.condition_id]);
  const row = { ...c.materials[0], ...materialDepthEdit(c.materials[0], '6').patch, waste_pct: 10, round: true };
  c.multiplier = 2; c.materials = [row];
  assert.equal(conditionTotals([c], p.shapes)[0].materials[0].qty, 5);
});

test('one mixed area keeps six explicit source rows independent of layer depth', () => {
  const { p, conditions, bed } = setup();
  // Synthetic relationship test only; these are not additional public-plan quantities.
  const source = p.shapes.find((s: any) => s.id === bed.source_callout_ids[0]);
  bed.source_callout_ids = [];
  for (let n = 1; n <= 6; n++) {
    const s = structuredClone(source); s.id = `test-source-${n}`; s.condition_id = `test-code-${n}`;
    s.quantity_source = { ...s.quantity_source, id: `TEST-C${n}`, text: `${n} - TEST${n}`, reference: 'Synthetic relationship test, not public-plan work' };
    conditions[s.condition_id] = { id: s.condition_id, finish_tag: `TEST${n}` };
    s.computed.count = n; s.origin.reviewed = n % 2 === 0;
    p.shapes.push(s); bed.source_callout_ids.push(s.id);
  }
  const before = structuredClone(p.shapes);
  Object.assign(conditions[bed.condition_id].materials[0], materialDepthEdit(conditions[bed.condition_id].materials[0], '6').patch);
  const view = areaAssembly(bed, p.shapes, conditions);
  assert.deepEqual(view.sources.map((x: any) => x.shape.computed.count), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(p.shapes, before);
  assert.equal(view.materials[0].total.qty, 2.05);
});

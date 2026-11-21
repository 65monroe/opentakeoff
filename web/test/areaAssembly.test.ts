import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areaAssembly, assemblyAreas, materialDraftError, materialDraftPatch } from '../src/lib/areaAssembly.js';

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

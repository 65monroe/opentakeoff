import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {areaGrid} from '../../../web/src/lib/areaGrid.js';
import {areaGridCuts} from '../../../web/src/lib/areaGridCuts.js';
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const before = await read('before.json'), aligned = await read('aligned.json');
const saved = await read('browser-saved.json'), reopened = await read('after-reopen.json');
assert.deepEqual(before, await read('../area-grid-source/after.json'));
assert.deepEqual(await read('undo.json'), before);
const original = structuredClone(aligned);
original.shapes[0].area_grid = before.shapes[0].area_grid;
assert.deepEqual(original, before, 'Only the explicit area_grid configuration may change.');
const browserWithoutViewChange = structuredClone(saved);
assert.deepEqual(browserWithoutViewChange.sheet_tabs, ['mo-veterans-home-A111-reflected-ceiling-plan.pdf']);
browserWithoutViewChange.sheet_tabs = aligned.sheet_tabs;
assert.deepEqual(browserWithoutViewChange, aligned, 'Browser save must preserve the MCP record.');
assert.deepEqual(await read('after-reload.json'), saved);
assert.deepEqual(reopened, saved);
const shape = reopened.shapes[0], grid = shape.area_grid;
assert.equal(shape.id, 'shp-1db5dfa0-f9ae-489a-8bd3-0e4ec9ba067a');
assert.equal(shape.condition_id, 'cnd-99390bdb-e86a-4c25-8b9c-48effdb33b08');
assert.deepEqual(shape.computed, {area_sf: 175.73, perimeter_lf: 60.4});
assert.equal(shape.origin.reviewed, false);
assert.equal(grid.pattern, 'square');
assert.equal(grid.spacing_ft, 2);
assert.equal(grid.spacing_y_ft, undefined);
assert.equal(grid.angle_deg, 0);
assert.equal(grid.offset_x_ft, 1);
assert.equal(grid.offset_y_ft, 1);
assert.equal(grid.footprint.width_ft, 2);
assert.equal(grid.footprint.depth_ft, 2);
assert.equal(grid.footprint.basis, 'assumed');
const frame = {widthPx: 5184, heightPx: 3456, upp: reopened.sheets[0].units_per_px};
assert.equal(areaGrid(shape, frame).count, 45);
const cuts = areaGridCuts(shape, frame), oracle = await read('../area-grid-cuts/expected.json');
assert.equal(cuts.error, null);
assert.equal(cuts.full_tiles, oracle.full_tiles);
assert.equal(cuts.edge_cut_pieces, oracle.cut_cells);
assert.deepEqual(cuts.cells.map(c => [c.key, c.kind]), oracle.cells.map(c => [c.key, c.kind]));
cuts.cells.forEach((c, i) => assert.ok(Math.abs(c.area_sf - oracle.cells[i].area_sf) < 1e-8));
// Negative guard: a measured-area change must not disappear in the comparison.
const changed = structuredClone(original);
changed.shapes[0].computed.area_sf += 1;
assert.throws(() => assert.deepEqual(changed, before));
console.log(JSON.stringify({preserved: 'Every field outside area_grid; browser active-sheet tab is the sole view-state difference',
  saved_reload_reopen_equal: true, full_tiles: cuts.full_tiles, edge_cut_pieces: cuts.edge_cut_pieces,
  derived_centers: 45, measured: shape.computed, new_approvals: 0,
  reopened_json_sha256: createHash('sha256').update(JSON.stringify(reopened)).digest('hex')}, null, 2));

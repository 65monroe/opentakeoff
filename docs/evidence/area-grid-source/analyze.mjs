import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fitGridLines, centerOffsets, explainLines} from './fit.mjs';

const dir = resolve(process.argv[2] || 'docs/evidence/area-grid-source');
const read = async name => JSON.parse(await readFile(resolve(dir, name), 'utf8'));
const [pages, info, before, after] = await Promise.all(['vectors.json', 'sheet-info.json', 'before.json', 'after.json'].map(read));
assert.deepEqual(after, before, 'All saved project fields must stay equal.');
assert.equal(pages.reduce((n, p) => n + p.returned, 0), pages[0].total);
assert.ok(pages.every((p, i) => p.offset === pages.slice(0, i).reduce((n, q) => n + q.returned, 0) && p.dropped === 0));
const pageImageFraction = pages[0].image_area / (info.width_px * info.height_px);
assert.ok(pageImageFraction < 0.5, 'Image-dominated sheet needs separate visual/OCR review.');
const shape = before.shapes[0], ring = shape.verts_norm.map(([x, y]) => [x * info.width_px, y * info.height_px]);
function inside([x, y]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) hit = !hit;
  }
  return hit;
}
const selected = pages.flatMap(p => p.meta.flatMap((meta, i) => {
  const line = p.points.slice(i * 4, i * 4 + 4), [x1, y1, x2, y2] = line;
  // Analyst selected this gray stroke style after inspecting the actual source
  // image. It is specific to this bay; color alone is not a ceiling classifier.
  return meta === 16 && p.lum[i] === 216 && inside([(x1 + x2) / 2, (y1 + y2) / 2])
    ? [{index: p.offset + i, line}] : [];
}));
const fit = fitGridLines(selected.map(s => s.line));
// Only now read the saved origin, to express the independently fitted phase in
// existing application coordinates. Saved angle/pitch/offset never seed the fit.
const origin = shape.area_grid.origin_norm.map((v, i) => v * [info.width_px, info.height_px][i]);
const offsets = centerOffsets(fit, origin, info.upp);
const phaseOptions = (px, py) => [0, 1].map(parity => {
  const ax = fit.x.anchor_px + (px > fit.x.pitch_px ? parity * fit.x.pitch_px : 0);
  const ay = fit.y.anchor_px + (py > fit.y.pitch_px ? parity * fit.y.pitch_px : 0);
  return {parity, ...explainLines(fit, px, py, ax, ay)};
});
const suggested = {
  status: 'unapplied source-alignment suggestion; module specification still requires review',
  shape_id: shape.id, condition_id: shape.condition_id,
  source: {sheet: info.sheet, page: info.page, frame_px: [info.width_px, info.height_px],
    coordinates: 'full-sheet image pixels, top left origin, y down',
    candidate_selection: 'Analyst-selected pen bucket 1, luminance 216, no curve/clip/fill flags, midpoint inside existing bay',
    candidate_indices: selected.map(s => s.index), vectors_returned: pages[0].total,
    page_image_area_fraction: pageImageFraction,
    image_check: 'The page has a small image area. The bay strokes are present as repeated raw PDF vectors and were visually checked against view_sheet.'},
  fit,
  suggested_layout: {pattern: 'square', angle_deg: fit.angle_deg,
    spacing_ft: fit.x.pitch_px * info.upp, spacing_y_ft_for_comparison_only: fit.y.pitch_px * info.upp,
    origin_px: origin, origin_norm: shape.area_grid.origin_norm,
    offset_x_ft: offsets[0], offset_y_ft: offsets[1],
    offset_basis: 'Module centers, half a pitch from the observed edge lines, relative to the unchanged origin'},
  line_agreement: {
    drawn_square: explainLines(fit, fit.x.pitch_px, fit.y.pitch_px),
    alternative_2_by_4_at_0: phaseOptions(18, 36),
    alternative_2_by_4_at_90: phaseOptions(36, 18)
  },
  caveats: [
    'The legend permits 2-by-2 or 2-by-4. Repeated lines support a 2-foot square drawn grid; they do not establish a tile procurement specification.',
    'Square geometry is unchanged at 90 degrees. Main-runner direction is not established.',
    'Scale is agent-set and unconfirmed. Pixel pitch is observed; feet depend on that calibration.',
    'Source X positions include a 0.24-pixel deviation (0.32 inch at the saved scale); the fitted lattice is an approximation.',
    'No search for a target quantity, fewer cuts, best purchasing result or approval is performed.'
  ],
  preservation: {complete_project_equal: true, project_json_sha256: createHash('sha256').update(JSON.stringify(before)).digest('hex'),
    shapes: before.shapes.length, conditions: before.conditions.length, stored_quantity: shape.computed,
    review: shape.origin, grid_configuration_unchanged: true, new_measurements: 0, new_approvals: 0}
};
await writeFile(resolve(dir, 'suggestion.json'), JSON.stringify(suggested, null, 2) + '\n');
await writeFile(resolve(dir, 'selected-strokes.json'), JSON.stringify(selected, null, 2) + '\n');
console.log(JSON.stringify({fit, offsets_ft: offsets, preservation: suggested.preservation, line_agreement: suggested.line_agreement}, null, 2));

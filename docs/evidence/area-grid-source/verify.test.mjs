import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fitGridLines, centerOffsets, explainLines} from './fit.mjs';
const evidence = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : new URL('.', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} differs from ${b}`);
const strokes = read('selected-strokes.json').map(s => s.line);
const sourceFit = fitGridLines(strokes);

test('public A111: independent 18-pixel families, known source positions, complete ledger', () => {
  assert.equal(sourceFit.angle_deg, 0);
  assert.equal(sourceFit.x.pitch_px, 18);
  assert.equal(sourceFit.y.pitch_px, 18);
  assert.equal(sourceFit.x.line_count, 9);
  assert.equal(sourceFit.y.line_count, 7);
  assert.equal(sourceFit.x.anchor_px, 1883.76);
  assert.equal(sourceFit.y.anchor_px, 197.28);
  assert.equal(sourceFit.x.max_residual_px, 0.24);
  assert.equal(sourceFit.y.max_residual_px, 0);
  const pages = read('vectors.json');
  assert.equal(pages.reduce((n, p) => n + p.returned + p.dropped, 0), pages[0].total);
  assert.equal(pages[0].total, 267);
  assert.ok(pages.every(p => p.dropped === 0));
});
test('center offsets differ from edge phase by half a module', () => {
  assert.deepEqual(centerOffsets(sourceFit, [1883.76, 197.28], 1 / 9), [1, 1]);
  assert.deepEqual(centerOffsets(sourceFit, [1888.26, 199.53], 1 / 9), [0.5, 0.75]);
  assert.notDeepEqual(centerOffsets(sourceFit, [1883.76, 197.28], 1 / 9), [0, 0]);
});
test('2-by-4 alternatives cannot explain all observed boundaries', () => {
  const square = explainLines(sourceFit, 18, 18);
  const rect0 = explainLines(sourceFit, 18, 36);
  const rect90 = explainLines(sourceFit, 36, 18);
  assert.equal(square.x + square.y, 16);
  assert.equal(rect0.x + rect0.y, 13);
  assert.equal(rect90.x + rect90.y, 12);
});
test('one-foot wrong edge phase explains none of the actual lines', () => {
  const wrong = explainLines(sourceFit, 18, 18, 1892.76, 206.28);
  assert.equal(wrong.x + wrong.y, 0);
});
test('no hidden angle, pitch or phase seed: rotated rectangular synthetic fixture', () => {
  const angle = 23, rad = angle * Math.PI / 180;
  const transform = ([x, y]) => [13 + Math.cos(rad) * x - Math.sin(rad) * y, 17 + Math.sin(rad) * x + Math.cos(rad) * y];
  const line = (a, b) => [...transform(a), ...transform(b)];
  const input = [];
  for (let i = 0; i < 6; i++) {
    input.push(line([3 + 18 * i, 5], [3 + 18 * i, 185]));
    input.push(line([3, 5 + 36 * i], [93, 5 + 36 * i]));
  }
  const fit = fitGridLines(input);
  close(fit.angle_deg, 23);
  close(fit.x.pitch_px, 18);
  close(fit.y.pitch_px, 36);
  const offsets = centerOffsets(fit, [13, 17], 1 / 9);
  close(offsets[0], 12 / 9);
  close(offsets[1], 23 / 9);
});
test('actual neighboring gypsum strokes withhold; no matching grid family', () => {
  const pages = read('gypsum-vectors.json');
  assert.equal(pages[0].total, 9);
  const candidates = pages.flatMap(p => p.meta.flatMap((m, i) => m === 16 && p.lum[i] === 216 ? [p.points.slice(i * 4, i * 4 + 4)] : []));
  assert.throws(() => fitGridLines(candidates), /Too few/);
});
test('missing line and inconsistent phase refuse instead of forcing a lattice', () => {
  assert.throws(() => fitGridLines(strokes.filter(s => s[0] !== 1955.76)), /Irregular or missing/);
  const bad = structuredClone(strokes);
  const line = bad.find(s => s[0] === 1955.76);
  line[0] += 2; line[2] += 2;
  assert.throws(() => fitGridLines(bad), /Irregular or missing/);
});
test('import, before and after retain every field, not only totals', () => {
  const baseline = JSON.parse(readFileSync(new URL('../area-grid-rectangles/ceiling-0.json', import.meta.url)));
  assert.deepEqual(read('before.json'), baseline);
  assert.deepEqual(read('after.json'), baseline);
  assert.equal(baseline.shapes[0].id, 'shp-1db5dfa0-f9ae-489a-8bd3-0e4ec9ba067a');
  assert.equal(baseline.shapes[0].origin.reviewed, false);
  assert.deepEqual(baseline.shapes[0].computed, {area_sf: 175.73, perimeter_lf: 60.4});
  assert.equal(read('suggestion.json').status.startsWith('unapplied'), true);
});

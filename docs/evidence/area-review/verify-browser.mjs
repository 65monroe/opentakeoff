// Compare fresh UI exports with their pre-test backups. No browser/state writes.
// Run after the documented UI flow; local PDF-containing archives stay in tmp/.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {parseProjectArchive} from '../../../web/src/lib/projectArchive.js';

const folder = process.argv[2] || 'tmp/area-review-audit';
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const before = await readJSON(`${folder}/live-baseline.json`);
const restored = await readJSON(`${folder}/live-restored.json`);
assert.ok(isDeepStrictEqual(before, restored), 'Planting project differs from fresh backup');
const ceiling = await readJSON(`${folder}/ceiling-current.json`);
const expected = await readJSON('docs/evidence/area-grid-actual-2x4/browser-saved.json');
assert.ok(isDeepStrictEqual(ceiling, expected), 'Ceiling project differs from saved baseline');

async function archiveSnapshot(path) {
  const {takeoff, pdfs} = await parseProjectArchive(await readFile(path));
  const plans = await Promise.all(pdfs.map(async file => ({
    name: file.name, bytes: file.size, sha256: hash(new Uint8Array(await file.arrayBuffer())),
  })));
  return {takeoff, plans: plans.sort((a, b) => a.name.localeCompare(b.name))};
}
const originalArchive = await archiveSnapshot(`${folder}/live-baseline.otk`);
const restoredArchive = await archiveSnapshot(`${folder}/live-restored.otk`);
assert.ok(isDeepStrictEqual(originalArchive, restoredArchive), 'Archive records or stored PDFs differ');
assert.ok(isDeepStrictEqual(before, restoredArchive.takeoff), 'Archive and JSON exports differ');
const result = {
  date: '2026-11-22',
  browser: 'Codex in-app browser, existing 127.0.0.1:5200 tab',
  app_source_commit: '37f568b',
  documentation_head_before_audit: 'b3604b8b623d8019080640588d0f0def7a77a7a3',
  script_asset: 'assets/index-DeAp0Zrx.js',
  script_sha256: hash(await readFile('web/dist/assets/index-DeAp0Zrx.js')),
  public_2x4: {
    actual_current_build_flow: ['Open saved archive', 'Select ACT-2X4-PUBLIC', 'Show on plan', 'Open edge-cut schedule', 'Adjust grid', 'Cancel', 'Export'],
    full_project_equality: true,
    results: {area_sf: 899, full_tiles: 78, edge_cut_pieces: 42},
    save_reopen_evidence: '../area-grid-actual-2x4/README.md',
  },
  planting_restoration: {
    actual_flow: ['Export fresh JSON and archive backup', 'Restore backup after ceiling test', 'Locate SET in compact C2 panel', 'Remove only temporary AM3.10 PDF', 'Export JSON and archive'],
    full_project_equality: true,
    archive_takeoff_and_pdf_equality: true,
    measurements: before.shapes.length,
    conditions: before.conditions.length,
    pending_review: before.shapes.filter(s => s.origin?.reviewed === false).length,
    preserved: ['All project fields', 'IDs', 'Geometry', 'Quantities', 'Calibration', 'Sources', 'Review states', 'Original PDF inventory and bytes'],
    plans: originalArchive.plans,
    save_reopen_evidence: '../c1-spacing-note/README.md',
  },
  limits: ['This audit revisits the current UI and restores the backup; prior dedicated save/reopen runs are linked separately.', 'Desktop layout checked; no mobile or human review-speed claim.'],
};
await writeFile(new URL('browser-checks.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log('PASS: exact ceiling and planting project equality; original PDFs restored byte-for-byte.');

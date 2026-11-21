// Package verified MCP output with its public source through the existing
// OpenTakeoff archive writer. This does not create or change measurements.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { buildProjectArchive, parseProjectArchive } from '../../../web/src/lib/projectArchive.js';
const [planPath,takeoffPath,outputPath]=process.argv.slice(2);
assert.ok(planPath&&takeoffPath&&outputPath,'node package-review.mjs SOURCE.pdf TAKEOFF.json OUTPUT.otk');
const takeoff=JSON.parse(await readFile(takeoffPath,'utf8'));
const plan=new Uint8Array(await readFile(planPath));
const bytes=await buildProjectArchive({takeoff,sheets:[{name:'ccfp-L1.0.pdf'}],loadPdfData:async()=>plan,projectName:'Public planting review - selected GDI, TAM and SET'});
const unpacked=await parseProjectArchive(bytes);
assert.deepEqual(unpacked.takeoff,takeoff);
assert.deepEqual(new Uint8Array(await unpacked.pdfs[0].arrayBuffer()),plan);
await writeFile(outputPath,bytes);
console.log('Archive round-trip passed: exact takeoff and source PDF bytes. Browser opening is a separate check.');

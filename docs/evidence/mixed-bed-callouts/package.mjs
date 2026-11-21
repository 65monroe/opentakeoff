// Package the public single-sheet example; no unrelated browser PDFs included.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildProjectArchive} from '../../../web/src/lib/projectArchive.js';
const [pdfArg,outputArg]=process.argv.slice(2);
assert.ok(pdfArg&&outputArg,'node package.mjs SOURCE_L1.0.pdf OUTPUT.otk');
const takeoff=JSON.parse(await readFile(new URL('./mixed-bed.takeoff.json',import.meta.url),'utf8'));
const pdf=new Uint8Array(await readFile(resolve(pdfArg)));
await writeFile(resolve(outputArg),await buildProjectArchive({takeoff,sheets:[{name:'ccfp-L1.0.pdf'}],loadPdfData:async()=>pdf,projectName:'Public C2 mixed planting bed — eight source quantities'}));

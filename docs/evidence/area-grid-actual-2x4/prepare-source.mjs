// Download the public source separately; do not commit the source PDF or archive.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const r=createRequire(resolve('web/package.json')),{PDFDocument}=r('pdf-lib');
const input=resolve(process.argv[2]||'tmp/area-grid-actual-2x4/rancho-cordova-source.pdf');
const output=resolve(process.argv[3]||'tmp/area-grid-actual-2x4/rancho-cordova-AM3.10.pdf');
const bytes=await readFile(input);
assert.equal(createHash('sha256').update(bytes).digest('hex'),'280b4273458c9c8cc35f48c60809a496cc4f92582076e188112f8525c4b7c209');
const source=await PDFDocument.load(bytes),doc=await PDFDocument.create({updateMetadata:false});
assert.equal(source.getPageCount(),14);
doc.addPage((await doc.copyPages(source,[10]))[0]);
assert.deepEqual(doc.getPage(0).getSize(),{width:3024,height:2160});
await mkdir(dirname(output),{recursive:true});await writeFile(output,await doc.save());
console.log('Extracted unchanged source page 11 (AM3.10), 42 x 30 inches.');

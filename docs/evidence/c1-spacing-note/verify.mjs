import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await readFile(resolve(dir,name),'utf8'));
const baseline=await read('baseline.takeoff.json');
const corrected=await read('corrected.takeoff.json');
const expected=structuredClone(baseline);
const c1='shp-7cca5e9f-60ef-4215-a544-54d3c5e5055a';
const note='Triangular pattern assumed. L1.0 / C1 / SET: 12 in o.c. per schedule; 0 deg rotation, 6 in X/Y shifts and no edge clearance assumed. Calculated layout, not observed plant positions.';
expected.shapes.find(s=>s.id===c1).area_grid.reference=note;
assert.deepEqual(corrected,expected,'Only C1 area_grid.reference may change');
assert.equal(corrected.shapes.length,14);
assert.equal(corrected.conditions.length,12);
assert.deepEqual(await read('after-reload.takeoff.json'),corrected);
assert.deepEqual(await read('after-reopen.takeoff.json'),corrected);
const browser=await read('browser-result.json');
assert.equal(browser.note,note);
assert.equal(browser.exactNoteMatch,true);
assert.equal(browser.saveEnabled,false,'Reopened editor has no unsaved changes');
if(process.argv.includes('--browser')) {
  const require=createRequire(resolve(dir,'../../../web/package.json'));
  const {unzipSync,strFromU8}=require('fflate');
  const archive=async name=>{
    const entries=unzipSync(await readFile(resolve(dir,'../../../tmp/c1-spacing-note',name)));
    return {takeoff:JSON.parse(strFromU8(entries['opentakeoff.project.json'])).takeoff,
      pdfs:Object.entries(entries).filter(([name])=>name.startsWith('plans/')).map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]).sort()};
  };
  const before=await archive('baseline.otk');
  assert.deepEqual(before.takeoff,baseline);
  for(const file of ['public-bed-triangular-note.otk','reopened.otk']) {
    const after=await archive(file);
    assert.deepEqual(after.takeoff,corrected);
    assert.deepEqual(after.pdfs,before.pdfs,'Stored PDFs stay byte-identical');
  }
}
console.log('PASS: only C1 grid reference changed. All 14 measurements, 12 conditions, IDs, quantities, geometry, scale, grid settings and reviews preserved; reload and archive reopen exact.'+(process.argv.includes('--browser')?' Stored PDF bytes match.':''));

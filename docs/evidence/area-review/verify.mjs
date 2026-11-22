// Run committed public evidence gates against the current shared implementation.
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const checks=['area-grid-count','area-grid-footprints','area-grid-cuts',
  'area-grid-rectangles','area-grid-aligned','area-grid-actual-2x4',
  'area-assembly-prototype','area-assembly-panel','area-assembly-depth',
  'mixed-bed-callouts','compact-bed-review','c1-spacing-note'];
let failed=0;
for(const name of checks){
  const r=spawnSync(process.execPath,['--import','./web/node_modules/tsx/dist/loader.mjs',`docs/evidence/${name}/verify.mjs`],{cwd:root,encoding:'utf8',timeout:120000});
  console.log(`${name}: ${r.status===0?'PASS':'FAIL'}`);
  if(r.status!==0){failed++;console.error(r.error?.message||r.stderr||r.stdout);}
}
const source=spawnSync(process.execPath,['--test','docs/evidence/area-grid-source/verify.test.mjs'],{cwd:root,encoding:'utf8',timeout:120000});
console.log(`area-grid-source: ${source.status===0?'PASS':'FAIL'}`);
if(source.status!==0){failed++;console.error(source.error?.message||source.stderr||source.stdout);}
if(failed)process.exitCode=1;

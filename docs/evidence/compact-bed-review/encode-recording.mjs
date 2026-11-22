import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(dir,'../../../web/package.json'));
const sharp=require('sharp');
const frames=JSON.parse(await readFile(resolve(dir,'recording.json'),'utf8'));
await sharp(await Promise.all(frames.map(f=>readFile(resolve(dir,f.file)))),{join:{animated:true}})
  .gif({loop:0,delay:frames.map(()=>1800),effort:7}).toFile(resolve(dir,'public-bed-flow.gif'));
console.log(`${frames.length} actual browser captures encoded; 1.8 seconds per frame for readability.`);

// Offline audit of the fork's public area-grid/assembly evidence and dependencies.
// Does not open a takeoff, rewrite fixtures or alter review decisions.
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,statSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const base='8a31fb4';
const files=[...new Set([
  ...execFileSync('git',['diff','--name-only',`${base}..HEAD`],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/),
  ...execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/),
  ...execFileSync('git',['ls-files','--others','--exclude-standard','docs/evidence/area-review','docs/evidence/planting-suite/screenshots'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/),
])].filter(f=>f.startsWith('docs/evidence/')&&existsSync(resolve(root,f))&&f!=='docs/evidence/area-review/file-audit.json');
const errors=[],warnings=[],kinds={};let json=0,links=0,bytes=0;
const slug=s=>s.replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[`*]/g,'').trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/ /g,'-');
function anchors(text){const out=new Set(),seen=new Map();let fence=false;for(const line of text.split(/\r?\n/)){if(/^\s*(```|~~~)/.test(line)){fence=!fence;continue;}if(fence)continue;const h=line.match(/^#{1,6}\s+(.*)$/);if(h){const s=slug(h[1]),n=seen.get(s)||0;seen.set(s,n+1);out.add(n?`${s}-${n}`:s);}for(const m of line.matchAll(/<a\s[^>]*(?:name|id)="([^"]+)"/g))out.add(m[1]);}return out;}
for(const f of files){
  const path=resolve(root,f),ext=f.split('.').pop().toLowerCase();kinds[ext]=(kinds[ext]||0)+1;bytes+=statSync(path).size;
  if(['pdf','otk','otprofile','zip'].includes(ext))errors.push(`${f}: source/archive must stay outside Git`);
  if(!['json','md','mjs','py','html','svg'].includes(ext))continue;
  const text=readFileSync(path,'utf8');
  if(ext==='json'){try{JSON.parse(text);json++;}catch(e){errors.push(`${f}: ${e.message}`);}}
  if(/(?:C:\\Users\\|C:\/Users\/|Bearer\s+[A-Za-z0-9_-]{20}|gh[pousr]_[A-Za-z0-9]{20})/i.test(text))warnings.push(`${f}: inspect local path or credential-like text`);
  if(ext!=='md')continue;
  let fence=false;for(const [i,line] of text.split(/\r?\n/).entries()){
    if(/^\s*(```|~~~)/.test(line)){fence=!fence;continue;}if(fence)continue;
    for(const m of line.matchAll(/\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)){
      const target=m[1].replace(/^<|>$/g,'');if(/^(https?:|mailto:|data:)/.test(target))continue;
      links++;const [p,hash]=target.split('#'),dest=p?resolve(dirname(path),decodeURIComponent(p)):path;
      if(!existsSync(dest)){errors.push(`${f}:${i+1}: missing ${target}`);continue;}
      if(hash&&dest.endsWith('.md')&&!anchors(readFileSync(dest,'utf8')).has(decodeURIComponent(hash)))errors.push(`${f}:${i+1}: missing anchor ${target}`);
    }
  }
}
const result={base,scope:'Fork evidence added or changed since base; includes working changes; excludes this generated report',files:files.length,bytes,kinds,parsed_json:json,local_links:links,errors,warnings};
if(process.argv.includes('--write'))writeFileSync(resolve(root,'docs/evidence/area-review/file-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exitCode=1;

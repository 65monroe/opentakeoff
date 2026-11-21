// Actual MCP stdio reads in an isolated session. Does not connect to or replace
// a browser workspace. No edit_shape, measurement, or approval call is made.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const repo = process.cwd(), out = resolve(process.argv[2] || 'tmp/area-grid-source-replay');
await mkdir(out, {recursive: true});
const require = createRequire(resolve('mcp/package.json'));
const {Client} = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport} = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const client = new Client({name: 'public-grid-source-read', version: '1'}), log = [];
const sheet = 'mo-veterans-home-A111-reflected-ceiling-plan.pdf';
const pdf = resolve('demo/public-sheets', sheet);
assert.equal(createHash('sha256').update(await readFile(pdf)).digest('hex'),
  'e9f66a799fdf094ff7b3d43f79acc8d0af9cf53773e992d451f97ddceed91ad3');
await client.connect(new StdioClientTransport({command: process.execPath,
  args: ['--import', 'tsx', 'server.ts'], cwd: resolve('mcp'), stderr: 'pipe'}));
const scrub = value => JSON.parse(JSON.stringify(value).replaceAll(out.replaceAll('\\', '\\\\'), '<OUTPUT>')
  .replaceAll(repo.replaceAll('\\', '\\\\'), '<REPO>'));
async function call(name, args, file) {
  const result = await client.callTool({name, arguments: args});
  assert.ok(!result.isError, JSON.stringify(result));
  const value = result.structuredContent ?? JSON.parse(result.content.find(c => c.type === 'text').text);
  log.push({tool: name, args: scrub(args), result: scrub(value)});
  if (file) {
    const image = result.content.find(c => c.type === 'image');
    await writeFile(resolve(out, file), image ? Buffer.from(image.data, 'base64') : JSON.stringify(value, null, 2) + '\n');
  }
  return value;
}
async function vectors(region, file) {
  let cursor;
  const pages = [];
  do {
    const page = await call('get_sheet_vectors', {sheet, region, limit: 500, ...(cursor === undefined ? {} : {cursor})});
    pages.push(page);
    cursor = page.next_cursor;
  } while (cursor !== undefined);
  await writeFile(resolve(out, file), JSON.stringify(pages, null, 2) + '\n');
  return pages;
}
try {
  await client.readResource({uri: 'takeoff://wiki'});
  log.push({resource: 'takeoff://wiki', read: true});
  await call('load_plan', {path: pdf});
  await call('import_takeoff', {path: resolve('docs/evidence/area-grid-rectangles/ceiling-0.json')});
  await call('export_takeoff', {path: resolve(out, 'before.json')});
  await call('sheet_info', {sheet}, 'sheet-info.json');
  const legend = {x0: 3970, y0: 1480, x1: 4660, y1: 1580};
  await call('read_sheet_text', {sheet, region: legend}, 'sheet-text.json');
  const region = {x0: 1850, y0: 175, x1: 2050, y1: 330};
  const pages = await vectors(region, 'vectors.json');
  await call('view_sheet', {sheet, region, overlay: false, px: 1600}, 'source.png');
  await call('view_sheet', {sheet, region: legend, overlay: false, px: 1600}, 'legend.png');
  // Nearby gypsum soffit: a real negative case on this same source sheet.
  await vectors({x0: 1880, y0: 240, x1: 1900, y1: 297}, 'gypsum-vectors.json');
  await call('export_takeoff', {path: resolve(out, 'after.json')});
  const read = async path => JSON.parse(await readFile(path, 'utf8'));
  const before = await read(resolve(out, 'before.json'));
  assert.deepEqual(await read(resolve(out, 'after.json')), before);
  assert.deepEqual(before, await read(resolve('docs/evidence/area-grid-rectangles/ceiling-0.json')));
  await writeFile(resolve(out, 'transcript.json'), JSON.stringify(log, null, 2) + '\n');
  console.log(JSON.stringify({pages: pages.length, segments: pages[0].total,
    ledger: pages.map(p => [p.offset, p.returned, p.dropped]), preservation: 'Exact imported/before/after equality'}));
} finally {
  await client.close();
}

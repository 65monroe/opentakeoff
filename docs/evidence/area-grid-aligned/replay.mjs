import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {buildProjectArchive} from '../../../web/src/lib/projectArchive.js';

const repo = process.cwd(), out = resolve(process.argv[2] || 'tmp/area-grid-aligned/replay');
await mkdir(out, {recursive: true});
const require = createRequire(resolve('mcp/package.json'));
const {Client} = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StdioClientTransport} = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
const client = new Client({name: 'public-source-aligned-ceiling', version: '1'}), transcript = [];
const sheet = 'mo-veterans-home-A111-reflected-ceiling-plan.pdf', pdf = resolve('demo/public-sheets', sheet);
assert.equal(createHash('sha256').update(await readFile(pdf)).digest('hex'), 'e9f66a799fdf094ff7b3d43f79acc8d0af9cf53773e992d451f97ddceed91ad3');
await client.connect(new StdioClientTransport({command: process.execPath, args: ['--import', 'tsx', 'server.ts'], cwd: resolve('mcp'), stderr: 'pipe'}));
const scrub = value => JSON.parse(JSON.stringify(value).replaceAll(out.replaceAll('\\', '\\\\'), '<OUTPUT>').replaceAll(repo.replaceAll('\\', '\\\\'), '<REPO>'));
async function call(name, args = {}, png) {
  const result = await client.callTool({name, arguments: args});
  assert.ok(!result.isError, JSON.stringify(result));
  const value = result.structuredContent ?? JSON.parse(result.content.find(c => c.type === 'text').text);
  transcript.push({tool: name, args: scrub(args), result: scrub(value)});
  if (png) await writeFile(resolve(out, png), Buffer.from(result.content.find(c => c.type === 'image').data, 'base64'));
  return value;
}
const read = async file => JSON.parse(await readFile(resolve(out, file), 'utf8'));
async function archive(name, takeoff) {
  await writeFile(resolve(out, name), await buildProjectArchive({takeoff, sheets: [{name: sheet}], loadPdfData: async () => new Uint8Array(await readFile(pdf))}));
}
try {
  await client.readResource({uri: 'takeoff://wiki'});
  await call('load_plan', {path: pdf});
  await call('import_takeoff', {path: resolve('docs/evidence/area-grid-source/after.json')});
  await call('export_takeoff', {path: resolve(out, 'before.json')});
  const before = await read('before.json'), original = before.shapes[0], report = await call('takeoff_summary');
  await archive('ceiling-before.otk', before);
  const suggestion = JSON.parse(await readFile(resolve('docs/evidence/area-grid-source/suggestion.json'), 'utf8'));
  const layout = suggestion.suggested_layout;
  assert.equal(suggestion.shape_id, original.id);
  assert.deepEqual(layout.origin_norm, original.area_grid.origin_norm);
  const grid = {...original.area_grid, pattern: 'square', spacing_ft: layout.spacing_ft,
    angle_deg: layout.angle_deg, offset_x_ft: layout.offset_x_ft, offset_y_ft: layout.offset_y_ft,
    reference: 'Public A111 northwest bay: source vector fit, 9 vertical and 7 horizontal lines at median 18 px pitch; 0 degrees, center offsets 1 ft X/Y from the existing origin. Maximum source residual 0.24 px. Retained scale is unconfirmed; legend permits 2x2 or 2x4. Applied as the drawn alignment, not a tile procurement specification.',
    footprint: {...original.area_grid.footprint, width_ft: 2, depth_ft: 2, basis: 'assumed',
      reference: 'Nominal 2-by-2-foot module inferred from the actual drawn square grid; physical tile face, joints, main-runner direction and procurement size remain unverified.'}};
  delete grid.spacing_y_ft;
  const edited = await call('edit_shape', {shape_id: original.id, area_grid: grid});
  assert.equal(edited.grid_count, 45);
  assert.equal(edited.grid_cuts.full_tiles, 31);
  assert.equal(edited.grid_cuts.edge_cut_pieces, 32);
  assert.deepEqual(await call('takeoff_summary'), report);
  await call('export_takeoff', {path: resolve(out, 'aligned.json')});
  const aligned = await read('aligned.json'), unchanged = structuredClone(aligned);
  unchanged.shapes[0].area_grid = original.area_grid;
  assert.deepEqual(unchanged, before);
  await archive('ceiling-source-aligned.otk', aligned);
  await call('view_sheet', {sheet, overlay: true, region: {x0: 1850, y0: 175, x1: 2050, y1: 330}, px: 1600}, 'mcp-aligned.png');
  await call('undo_last');
  await call('export_takeoff', {path: resolve(out, 'undo.json')});
  assert.deepEqual(await read('undo.json'), before);
  await writeFile(resolve(out, 'transcript.json'), JSON.stringify(transcript, null, 2) + '\n');
  console.log('45 centers; 31 full tiles; 32 edge cuts. Only area_grid changes; report unchanged; Undo exact.');
} finally {await client.close();}

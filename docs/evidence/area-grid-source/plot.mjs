// A source-coordinate diagram, not a browser screenshot or an edited source PDF.
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {phaseDistance} from './fit.mjs';
const require = createRequire(resolve('mcp/package.json'));
const {createCanvas} = require('@napi-rs/canvas');
const dir = resolve(process.argv[2] || 'docs/evidence/area-grid-source');
const read = async name => JSON.parse(await readFile(resolve(dir, name), 'utf8'));
const [suggestion, selected, before] = await Promise.all(['suggestion.json', 'selected-strokes.json', 'before.json'].map(read));
const fit = suggestion.fit, [w, h] = suggestion.source.frame_px;
const ring = before.shapes[0].verts_norm.map(([x, y]) => [x * w, y * h]);
const canvas = createCanvas(1800, 720), ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1800, 720);
function text(value, x, y, size = 20, color = '#182736') {
  ctx.fillStyle = color; ctx.font = `${size}px Arial`; ctx.fillText(value, x, y);
}
text('Does the suggested layout follow the actual drawn grid?', 40, 48, 32);
text('Public Veterans Home A111 | Source-coordinate diagram from MCP vectors; saved takeoff unchanged', 40, 84, 21);
const choices = [
  {title: 'Observed source strokes', note: '9 vertical + 7 horizontal grid lines', px: null, py: null},
  {title: 'Suggested square alignment', note: '16 of 16 lines agree within 0.3 px', px: 18, py: 18},
  {title: '2-by-4 alternative at 0 degrees', note: '3 drawn lines remain unexplained', px: 18, py: 36}
];
choices.forEach((choice, panel) => {
  const left = 40 + panel * 585;
  text(choice.title, left, 139, 24);
  text(choice.note, left, 171, 19);
  ctx.save(); ctx.translate(left + 14, 214); ctx.scale(3, 3); ctx.translate(-1873.68, -194.4);
  const path = () => {ctx.beginPath(); ring.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();};
  path(); ctx.fillStyle = '#f6f8fa'; ctx.fill();
  ctx.save(); path(); ctx.clip();
  for (const {line: [x1, y1, x2, y2]} of selected) {
    const vertical = Math.abs(x2 - x1) < 0.01;
    const missing = choice.px && phaseDistance(vertical ? x1 : y1,
      vertical ? fit.x.anchor_px : fit.y.anchor_px, vertical ? choice.px : choice.py) > fit.tolerance_px;
    ctx.strokeStyle = missing ? '#b03a26' : '#8995a3'; ctx.lineWidth = missing ? 0.85 : 0.65;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  if (choice.px) {
    ctx.strokeStyle = '#1f3fc7'; ctx.lineWidth = 0.6; ctx.setLineDash([1.4, 0.8]);
    for (let x = fit.x.anchor_px; x < 2042; x += choice.px) {
      ctx.beginPath(); ctx.moveTo(x, 194); ctx.lineTo(x, 309); ctx.stroke();
    }
    for (let y = fit.y.anchor_px; y < 309; y += choice.py) {
      ctx.beginPath(); ctx.moveTo(1873, y); ctx.lineTo(2042, y); ctx.stroke();
    }
  }
  ctx.restore(); path(); ctx.strokeStyle = '#182736'; ctx.lineWidth = 0.7; ctx.stroke(); ctx.restore();
  text(panel === 0 ? 'Gray = actual extracted grid strokes' : panel === 1 ? 'Blue dashed = inferred module edges' : 'Red = source lines absent from this layout', left, 594, 19);
});
text('Suggestion: 0 degrees; 2 ft X/Y pitch; center offsets 1 ft X and 1 ft Y from the existing origin.', 40, 646, 22);
text('The legend permits 2x2 or 2x4. Drawn alignment does not confirm tile size, runner direction, scale or purchasing quantities.', 40, 685, 20);
await writeFile(resolve(dir, 'source-fit.png'), canvas.toBuffer('image/png'));

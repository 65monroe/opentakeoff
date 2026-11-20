// Compare the unchanged measurement contract across independent MCP sessions.
// Random IDs are replaced by condition tags only for this before/after check;
// run-public.mjs separately checks exact IDs on export/import in one session.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const [beforePath, afterPath, outputPath] = process.argv.slice(2);
assert.ok(beforePath && afterPath, 'node compare-core.mjs BEFORE.json AFTER.json [RESULT.json]');
function core(p) {
  const tags = new Map(p.conditions.map(c=>[c.id,c.finish_tag]));
  return {
    sheets:p.sheets,
    measurements:p.shapes.map(s=>({
      sheet:s.sheet_id,code:tags.get(s.condition_id),role:s.measure_role,
      vertices:s.verts_norm,computed:s.computed,
      origin:{method:s.origin.method,actor:s.origin.actor,reviewed:s.origin.reviewed,assignment:s.origin.assignment},
    })),
    quantity_settings:p.conditions.map(c=>({code:c.finish_tag,multiplier:c.multiplier,waste_pct:c.waste_pct})),
  };
}
const before=core(JSON.parse(await readFile(beforePath,'utf8')));
const after=core(JSON.parse(await readFile(afterPath,'utf8')));
assert.deepEqual(after,before);
const result={pass:true,exact_measurements:before.measurements.length,fields:['calibration','code','role','normalized vertices','computed quantities','origin method/actor/review/assignment','condition multiplier/waste'],excluded:['random IDs across independent sessions','proposal prose','annotation presentation'],before_commit:'8a31fb49d5a2c286c665017219073b0abe61695b',result:'No measurement difference. No speed or accuracy improvement claimed.'};
if(outputPath) await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

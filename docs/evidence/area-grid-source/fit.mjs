// Evidence-only arithmetic over analyst-selected MCP strokes. This is not a
// shipped ceiling reader, classifier, MCP tool, or automatic layout decision.
const mod = (v, p) => ((v % p) + p) % p;
const median = values => {
  const a = [...values].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const round = v => +v.toFixed(6);
export const phaseDistance = (v, phase, pitch) => Math.abs(mod(v - phase + pitch / 2, pitch) - pitch / 2);

function family(positions, tolerance) {
  const values = [...positions].sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > tolerance);
  if (values.length < 4) throw new Error('Fewer than four distinct parallel lines; withhold a fit.');
  const gaps = values.slice(1).map((v, i) => v - values[i]);
  const pitch = median(gaps), first = values[0];
  if (!(pitch > tolerance * 4)) throw new Error('Pitch is too small for the source tolerance.');
  // Shift each line back to the first lattice interval before taking its median.
  const anchor = median(values.map(v => v - Math.round((v - first) / pitch) * pitch));
  const residuals = values.map(v => phaseDistance(v, anchor, pitch));
  if (Math.max(...residuals) > tolerance || gaps.some(g => Math.abs(g - pitch) > tolerance)) {
    throw new Error('Irregular or missing grid lines; withhold a regular-grid fit.');
  }
  return {positions_px: values.map(round), pitch_px: round(pitch), anchor_px: round(anchor),
    line_count: values.length, max_residual_px: round(Math.max(...residuals))};
}

export function fitGridLines(segments, tolerance = 0.3) {
  if (segments.length < 8) throw new Error('Too few candidate strokes; withhold a fit.');
  const angles = segments.map(([x1, y1, x2, y2]) => mod(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, 180));
  // Mean of fourfold angles handles the 0/90-degree wrap without a seeded angle.
  const angle = mod(Math.atan2(angles.reduce((s, a) => s + Math.sin(a * Math.PI / 45), 0),
    angles.reduce((s, a) => s + Math.cos(a * Math.PI / 45), 0)) * 45 / Math.PI, 90);
  const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  const x = [], y = [];
  segments.forEach(([x1, y1, x2, y2], i) => {
    const relative = mod(angles[i] - angle, 180), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if (Math.min(relative, 180 - relative) <= 0.25) y.push(-s * mx + c * my);
    else if (Math.abs(relative - 90) <= 0.25) x.push(c * mx + s * my);
    else throw new Error('Candidate strokes are not two perpendicular families; withhold a fit.');
  });
  return {angle_deg: round(angle), tolerance_px: tolerance, x: family(x, tolerance), y: family(y, tolerance)};
}

// The app stores CENTER offsets; PDF grid strokes denote module EDGES.
export function centerOffsets(fit, origin, unitsPerPixel) {
  const rad = fit.angle_deg * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const ox = c * origin[0] + s * origin[1], oy = -s * origin[0] + c * origin[1];
  return [mod(fit.x.anchor_px + fit.x.pitch_px / 2 - ox, fit.x.pitch_px) * unitsPerPixel,
    mod(fit.y.anchor_px + fit.y.pitch_px / 2 - oy, fit.y.pitch_px) * unitsPerPixel].map(round);
}

export function explainLines(fit, pitchX, pitchY, anchorX = fit.x.anchor_px, anchorY = fit.y.anchor_px) {
  const score = (family, pitch, anchor) => family.positions_px.filter(v => phaseDistance(v, anchor, pitch) <= fit.tolerance_px).length;
  return {x: score(fit.x, pitchX, anchorX), y: score(fit.y, pitchY, anchorY),
    total: fit.x.line_count + fit.y.line_count};
}

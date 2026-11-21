// A deterministic spacing check within an editable bed. Generated positions are
// layout estimates, never observations, and never add to existing count totals.
import { isCalloutQuantity } from './calloutQuantity.js';

export function plantingGridError(area, shapes) {
  const g = area?.planting_grid;
  if (g === undefined) return null;
  if (!g || g.single_species !== true || area.measure_role !== 'floor_area' || area.curved ||
      !['square', 'triangular'].includes(g.pattern) ||
      !Number.isFinite(g.spacing_ft) || g.spacing_ft <= 0 ||
      !Number.isFinite(g.angle_deg) || Math.abs(g.angle_deg) > 360 ||
      !['offset_x_ft', 'offset_y_ft', 'inset_ft'].every(k => Number.isFinite(g[k]) && g[k] >= 0) ||
      !Array.isArray(g.origin_norm) || g.origin_norm.length !== 2 || !g.origin_norm.every(v => Number.isFinite(v) && v >= 0 && v <= 1) ||
      typeof g.reference !== 'string' || !g.reference.trim() ||
      typeof g.source_callout_id !== 'string' || !area.source_callout_ids?.includes(g.source_callout_id)) {
    return 'A planting grid needs a linked floor area, positive spacing, square or triangular pattern, origin, finite layout settings and a source reference.';
  }
  if (shapes && !shapes.some(s => s.id === g.source_callout_id && s.sheet_id === area.sheet_id && isCalloutQuantity(s))) return 'The grid source must be a printed callout on this sheet.';
  return null;
}

const distance = ([x,y], [a,b], [c,d]) => {
  const t = Math.max(0, Math.min(1, ((x-a)*(c-a)+(y-b)*(d-b))/((c-a)**2+(d-b)**2 || 1)));
  return Math.hypot(x-a-t*(c-a), y-b-t*(d-b));
};
function inside(p, ring) {
  let hit = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    if (distance(p,ring[j],ring[i]) < 1e-8) return true;
    const [x,y]=ring[i], [a,b]=ring[j];
    if ((y>p[1]) !== (b>p[1]) && p[0] < (a-x)*(p[1]-y)/(b-y)+x) hit=!hit;
  }
  return hit;
}

export function plantingGrid(area, frame) {
  const invalid = plantingGridError(area);
  if (invalid) return { error: invalid, points_norm: [], count: null };
  if (!area?.planting_grid) return { error: null, points_norm: [], count: null };
  if (![frame?.widthPx,frame?.heightPx,frame?.upp].every(v => Number.isFinite(v) && v>0)) return {error:'Set the sheet scale and load the plan to calculate the grid.',points_norm:[],count:null};
  const g=area.planting_grid, w=frame.widthPx*frame.upp, h=frame.heightPx*frame.upp;
  const rad=g.angle_deg*Math.PI/180, c=Math.cos(rad), s=Math.sin(rad);
  const ox=g.origin_norm[0]*w, oy=g.origin_norm[1]*h;
  const toGrid=([x,y]) => [c*(x*w-ox)+s*(y*h-oy),-s*(x*w-ox)+c*(y*h-oy)];
  const rings=[area.verts_norm,...(area.verts_norm_holes || [])].map(r=>r.map(toGrid));
  if (rings.some(r=>r.length<3 || r.some(p=>!p.every(Number.isFinite)))) return {error:'Grid needs valid polygon rings.',points_norm:[],count:null};
  const ring=rings[0], step=g.spacing_ft, row=step*(g.pattern==='triangular'?Math.sqrt(3)/2:1);
  const xmin=Math.min(...ring.map(p=>p[0])), xmax=Math.max(...ring.map(p=>p[0]));
  const ymin=Math.min(...ring.map(p=>p[1])), ymax=Math.max(...ring.map(p=>p[1]));
  const j0=Math.floor((ymin-g.offset_y_ft)/row)-1,j1=Math.ceil((ymax-g.offset_y_ft)/row)+1;
  const i0=Math.floor((xmin-g.offset_x_ft)/step)-1,i1=Math.ceil((xmax-g.offset_x_ft)/step)+1;
  if (![i0,i1,j0,j1].every(Number.isSafeInteger) || (i1-i0+1)*(j1-j0+1)>100000) return {error:'Grid exceeds 100,000 candidates; increase spacing or use a smaller bed.',points_norm:[],count:null};
  const points_norm=[];
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) {
    const x=g.offset_x_ft+i*step+(g.pattern==='triangular' && Math.abs(j%2)===1?step/2:0), y=g.offset_y_ft+j*row, p=[x,y];
    if (!inside(p,ring) || rings.slice(1).some(hole=>inside(p,hole))) continue;
    if (rings.some(r=>r.some((v,k)=>distance(p,v,r[(k+1)%r.length])+1e-8<g.inset_ft))) continue;
    points_norm.push([(ox+c*x-s*y)/w,(oy+s*x+c*y)/h]);
    if (points_norm.length>10000) return {error:'Grid exceeds 10,000 positions; use a smaller bed.',points_norm:[],count:null};
  }
  return {error:null,points_norm,count:points_norm.length};
}

// Bed-first review has an explicit source-only escape hatch; it never moves a record.
export function plantingReviewTargets(shape, shapes, sourceOnly=false) {
  if (sourceOnly || !isCalloutQuantity(shape)) return [shape];
  const beds=shapes.filter(s=>s.measure_role==='floor_area' && s.sheet_id===shape.sheet_id && s.source_callout_ids?.includes(shape.id));
  return beds.length ? beds : [shape];
}

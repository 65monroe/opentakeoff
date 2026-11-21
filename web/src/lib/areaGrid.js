// A deterministic spacing check within an editable area. Generated positions are
// layout estimates, never observations, and never add to existing count totals.
import { isCalloutQuantity } from './calloutQuantity.js';

// Read legacy files without migrating them. New saves use area_grid explicitly.
export function getAreaGrid(area) {
  if (area?.area_grid !== undefined) return area.area_grid;
  const legacy = area?.planting_grid;
  if (!legacy) return legacy;
  const {single_species, ...rest} = legacy;
  return {...rest, single_item: single_species};
}

export function withAreaGrid(area, grid) {
  const next = {...area};
  delete next.area_grid;
  delete next.planting_grid;
  if (grid != null) next.area_grid = structuredClone(grid);
  return next;
}

export function areaGridError(area, shapes) {
  if (area?.area_grid !== undefined && area?.planting_grid !== undefined) return 'Keep one grid configuration per area.';
  const g = getAreaGrid(area);
  const legacy = area?.planting_grid !== undefined;
  if (legacy && (!area.planting_grid || area.planting_grid.single_species !== true || !area.planting_grid.source_callout_id)) return 'Legacy planting grid needs its single-species declaration and source.';
  if (g === undefined) return null;
  const f = g?.footprint;
  if (g?.cut_pieces !== undefined && typeof g.cut_pieces !== 'boolean') return 'Cut-piece calculation must be on or off.';
  if (g?.cut_pieces && (g.pattern!=='square' || g.inset_ft!==0 || f?.kind!=='rectangle' ||
      ![f.width_ft,f.depth_ft].every(v=>Number.isFinite(v)&&Math.abs(v-g.spacing_ft)<=1e-9))) {
    return 'Cuts require a square pattern, zero edge clearance, and rectangle width and depth equal to spacing. Use nominal module dimensions; separate joints are not modeled.';
  }
  if (f !== undefined && (!f || !['circle', 'rectangle'].includes(f.kind) ||
      !['assumed', 'specified'].includes(f.basis) || typeof f.reference !== 'string' || !f.reference.trim() ||
      (f.kind === 'circle' ? !Number.isFinite(f.diameter_ft) || f.diameter_ft <= 0 :
        ![f.width_ft, f.depth_ft].every(v => Number.isFinite(v) && v > 0)))) {
    return 'A footprint needs positive dimensions, a circle or rectangle, a stated or assumed basis and a source reference.';
  }
  if (!g || g.single_item !== true || area.measure_role !== 'floor_area' || area.curved ||
      !['square', 'triangular'].includes(g.pattern) ||
      !Number.isFinite(g.spacing_ft) || g.spacing_ft <= 0 ||
      !Number.isFinite(g.angle_deg) || Math.abs(g.angle_deg) > 360 ||
      !['offset_x_ft', 'offset_y_ft', 'inset_ft'].every(k => Number.isFinite(g[k]) && g[k] >= 0) ||
      !Array.isArray(g.origin_norm) || g.origin_norm.length !== 2 || !g.origin_norm.every(v => Number.isFinite(v) && v >= 0 && v <= 1) ||
      typeof g.reference !== 'string' || !g.reference.trim() ||
      (g.source_callout_id !== undefined && (typeof g.source_callout_id !== 'string' || !g.source_callout_id.trim() || !area.source_callout_ids?.includes(g.source_callout_id)))) {
    return 'An area grid needs a floor area, a single-item extent, positive spacing, square or triangular pattern, origin, finite layout settings and a source reference.';
  }
  if (g.source_callout_id !== undefined && shapes && !shapes.some(s => s.id === g.source_callout_id && s.sheet_id === area.sheet_id && isCalloutQuantity(s))) return 'The grid source must be a printed callout on this sheet.';
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

export function areaGrid(area, frame) {
  const invalid = areaGridError(area);
  if (invalid) return { error: invalid, points_norm: [], count: null };
  if (!getAreaGrid(area)) return { error: null, points_norm: [], count: null };
  if (![frame?.widthPx,frame?.heightPx,frame?.upp].every(v => Number.isFinite(v) && v>0)) return {error:'Set the sheet scale and load the plan to calculate the grid.',points_norm:[],count:null};
  const g=getAreaGrid(area), w=frame.widthPx*frame.upp, h=frame.heightPx*frame.upp;
  const rad=g.angle_deg*Math.PI/180, c=Math.cos(rad), s=Math.sin(rad);
  const ox=g.origin_norm[0]*w, oy=g.origin_norm[1]*h;
  const toGrid=([x,y]) => [c*(x*w-ox)+s*(y*h-oy),-s*(x*w-ox)+c*(y*h-oy)];
  const sourceRings=[area.verts_norm,...(area.verts_norm_holes || [])];
  if (sourceRings.some(r=>!Array.isArray(r) || r.some(p=>!Array.isArray(p) || p.length!==2))) return {error:'Grid needs valid polygon rings.',points_norm:[],count:null};
  const rings=sourceRings.map(r=>r.map(toGrid));
  if (rings.some(r=>r.length<3 || r.some(p=>!p.every(Number.isFinite)))) return {error:'Grid needs valid polygon rings.',points_norm:[],count:null};
  const ring=rings[0], step=g.spacing_ft, row=step*(g.pattern==='triangular'?Math.sqrt(3)/2:1);
  const xmin=Math.min(...ring.map(p=>p[0])), xmax=Math.max(...ring.map(p=>p[0]));
  const ymin=Math.min(...ring.map(p=>p[1])), ymax=Math.max(...ring.map(p=>p[1]));
  const j0=Math.floor((ymin-g.offset_y_ft)/row)-1,j1=Math.ceil((ymax-g.offset_y_ft)/row)+1;
  const i0=Math.floor((xmin-g.offset_x_ft)/step)-1,i1=Math.ceil((xmax-g.offset_x_ft)/step)+1;
  if (![i0,i1,j0,j1].every(Number.isSafeInteger) || (i1-i0+1)*(j1-j0+1)>100000) return {error:'Grid exceeds 100,000 candidates; increase spacing or use a smaller area.',points_norm:[],count:null};
  const points_norm=[];
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) {
    const x=g.offset_x_ft+i*step+(g.pattern==='triangular' && Math.abs(j%2)===1?step/2:0), y=g.offset_y_ft+j*row, p=[x,y];
    if (!inside(p,ring) || rings.slice(1).some(hole=>inside(p,hole))) continue;
    if (rings.some(r=>r.some((v,k)=>distance(p,v,r[(k+1)%r.length])+1e-8<g.inset_ft))) continue;
    points_norm.push([(ox+c*x-s*y)/w,(oy+s*x+c*y)/h]);
    if (points_norm.length>10000) return {error:'Grid exceeds 10,000 positions; use a smaller area.',points_norm:[],count:null};
  }
  return {error:null,points_norm,count:points_norm.length};
}

// Normalized offsets around each existing grid center. Footprints are a display
// only: show the complete outline at edges, never clip it into a claimed cut piece.
// Circles use 48 segments, including their exact cardinal extents, in both renderers.
export function areaGridFootprintOutline(area, frame) {
  if (areaGridError(area) || ![frame?.widthPx, frame?.heightPx, frame?.upp].every(v => Number.isFinite(v) && v > 0)) return [];
  const g = getAreaGrid(area), f = g?.footprint;
  if (!f) return [];
  const rad = g.angle_deg * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const points = f.kind === 'circle'
    ? Array.from({length:48}, (_, i) => [Math.cos(i * Math.PI / 24) * f.diameter_ft / 2, Math.sin(i * Math.PI / 24) * f.diameter_ft / 2])
    : [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => {
      const a = x * f.width_ft / 2, b = y * f.depth_ft / 2;
      return [c*a-s*b, s*a+c*b];
    });
  return points.map(([x,y]) => [x / frame.widthPx / frame.upp, y / frame.heightPx / frame.upp]);
}

// Bed-first review has an explicit source-only escape hatch; it never moves a record.
export function plantingReviewTargets(shape, shapes, sourceOnly=false) {
  if (sourceOnly || !isCalloutQuantity(shape)) return [shape];
  const beds=shapes.filter(s=>s.measure_role==='floor_area' && s.sheet_id===shape.sheet_id && s.source_callout_ids?.includes(shape.id));
  return beds.length ? beds : [shape];
}

// Derived rectangular-module clipping. No shape IDs, totals or review fields are written.
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory.js';
import Coordinate from 'jsts/org/locationtech/jts/geom/Coordinate.js';
import OverlayOp from 'jsts/org/locationtech/jts/operation/overlay/OverlayOp.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';
import {areaGridError,getAreaGrid} from './areaGrid.js';

const gf=new GeometryFactory();
const closed=points=>gf.createLinearRing([...points,points[0]].map(([x,y])=>new Coordinate(x,y)));
/** @typedef {{outer:[number,number][],holes:[number,number][][],area_sf:number}} CutPiece */
/** @typedef {{key:string,row:number,column:number,kind:'full'|'cut',area_sf:number,pieces:CutPiece[]}} CutCell */
/** @returns {{error:string|null,full_tiles:number,cut_cells:number,edge_cut_pieces:number,covered_sf:number,full_sf:number,cut_sf:number,cells:CutCell[]}} */
const empty=error=>({error,full_tiles:0,cut_cells:0,edge_cut_pieces:0,covered_sf:0,full_sf:0,cut_sf:0,cells:[]});

// A cell can leave several disconnected pieces. Holes within a piece stay holes.
function polygons(geometry) {
  if (geometry.isEmpty()) return [];
  if (geometry.getGeometryType()==='Polygon') return [geometry];
  if (!['MultiPolygon','GeometryCollection'].includes(geometry.getGeometryType())) return [];
  return Array.from({length:geometry.getNumGeometries()},(_,i)=>polygons(geometry.getGeometryN(i))).flat();
}

export function areaGridCuts(area,frame) {
  const g=getAreaGrid(area);
  if (!g?.cut_pieces) return null;
  const invalid=areaGridError(area);
  if (invalid) return empty(invalid);
  if (![frame?.widthPx,frame?.heightPx,frame?.upp].every(v=>Number.isFinite(v)&&v>0)) return empty('Set the sheet scale before calculating cuts.');
  const w=frame.widthPx*frame.upp,h=frame.heightPx*frame.upp;
  const rad=g.angle_deg*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
  const ox=g.origin_norm[0]*w,oy=g.origin_norm[1]*h;
  const toGrid=([x,y])=>[c*(x*w-ox)+s*(y*h-oy),-s*(x*w-ox)+c*(y*h-oy)];
  const toNorm=({x,y})=>[(ox+c*x-s*y)/w,(oy+s*x+c*y)/h];
  const rings=[area.verts_norm,...(area.verts_norm_holes||[])];
  if (rings.some(r=>!Array.isArray(r)||r.length<3||r.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))) return empty('Cuts need valid polygon rings.');
  if (rings.reduce((n,r)=>n+r.length,0)>5000) return empty('Cut calculation exceeds 5,000 boundary vertices. Use a simpler area.');
  try {
    const pts=rings.map(r=>r.map(toGrid));
    const boundary=gf.createPolygon(closed(pts[0]),pts.slice(1).map(closed));
    if (!IsValidOp.isValid(boundary)||!(boundary.getArea()>0)) return empty('Cuts need a valid, non-self-intersecting boundary and holes; geometry was not repaired.');
    const env=boundary.getEnvelopeInternal(),stepX=g.spacing_ft,stepY=g.pattern==='rectangular'?g.spacing_y_ft:stepX;
    const halfX=stepX/2,halfY=stepY/2;
    const i0=Math.floor((env.getMinX()-g.offset_x_ft-halfX)/stepX),i1=Math.ceil((env.getMaxX()-g.offset_x_ft+halfX)/stepX);
    const j0=Math.floor((env.getMinY()-g.offset_y_ft-halfY)/stepY),j1=Math.ceil((env.getMaxY()-g.offset_y_ft+halfY)/stepY);
    if (![i0,i1,j0,j1].every(Number.isSafeInteger)||(i1-i0+1)*(j1-j0+1)>2500) return empty('Cut calculation exceeds 2,500 candidate modules. Use a smaller area or larger module.');
    const result=empty(null),moduleArea=stepX*stepY;
    // Numerical noise only; never round dimensions to decide whether a piece exists.
    const epsilon=Math.max(moduleArea*1e-10,64*Number.EPSILON*boundary.getArea());
    for(let row=j0;row<=j1;row++)for(let column=i0;column<=i1;column++) {
      const x=g.offset_x_ft+column*stepX,y=g.offset_y_ft+row*stepY;
      const tile=gf.createPolygon(closed([[x-halfX,y-halfY],[x+halfX,y-halfY],[x+halfX,y+halfY],[x-halfX,y+halfY]]));
      const clipped=OverlayOp.overlayOp(boundary,tile,OverlayOp.INTERSECTION);
      const parts=polygons(clipped).filter(p=>p.getArea()>epsilon);
      const area_sf=parts.reduce((n,p)=>n+p.getArea(),0);
      if (!(area_sf>epsilon)) continue;
      const full=parts.length===1&&Math.abs(area_sf-moduleArea)<=epsilon;
      const pieces=parts.map(p=>({
        outer:p.getExteriorRing().getCoordinates().slice(0,-1).map(toNorm),
        holes:Array.from({length:p.getNumInteriorRing()},(_,i)=>p.getInteriorRingN(i).getCoordinates().slice(0,-1).map(toNorm)),
        area_sf:p.getArea(),
      }));
      result.cells.push({key:`${row}:${column}`,row,column,kind:full?'full':'cut',area_sf,pieces});
      if(full){result.full_tiles++;result.full_sf+=area_sf;}
      else{result.cut_cells++;result.edge_cut_pieces+=parts.length;result.cut_sf+=area_sf;}
    }
    result.covered_sf=result.full_sf+result.cut_sf;
    if(Math.abs(result.covered_sf-boundary.getArea())>epsilon*2500) return empty('Clipped module area does not reconcile with the boundary; cuts withheld.');
    return result;
  } catch {
    return empty('Polygon intersection failed; cuts withheld without changing the source geometry.');
  }
}

import {useMemo} from 'react';
import {areaGrid,getAreaGrid,areaGridFootprintOutline} from '../lib/areaGrid.js';
import {areaGridCuts} from '../lib/areaGridCuts.js';
import {SVG} from '../lib/ui.js';

export default function AreaGridOverlay({area,widthPx,heightPx,upp,zoom,color}) {
  const {grid,footprint,cuts}=useMemo(()=>{
    const frame={widthPx,heightPx,upp};
    return {grid:areaGrid(area,frame),footprint:areaGridFootprintOutline(area,frame).map(([x,y])=>`${x*widthPx},${y*heightPx}`).join(' '),cuts:areaGridCuts(area,frame)};
  },[area,widthPx,heightPx,upp]);
  if(cuts) return <g pointerEvents="none" aria-label={cuts.error || `${cuts.full_tiles} full tiles, ${cuts.edge_cut_pieces} edge cut pieces`}>
    {cuts.cells.flatMap(cell=>cell.pieces.map((piece,i)=><path key={`${cell.key}:${i}`} data-grid-piece={cell.kind}
      d={[piece.outer,...piece.holes].map(r=>r.map(([x,y],j)=>`${j?'L':'M'}${x*widthPx},${y*heightPx}`).join(' ')+' Z').join(' ')}
      fill="none" stroke={cell.kind==='cut'?SVG.danger:color} strokeWidth={1.25/zoom} strokeDasharray={cell.kind==='cut'?`${4/zoom} ${2/zoom}`:undefined} />))}
  </g>;
  const r=getAreaGrid(area).spacing_ft/upp*0.16;
  return <g pointerEvents="none" aria-label={`${grid.count ?? 0} generated grid positions`}>
    {grid.points_norm.map(([x,y],i)=>footprint
      ? <polygon key={i} data-grid-footprint={getAreaGrid(area).footprint.kind} transform={`translate(${x*widthPx} ${y*heightPx})`} points={footprint} fill="none" stroke={color} strokeWidth={1.25/zoom}/>
      : <circle key={i} cx={x*widthPx} cy={y*heightPx} r={r} fill="none" stroke={color} strokeWidth={1.25/zoom}/>)}
  </g>;
}

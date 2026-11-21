import { useMemo, useState } from 'react';
import { localizeText as uiText } from '../lib/i18n/core.js';
import { areaGrid, getAreaGrid, withAreaGrid } from '../lib/areaGrid.js';
import { areaGridCuts } from '../lib/areaGridCuts.js';

export default function AreaGridPanel({ area, source, frame, onSave }) {
  const saved=getAreaGrid(area);
  const printed=source?.computed?.count;
  const [spacing,setSpacing]=useState(saved ? String(saved.spacing_ft*12) : '');
  const [pattern,setPattern]=useState(saved?.pattern || 'square');
  const [angle,setAngle]=useState(String(saved?.angle_deg || 0));
  const [inset,setInset]=useState(String((saved?.inset_ft || 0)*12));
  const [x,setX]=useState(String((saved?.offset_x_ft || 0)*12));
  const [y,setY]=useState(String((saved?.offset_y_ft || 0)*12));
  const [reference,setReference]=useState(saved?.reference || '');
  const [single,setSingle]=useState(!!saved);
  const [footprintKind,setFootprintKind]=useState(saved?.footprint?.kind || 'none');
  const [diameter,setDiameter]=useState(saved?.footprint?.diameter_ft ? String(saved.footprint.diameter_ft*12) : '');
  const [width,setWidth]=useState(saved?.footprint?.width_ft ? String(saved.footprint.width_ft*12) : '');
  const [depth,setDepth]=useState(saved?.footprint?.depth_ft ? String(saved.footprint.depth_ft*12) : '');
  const [footprintBasis,setFootprintBasis]=useState(saved?.footprint?.basis || 'assumed');
  const [footprintReference,setFootprintReference]=useState(saved?.footprint?.reference || '');
  const [cutPieces,setCutPieces]=useState(saved?.cut_pieces || false);
  const footprint=footprintKind==='none' ? undefined : {kind:footprintKind,basis:footprintBasis,reference:footprintReference,...(footprintKind==='circle' ? {diameter_ft:Number(diameter)/12} : {width_ft:Number(width)/12,depth_ft:Number(depth)/12})};
  const draft={...(saved?.source_callout_id || source?.id ? {source_callout_id:saved?.source_callout_id || source.id} : {}),spacing_ft:Number(spacing)/12,pattern,angle_deg:Number(angle),inset_ft:Number(inset)/12,offset_x_ft:Number(x)/12,offset_y_ft:Number(y)/12,origin_norm:saved?.origin_norm || [...area.verts_norm[0]],reference,single_item:true,...(footprint ? {footprint} : {}),...(cutPieces?{cut_pieces:true}:{})};
  const result=areaGrid(withAreaGrid(area,draft),frame);
  const stored=areaGrid(area,frame);
  const savedCuts=useMemo(()=>areaGridCuts(area,frame),[area,frame]);
  const draftCuts=cutPieces&&!result.error?areaGridCuts(withAreaGrid(area,draft),frame):null;
  return <details className="workspace-grid" open={!!saved}>
    <summary>{uiText('Area grid count')}{stored.count !== null ? ` · ${stored.count} calculated` : ''}</summary>
    <p>{uiText('Generated layout positions within this outline. Existing takeoff quantities stay unchanged. Use one item type and spacing throughout.')}</p>
    {stored.error && <p role="status">{uiText(stored.error)}</p>}
    {saved?.source_callout_id && !source && <p role="status">{uiText('Linked printed source unavailable; comparison withheld.')}</p>}
    {stored.count !== null && <p className="workspace-grid-result">{uiText(`${stored.count} grid positions${printed === undefined ? ' · no printed comparison' : ` · ${printed} printed EA · difference ${stored.count-printed}`}`)}</p>}
    {savedCuts && <section aria-label={uiText('Tile cut results')}>
      {savedCuts.error ? <p role="status">{uiText(savedCuts.error)}</p> : <>
        <p className="workspace-grid-result">{uiText(`${savedCuts.full_tiles} full tiles · ${savedCuts.edge_cut_pieces} edge cut pieces`)}</p>
        <p>{uiText(`Full: solid outline. Cuts: red dashed outline. ${savedCuts.cut_cells} cut cells · ${savedCuts.covered_sf.toFixed(2)} SF covered.`)}</p>
        <p>{uiText('Layout results only. Cut pieces can include hole boundaries. These are not purchased tiles; offcut reuse and waste are not calculated.')}</p>
        <details><summary>{uiText('Edge cut schedule')}</summary><table><thead><tr><th>{uiText('Cell (row:column)')}</th><th>{uiText('Pieces')}</th><th>{uiText('Retained SF')}</th></tr></thead><tbody>
          {savedCuts.cells.filter(cell=>cell.kind==='cut').map(cell=><tr key={cell.key}><td>{cell.key}</td><td>{cell.pieces.length}</td><td>{cell.area_sf.toFixed(3)}</td></tr>)}
        </tbody></table></details>
      </>}
    </section>}
    <label>{uiText('Spacing (in)')}<input type="number" min="0.01" step="any" value={spacing} onChange={e=>setSpacing(e.target.value)} /></label>
    <label>{uiText('Pattern')}<select value={pattern} onChange={e=>setPattern(e.target.value)}><option value="square">{uiText('Square')}</option><option value="triangular">{uiText('Triangular')}</option></select></label>
    <details><summary>{uiText('Orientation and edges')}</summary>
      <label>{uiText('Angle (degrees)')}<input type="number" min="-360" max="360" value={angle} onChange={e=>setAngle(e.target.value)} /></label>
      <label>{uiText('Edge clearance (in)')}<input type="number" min="0" step="any" value={inset} onChange={e=>setInset(e.target.value)} /></label>
      <label>{uiText('Grid shift X (in)')}<input type="number" min="0" step="any" value={x} onChange={e=>setX(e.target.value)} /></label>
      <label>{uiText('Grid shift Y (in)')}<input type="number" min="0" step="any" value={y} onChange={e=>setY(e.target.value)} /></label>
    </details>
    <details open={footprintKind!=='none'}><summary>{uiText('Item footprint')}</summary>
      <p>{uiText('Drawn to scale. Dimensions do not set spacing or change takeoff quantities. Enable cut calculation for clipped square modules.')}</p>
      <label>{uiText('Footprint shape')}<select value={footprintKind} onChange={e=>setFootprintKind(e.target.value)}><option value="none">{uiText('Position markers only')}</option><option value="circle">{uiText('Circle')}</option><option value="rectangle">{uiText('Rectangle')}</option></select></label>
      {footprintKind==='circle' && <label>{uiText('Diameter (in)')}<input type="number" min="0.01" step="any" value={diameter} onChange={e=>setDiameter(e.target.value)} /></label>}
      {footprintKind==='rectangle' && <><label>{uiText('Width along grid X (in)')}<input type="number" min="0.01" step="any" value={width} onChange={e=>setWidth(e.target.value)} /></label><label>{uiText('Depth along grid Y (in)')}<input type="number" min="0.01" step="any" value={depth} onChange={e=>setDepth(e.target.value)} /></label></>}
      {footprintKind!=='none' && <><label>{uiText('Dimension basis')}<select value={footprintBasis} onChange={e=>setFootprintBasis(e.target.value)}><option value="assumed">{uiText('Assumed')}</option><option value="specified">{uiText('Specified in source')}</option></select></label><label>{uiText('Dimension source or assumption')}<input value={footprintReference} onChange={e=>setFootprintReference(e.target.value)} /></label><p>{uiText('A specified basis records a citation; it is not a review approval. Plant container size is separate from canopy spread and planting spacing.')}</p></>}
      <label className="workspace-grid-confirm"><input type="checkbox" checked={cutPieces} onChange={e=>setCutPieces(e.target.checked)}/>{uiText('Calculate full tiles and edge cuts')}</label>
      {cutPieces && <p>{uiText('Uses square modules equal to spacing, square pattern and zero edge clearance. Includes boundary-crossing modules whose centers lie outside. Nominal modules only; separate joints are not modeled.')}</p>}
    </details>
    <label>{uiText('Spacing source and layout assumptions')}<input value={reference} onChange={e=>setReference(e.target.value)} /></label>
    <label className="workspace-grid-confirm"><input type="checkbox" checked={single} onChange={e=>setSingle(e.target.checked)} />{uiText('This outline applies to one item type and spacing throughout.')}</label>
    {spacing && reference && <p>{uiText(result.error || `Preview: ${result.count} positions${printed === undefined ? '.' : `; difference ${result.count-printed} from printed EA.`}`)}</p>}
    {draftCuts && <p role="status">{uiText(draftCuts.error || `Cut preview: ${draftCuts.full_tiles} full tiles · ${draftCuts.edge_cut_pieces} edge cut pieces.`)}</p>}
    <div className="workspace-area-actions"><button type="button" disabled={!single || !!result.error || !!draftCuts?.error || !!(draft.source_callout_id && !source)} onClick={()=>onSave(area,draft)}>{uiText('Save grid')}</button>{saved && <button type="button" onClick={()=>onSave(area,null)}>{uiText('Remove grid')}</button>}</div>
  </details>;
}

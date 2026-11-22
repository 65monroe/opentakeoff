import { useMemo, useState } from 'react';
import { localizeText as uiText } from '../lib/i18n/core.js';
import { areaGrid, getAreaGrid, withAreaGrid } from '../lib/areaGrid.js';
import { areaGridCuts } from '../lib/areaGridCuts.js';

function GridEditor({ area, source, frame, onSave, onCancel }) {
  const saved=getAreaGrid(area);
  const printed=source?.computed?.count;
  const [spacing,setSpacing]=useState(saved ? String(saved.spacing_ft*12) : '');
  const [spacingY,setSpacingY]=useState(saved?.spacing_y_ft ? String(saved.spacing_y_ft*12) : '');
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
  const draft={...(saved?.source_callout_id || source?.id ? {source_callout_id:saved?.source_callout_id || source.id} : {}),spacing_ft:Number(spacing)/12,...(pattern==='rectangular'?{spacing_y_ft:Number(spacingY)/12}:{}),pattern,angle_deg:Number(angle),inset_ft:Number(inset)/12,offset_x_ft:Number(x)/12,offset_y_ft:Number(y)/12,origin_norm:saved?.origin_norm || [...area.verts_norm[0]],reference,single_item:true,...(footprint ? {footprint} : {}),...(cutPieces?{cut_pieces:true}:{})};
  const result=areaGrid(withAreaGrid(area,draft),frame);
  const draftCuts=cutPieces&&!result.error?areaGridCuts(withAreaGrid(area,draft),frame):null;
  const changed=Object.keys({...saved,...draft}).some(key=>key==='footprint'
    ? Object.keys({...saved?.footprint,...draft.footprint}).some(field=>draft.footprint?.[field]!==saved?.footprint?.[field])
    : JSON.stringify(draft[key])!==JSON.stringify(saved?.[key]));
  return <div className="workspace-grid-editor">
    <div className="workspace-grid-fields">
    <label>{uiText(pattern==='rectangular'?'Spacing X (in)':'Spacing (in)')}<input type="number" min="0.01" step="any" value={spacing} onChange={e=>setSpacing(e.target.value)} /></label>
    <label>{uiText('Pattern')}<select value={pattern} onChange={e=>setPattern(e.target.value)}><option value="square">{uiText('Square')}</option><option value="triangular">{uiText('Triangular')}</option><option value="rectangular">{uiText('Rectangular')}</option></select></label>
    {pattern==='rectangular' && <label>{uiText('Spacing Y (in)')}<input type="number" min="0.01" step="any" value={spacingY} onChange={e=>setSpacingY(e.target.value)} /></label>}
    </div>
    <label className="workspace-grid-confirm"><input type="checkbox" checked={single} onChange={e=>setSingle(e.target.checked)} />{uiText('One item type and spacing throughout this area')}</label>
    <details><summary>{uiText('Alignment')} · {angle}° · {x}″ / {y}″ {uiText('shifts')}</summary>
      <div className="workspace-grid-fields">
      <label>{uiText('Angle (degrees)')}<input type="number" min="-360" max="360" value={angle} onChange={e=>setAngle(e.target.value)} /></label>
      <label>{uiText('Edge clearance (in)')}<input type="number" min="0" step="any" value={inset} onChange={e=>setInset(e.target.value)} /></label>
      <label>{uiText('Grid shift X (in)')}<input type="number" min="0" step="any" value={x} onChange={e=>setX(e.target.value)} /></label>
      <label>{uiText('Grid shift Y (in)')}<input type="number" min="0" step="any" value={y} onChange={e=>setY(e.target.value)} /></label>
      </div>
    </details>
    <details><summary>{uiText('Footprint')}{footprintKind==='circle' ? ` · ${diameter}″ ${uiText('circle')}` : footprintKind==='rectangle' ? ` · ${width}″ × ${depth}″` : ` · ${uiText('Position markers only')}`}</summary>
      <label>{uiText('Footprint shape')}<select value={footprintKind} onChange={e=>setFootprintKind(e.target.value)}><option value="none">{uiText('Position markers only')}</option><option value="circle">{uiText('Circle')}</option><option value="rectangle">{uiText('Rectangle')}</option></select></label>
      {footprintKind==='circle' && <label>{uiText('Diameter (in)')}<input type="number" min="0.01" step="any" value={diameter} onChange={e=>setDiameter(e.target.value)} /></label>}
      {footprintKind==='rectangle' && <><label>{uiText('Width along grid X (in)')}<input type="number" min="0.01" step="any" value={width} onChange={e=>setWidth(e.target.value)} /></label><label>{uiText('Depth along grid Y (in)')}<input type="number" min="0.01" step="any" value={depth} onChange={e=>setDepth(e.target.value)} /></label></>}
      {footprintKind!=='none' && <><label>{uiText('Dimension basis')}<select value={footprintBasis} onChange={e=>setFootprintBasis(e.target.value)}><option value="assumed">{uiText('Assumed')}</option><option value="specified">{uiText('Specified in source')}</option></select></label><label>{uiText('Dimension source or assumption')}<input value={footprintReference} onChange={e=>setFootprintReference(e.target.value)} /></label><p>{uiText('Footprint dimensions do not set spacing.')}</p></>}
    </details>
    <details open={!saved}><summary>{uiText('Source and assumptions')}</summary>
      <label>{uiText('Spacing source and layout assumptions')}<input value={reference} onChange={e=>setReference(e.target.value)} /></label>
      <p>{uiText('Generated positions are a layout calculation, not observed items. Footprint dimensions and spacing need separate evidence or stated assumptions.')}</p>
    </details>
    {(cutPieces || footprintKind==='rectangle' && pattern!=='triangular') && <label className="workspace-grid-confirm"><input type="checkbox" checked={cutPieces} onChange={e=>setCutPieces(e.target.checked)}/>{uiText('Calculate full tiles and edge cuts')}</label>}
    <div aria-live="polite">
      {result.error ? <p role="alert">{uiText(result.error)}</p> : <p className="workspace-grid-result">{uiText(`Preview: ${result.count} positions${printed === undefined ? '' : ` · difference ${result.count-printed} from printed EA`}`)}</p>}
      {draftCuts && <p role={draftCuts.error ? 'alert' : undefined}>{uiText(draftCuts.error || `Cut preview: ${draftCuts.full_tiles} full tiles · ${draftCuts.edge_cut_pieces} edge cut pieces.`)}</p>}
    </div>
    <div className="area-assembly-actions"><button type="button" className="workspace-primary" disabled={!changed || !single || !!result.error || !!draftCuts?.error || !!(draft.source_callout_id && !source)} onClick={()=>onSave(area,draft)}>{uiText('Save grid')}</button><button type="button" onClick={onCancel}>{uiText('Cancel')}</button>{saved && <button type="button" onClick={()=>onSave(area,null)}>{uiText('Remove grid')}</button>}</div>
  </div>;
}

export default function AreaGridPanel({ area, source, frame, onSave }) {
  const saved=getAreaGrid(area);
  const [editing,setEditing]=useState(false);
  const stored=useMemo(()=>areaGrid(area,frame),[area,frame]);
  const cuts=useMemo(()=>areaGridCuts(area,frame),[area,frame]);
  const printed=source?.computed?.count;
  const difference=stored.count===null || printed===undefined ? null : stored.count-printed;
  return <section className="workspace-grid" aria-label={uiText('Area grid count')} onKeyDown={e=>{if(e.target.matches('input, select')) e.stopPropagation();}}>
    <h3>{uiText('Area grid count')}</h3>
    {saved && <div className="workspace-grid-readouts">
      {printed!==undefined && <div><span>{uiText('Printed quantity')}</span><strong>{printed} EA</strong></div>}
      <div><span>{uiText('Calculated layout')}</span><strong>{stored.count ?? '—'}</strong><span>{uiText('positions')}</span></div>
    </div>}
    {difference!==null && <p className={difference ? 'workspace-grid-warning' : ''}>{uiText(difference===0 ? 'Matches printed quantity' : `${Math.abs(difference)} ${difference>0?'more':'fewer'} than printed`)}</p>}
    {stored.error && <p role="alert">{uiText(stored.error)}</p>}
    {saved?.source_callout_id && !source && <p role="alert">{uiText('Linked printed source unavailable; comparison withheld.')}</p>}
    {cuts && <section aria-label={uiText('Tile cut results')}>
      {cuts.error ? <p role="alert">{uiText(cuts.error)}</p> : <>
        <p className="workspace-grid-result">{uiText(`${cuts.full_tiles} full tiles · ${cuts.edge_cut_pieces} edge cut pieces`)}</p>
        <details><summary>{uiText('Edge cut schedule')}</summary>
          <p>{uiText(`Full: solid outline. Cuts: red dashed outline. ${cuts.cut_cells} cut cells · ${cuts.covered_sf.toFixed(2)} SF covered.`)}</p>
          <p>{uiText('Layout results only. Cut pieces can include hole boundaries. These are not purchased tiles; offcut reuse and waste are not calculated.')}</p>
          <table><thead><tr><th>{uiText('Cell (row:column)')}</th><th>{uiText('Pieces')}</th><th>{uiText('Retained SF')}</th></tr></thead><tbody>{cuts.cells.filter(cell=>cell.kind==='cut').map(cell=><tr key={cell.key}><td>{cell.key}</td><td>{cell.pieces.length}</td><td>{cell.area_sf.toFixed(3)}</td></tr>)}</tbody></table>
        </details>
      </>}
    </section>}
    <div className="workspace-grid-bar">
      {saved && <span className="workspace-quantity">{saved.spacing_ft*12}″{saved.pattern==='rectangular'?` × ${saved.spacing_y_ft*12}″`:''} · {uiText({square:'Square',triangular:'Triangular',rectangular:'Rectangular'}[saved.pattern] || saved.pattern)}</span>}
      <button type="button" aria-expanded={editing} onClick={()=>setEditing(!editing)}>{uiText(editing ? 'Close settings' : saved ? 'Adjust grid' : 'Set up grid')}</button>
    </div>
    {editing && <GridEditor area={area} source={source} frame={frame} onCancel={()=>setEditing(false)} onSave={(...args)=>{onSave(...args);setEditing(false);}} />}
    {source && <details><summary>{uiText('Printed source')} · {source.quantity_source.text}</summary><p>{source.quantity_source.reference}</p></details>}
  </section>;
}

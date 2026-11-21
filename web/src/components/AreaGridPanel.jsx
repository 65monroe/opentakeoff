import { useState } from 'react';
import { localizeText as uiText } from '../lib/i18n/core.js';
import { areaGrid, getAreaGrid, withAreaGrid } from '../lib/areaGrid.js';

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
  const draft={...(saved?.source_callout_id || source?.id ? {source_callout_id:saved?.source_callout_id || source.id} : {}),spacing_ft:Number(spacing)/12,pattern,angle_deg:Number(angle),inset_ft:Number(inset)/12,offset_x_ft:Number(x)/12,offset_y_ft:Number(y)/12,origin_norm:saved?.origin_norm || [...area.verts_norm[0]],reference,single_item:true};
  const result=areaGrid(withAreaGrid(area,draft),frame);
  const stored=areaGrid(area,frame);
  return <details className="workspace-grid" open={!!saved}>
    <summary>{uiText('Area grid count')}{stored.count !== null ? ` · ${stored.count} calculated` : ''}</summary>
    <p>{uiText('Generated layout positions within this outline. Existing takeoff quantities stay unchanged. Use one item type and spacing throughout.')}</p>
    {stored.error && <p role="status">{uiText(stored.error)}</p>}
    {saved?.source_callout_id && !source && <p role="status">{uiText('Linked printed source unavailable; comparison withheld.')}</p>}
    {stored.count !== null && <p className="workspace-grid-result">{uiText(`${stored.count} grid positions${printed === undefined ? ' · no printed comparison' : ` · ${printed} printed EA · difference ${stored.count-printed}`}`)}</p>}
    <label>{uiText('Spacing (in)')}<input type="number" min="0.01" step="any" value={spacing} onChange={e=>setSpacing(e.target.value)} /></label>
    <label>{uiText('Pattern')}<select value={pattern} onChange={e=>setPattern(e.target.value)}><option value="square">{uiText('Square')}</option><option value="triangular">{uiText('Triangular')}</option></select></label>
    <details><summary>{uiText('Orientation and edges')}</summary>
      <label>{uiText('Angle (degrees)')}<input type="number" min="-360" max="360" value={angle} onChange={e=>setAngle(e.target.value)} /></label>
      <label>{uiText('Edge clearance (in)')}<input type="number" min="0" step="any" value={inset} onChange={e=>setInset(e.target.value)} /></label>
      <label>{uiText('Grid shift X (in)')}<input type="number" min="0" step="any" value={x} onChange={e=>setX(e.target.value)} /></label>
      <label>{uiText('Grid shift Y (in)')}<input type="number" min="0" step="any" value={y} onChange={e=>setY(e.target.value)} /></label>
    </details>
    <label>{uiText('Spacing source and layout assumptions')}<input value={reference} onChange={e=>setReference(e.target.value)} /></label>
    <label className="workspace-grid-confirm"><input type="checkbox" checked={single} onChange={e=>setSingle(e.target.checked)} />{uiText('This outline applies to one item type and spacing throughout.')}</label>
    {spacing && reference && <p>{uiText(result.error || `Preview: ${result.count} positions${printed === undefined ? '.' : `; difference ${result.count-printed} from printed EA.`}`)}</p>}
    <div className="workspace-area-actions"><button type="button" disabled={!single || !!result.error || !!(draft.source_callout_id && !source)} onClick={()=>onSave(area,draft)}>{uiText('Save grid')}</button>{saved && <button type="button" onClick={()=>onSave(area,null)}>{uiText('Remove grid')}</button>}</div>
  </details>;
}

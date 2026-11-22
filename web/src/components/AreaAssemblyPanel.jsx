import { useState } from 'react';
import { localizeText as uiText } from '../lib/i18n/core.js';
import { areaAssembly, hasMaterialDepth, materialDepthInches, materialDepthEdit, materialDraftError, materialDraftPatch } from '../lib/areaAssembly.js';
import { conditionTotals } from '../lib/totals.js';
import { workReviewState } from '../lib/workReview.js';
import { AssemblyBar, MaterialsEditor, useAssemblyLibrary } from './TakeoffsPanel.jsx';

function MaterialRow({ row, condition, shapes, disabled, onSave }) {
  const [draft, setDraft] = useState(null);
  const [depthInput, setDepthInput] = useState(null);
  const { material, total, depth } = row;
  const depthError = draft && depthInput !== null ? materialDepthEdit(draft, depthInput).error : '';
  const error = depthError || (draft ? materialDraftError(draft) : '');
  const patch = draft ? materialDraftPatch(material, draft) : {};
  const preview = draft && !error && conditionTotals([{ ...condition, materials: [draft] }], shapes)[0].materials[0];
  const updateDraft = fields => {
    setDraft(d => ({ ...d, ...fields }));
    if (['per', 'basis', 'unit', 'rule'].some(key => key in fields)) setDepthInput(null);
  };
  const startEdit = () => { setDraft(structuredClone(material)); setDepthInput(null); };
  return <article className="area-assembly-row" aria-label={material.name || uiText('Unnamed material')}>
    <div className="area-assembly-readout"><strong>{material.name || uiText('Unnamed material')}</strong><strong className="workspace-quantity">{total ? `${total.qty} ${total.unit}` : uiText('Not figured')}</strong></div>
    {depth !== null && <p>{uiText('Equivalent uniform depth')} · {Number(depth.toFixed(4))} {uiText('in')}</p>}
    {draft ? <div className="area-material-draft">
      {hasMaterialDepth(draft) && <label>{uiText('Depth (in)')}<input name="material-depth-in" type="number" min="0" step="any"
        value={depthInput ?? (materialDepthInches(draft) ?? '')} onChange={e => {
          const value = e.target.value, change = materialDepthEdit(draft, value);
          setDepthInput(value);
          if (change.patch) setDraft(d => ({ ...d, ...change.patch }));
        }} /></label>}
      {hasMaterialDepth(draft) && <p>{uiText('CY = area SF × depth in inches ÷ 324. Existing multiplier, material waste and rounding still apply.')}</p>}
      <MaterialsEditor materials={[draft]} onUpdate={(_id, fields) => updateDraft(fields)} />
      <p>{uiText('Preview')} · {preview ? `${preview.qty} ${preview.unit}` : uiText('Not figured')}</p>
      <p>{uiText('Keep the material name and source note consistent with any changed depth or rate. Labels and source notes are not rewritten. Measured SF, EA and LF stay unchanged.')}</p>
      {error && <p role="alert">{uiText(error)}</p>}
      <div className="area-assembly-actions"><button type="button" disabled={disabled || !!error || !Object.keys(patch).length} onClick={() => { onSave(material.id, patch); setDraft(null); }}>{uiText('Save material')}</button><button type="button" onClick={() => setDraft(null)}>{uiText('Cancel')}</button></div>
    </div> : <div className="area-assembly-actions">
      <button type="button" disabled={disabled} onClick={startEdit}>{uiText('Edit material')}</button>
      {material.note && <details><summary>{uiText('Source and calculation')}</summary><p>{material.note}</p></details>}
    </div>}
  </article>;
}

export default function AreaAssemblyPanel({ area, shapes, conditions, onBack, onLocate, onMaterial, onApply, onLabel, fmtArea, fmtLength }) {
  const model = areaAssembly(area, shapes, conditions);
  const assemblies = useAssemblyLibrary();
  const [editingLabel, setEditingLabel] = useState(null);
  const [sourceId, setSourceId] = useState(null);
  const selectedSource = model.sources.find(row => row.id === sourceId && row.shape) || model.sources.find(row => row.shape);
  const name = shape => conditions[shape.condition_id]?.finish_tag || uiText('Unassigned');
  const labelEditor = shape => editingLabel?.id === shape.id ? <form className="area-assembly-actions" onSubmit={e => { e.preventDefault(); onLabel(shape.id, editingLabel.value); setEditingLabel(null); }}>
    <label>{uiText('Measurement label')}<input value={editingLabel.value} onChange={e => setEditingLabel({ id: shape.id, value: e.target.value })} /></label>
    <button type="submit">{uiText('Save label')}</button><button type="button" onClick={() => setEditingLabel(null)}>{uiText('Cancel')}</button>
  </form> : <button type="button" onClick={() => setEditingLabel({ id: shape.id, value: shape.label || '' })}>{uiText('Edit label')}</button>;
  return <section className="area-assembly-panel" aria-label={uiText('Area assembly')} onKeyDown={e => { if (e.target.matches('input, textarea, select')) e.stopPropagation(); }}>
    <header><button type="button" onClick={onBack}>{uiText('Back to measurements')}</button><h3>{name(area)} · {area.label || uiText('Area assembly')}</h3>
      <div className="area-assembly-readout"><strong className="workspace-quantity">{fmtArea(area.computed?.area_sf || 0)}</strong><span>{uiText(workReviewState(area))}</span></div>
      <button type="button" onClick={() => onLocate(area)}>{uiText('Edit area on plan')}</button>
    </header>
    <h4>{uiText('Linked counts')} · {uiText('Printed EA')}</h4>
    {!model.sources.length && <p>{uiText('No linked printed counts.')}</p>}
    {!!model.sources.length && <table className="area-source-table" aria-label={uiText('Linked printed quantities')}>
      <thead><tr><th scope="col">{uiText('Code')}</th><th scope="col">EA</th><th scope="col">{uiText('Review')}</th><th scope="col">{uiText('On plan')}</th></tr></thead>
      <tbody>{model.sources.map(({ id, shape, shared }) => <tr key={id} className={selectedSource?.id === id ? 'is-selected' : ''}>
        {!shape ? <td colSpan={4}><p role="status">{uiText('Source callout unavailable')} · {id}</p></td> : <>
          <th scope="row"><button type="button" aria-pressed={selectedSource?.id === id} onClick={() => { setSourceId(id); setEditingLabel(null); }}>{name(shape)}</button>{shared && <span className="area-source-shared">{uiText('Shared')}</span>}</th>
          <td className="workspace-quantity">{shape.computed?.count}</td>
          <td className={workReviewState(shape) === 'Needs review' ? 'workspace-pending' : ''}>{uiText(workReviewState(shape))}</td>
          <td><button type="button" aria-label={`${uiText('Locate')} ${name(shape)}`} onClick={() => { setSourceId(id); setEditingLabel(null); onLocate(shape, { sourceOnly: true }); }}>{uiText('Locate')}</button></td>
        </>}
      </tr>)}</tbody>
    </table>}
    {selectedSource && <details className="area-source-details" key={selectedSource.id}>
      <summary>{name(selectedSource.shape)} · {uiText('Source details')}</summary>
      <p>{selectedSource.shape.quantity_source.text} · {uiText(workReviewState(selectedSource.shape))}</p>
      {selectedSource.shared && <p role="status">{uiText('This source serves multiple areas. Its quantity is not allocated to this bed.')}</p>}
      <p>{selectedSource.shape.quantity_source.reference}</p><p>{selectedSource.id}</p>
      {selectedSource.shape.label && <p>{selectedSource.shape.label}</p>}
      {labelEditor(selectedSource.shape)}
    </details>}
    {!!model.materials.length && <h4>{uiText('Materials')}</h4>}
    {model.editReason && <p role="status">{uiText(model.editReason)}</p>}
    {Number(model.condition?.multiplier || 1) !== 1 && <p>{uiText('Material totals include condition multiplier')} ×{model.condition.multiplier}.</p>}
    {model.materials.map(row => <MaterialRow key={`${row.material.id}:${JSON.stringify(row.material)}`} row={row} condition={model.condition} shapes={shapes} disabled={!!model.editReason} onSave={(id, patch) => onMaterial(area.condition_id, id, patch)} />)}
    {model.condition && !model.editReason && <details className="area-assembly-library"><summary>{uiText(model.materials.length ? 'Saved assemblies' : 'Add materials')}</summary><AssemblyBar cond={model.condition} assemblies={assemblies} onApply={a => onApply(area.condition_id, a)} /></details>}
    {!!model.edges.length && <h4>{uiText('Derived lengths')}</h4>}
    {model.edges.map(({ shape, stale }) => <article key={shape.id} className="area-assembly-row">
      <div className="area-assembly-readout"><strong>{name(shape)}</strong><strong className="workspace-quantity">{fmtLength(shape.computed?.perimeter_lf || 0)}</strong></div>
      <p>{uiText(workReviewState(shape))} · {shape.label}</p>
      {stale && <p role="status">{uiText('The run differs from its source boundary. Review the geometry; length has not been recalculated.')}</p>}
      <p>{uiText('Derived boundary snapshot')} · {shape.origin.derived.gross_lf} {uiText('LF gross')} − {shape.origin.derived.openings_lf} {uiText('LF openings')}</p>
      <div className="area-assembly-actions"><button type="button" onClick={() => onLocate(shape)}>{uiText('Edit run on plan')}</button>{labelEditor(shape)}</div>
    </article>)}
  </section>;
}

import { finishLabel, localizeText as uiText } from "../lib/i18n/core.js";
import { useEffect, useMemo, useState } from "react";
import { filterWork, workActor, workMethod, workQuantity, workReviewState } from "../lib/workReview.js";
import { Z } from "../lib/ui.js";
import { ScanStar } from "../brand/marks.jsx";
import { isCalloutQuantity, linkedCalloutAreas } from "../lib/calloutQuantity.js";
import "./workspacePanel.css";
import AreaGridPanel from './AreaGridPanel.jsx';
import { getAreaGrid } from '../lib/areaGrid.js';

export default function WorkspacePanel({ open, shapes, conditions, selectedId, sheetLabel, fmtArea, fmtLength,
  scales, scaleUnconfirmed, running, proposalCount, onLocate, onReview, onClose, onReport, onGrid, gridFrames, children, dockSide, width, dockHandle }) {
  const [tab, setTab] = useState("work");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);
  const pending = shapes.filter((s) => workReviewState(s) === "Needs review").length;
  const rows = useMemo(() => filterWork(shapes, { filter, query,
    conditionLabel: (id) => conditions[id]?.finish_tag || "", sheetLabel }), [shapes, filter, query, conditions, sheetLabel]);
  const selected = shapes.find((s) => s.id === selectedId);
  const plantingAreas = linkedCalloutAreas(selected, shapes);
  const gridArea=plantingAreas.length===1 ? plantingAreas[0] : selected?.measure_role==='floor_area' ? selected : null;
  const savedGrid=getAreaGrid(gridArea);
  const gridSourceId=savedGrid ? savedGrid.source_callout_id : isCalloutQuantity(selected) ? selected.id : gridArea?.source_callout_ids?.length===1 ? gridArea.source_callout_ids[0] : undefined;
  const gridSource=gridArea && shapes.find(s=>s.id===gridSourceId && s.sheet_id===gridArea.sheet_id && isCalloutQuantity(s));
  useEffect(() => { setLimit(50); }, [filter, query]);
  const quantity = (shape) => {
    const q = workQuantity(shape);
    if (q.value === null) return "Not measured";
    const text = q.kind === "count" ? `${q.value} EA` : q.kind === "length" ? fmtLength(q.value) : fmtArea(q.value);
    return `${q.deduct ? "−" : ""}${text}`;
  };
  const evidence = selected?.origin?.evidence || {};
  return (
    <aside className="workspace-panel" hidden={!open} aria-label={uiText("Work and review")} data-dock-side={dockSide} style={{ zIndex: Z.drawer, ...(dockSide ? { order: dockSide === "left" ? -10 : 10, width } : {}) }} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
      <header className="workspace-heading">
        {uiText(dockHandle)}
        <div><span className="workspace-eyebrow">{uiText("Shared workspace")}</span><h2>{uiText("Work and review")}</h2></div>
        <button type="button" onClick={onClose} aria-label={uiText("Close work panel")}>×</button>
      </header>
      <div className="workspace-summary">
        <div><strong>{uiText(shapes.length)}</strong><span>{uiText("measurements")}</span></div>
        <div><strong>{uiText(pending)}</strong><span>{uiText("need review")}</span></div>
        <div><strong>{uiText(new Set(shapes.map((s) => s.sheet_id)).size)}</strong><span>{uiText("sheets with work")}</span></div>
      </div>
      <div className="workspace-tabs" role="tablist" aria-label={uiText("Workspace views")} onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const next = e.key === "Home" ? "work" : e.key === "End" ? "agent" : tab === "work" ? "agent" : "work";
        setTab(next); document.getElementById(`workspace-${next}-tab`)?.focus();
      }}>
        <button type="button" role="tab" tabIndex={tab === "work" ? 0 : -1} id="workspace-work-tab" aria-controls="workspace-work-view" aria-selected={tab === "work"} onClick={() => setTab("work")}>{uiText("Measurements")}</button>
        <button type="button" role="tab" tabIndex={tab === "agent" ? 0 : -1} id="workspace-agent-tab" aria-controls="workspace-agent-view" aria-selected={tab === "agent"} onClick={() => setTab("agent")}><ScanStar size={12} working={!!running} style={{ marginRight: 6 }} />{uiText("Agent ")}{uiText(running ? "· Working" : proposalCount ? `· ${proposalCount} proposals` : "")}</button>
      </div>
      <div id="workspace-agent-view" role="tabpanel" aria-labelledby="workspace-agent-tab" hidden={tab !== "agent"} className="workspace-agent-view">{uiText(children)}</div>
      <div id="workspace-work-view" role="tabpanel" aria-labelledby="workspace-work-tab" hidden={tab !== "work"} className="workspace-work-view">
        <div className="workspace-filters">
          <label className="workspace-search"><span>{uiText("Find work")}</span><input name="work-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={uiText("Condition, sheet, label, or author")} /></label>
          <div className="workspace-filter-buttons" aria-label={uiText("Filter measurements")}>
            {[["all", "All work"], ["pending", `Needs review · ${pending}`], ["agent", "Agent"]].map(([id, label]) =>
              <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{uiText(label)}</button>)}
          </div>
        </div>
        <div className="workspace-list" aria-label={uiText("Measurements")}>
          {!rows.length && <div className="workspace-empty"><h3>{uiText(shapes.length ? "No matching work" : "Your measurements appear here")}</h3><p>{uiText(shapes.length ? "Change the filter or search to see more measurements." : "Measure on the plan or import an agent’s takeoff. Inspect either actor’s work here, then open its boundary on the drawing.")}</p></div>}
          {rows.slice(0, limit).map((shape) => <button type="button" className="workspace-row" key={shape.id} aria-pressed={selectedId === shape.id} onClick={() => onLocate(shape)}>
            <span className="workspace-row-top"><strong>{conditions[shape.condition_id] ? finishLabel(conditions[shape.condition_id].finish_tag) : uiText("Unassigned")}{shape.label ? ` · ${shape.label}` : ""}</strong><span className="workspace-quantity">{uiText(quantity(shape))}</span></span>
            <span className="workspace-sheet">{sheetLabel(shape.sheet_id)}{isCalloutQuantity(shape) && <> · {uiText("Printed callout")}</>}</span>
            <span className="workspace-row-bottom"><span>{workActor(shape) === "Agent" && <ScanStar size={10} style={{ marginRight: 5, color: "var(--cobalt)" }} />}{uiText(shape.author || workActor(shape))}</span><span className={workReviewState(shape) === "Needs review" ? "workspace-pending" : ""}>{uiText(workReviewState(shape))}</span></span>
          </button>)}
          {rows.length > limit && <button type="button" className="workspace-more" onClick={() => setLimit((n) => n + 50)}>{uiText("Show more · ")}{uiText(rows.length - limit)} {uiText("remaining")}</button>}
        </div>
        {selected && <section className="workspace-inspector" aria-label={uiText("Selected measurement")}>
          <div className="workspace-inspector-title"><h3>{uiText("Measurement receipt")}</h3><strong className="workspace-quantity">{uiText(quantity(selected))}</strong></div>
          <dl>
            <div><dt>{uiText("Source")}</dt><dd>{uiText(workActor(selected))}{uiText(selected.author ? ` · ${selected.author}` : "")}</dd></div>
            <div><dt>{uiText("Method")}</dt><dd>{uiText(workMethod(selected))}</dd></div>
            <div><dt>{uiText("Review")}</dt><dd>{uiText(workReviewState(selected))}</dd></div>
            <div><dt>{uiText("Scale")}</dt><dd>{uiText(scales[selected.sheet_id] ? scaleUnconfirmed[selected.sheet_id] === false ? "Set · needs confirmation" : "Set" : "Not set")}</dd></div>
            {isCalloutQuantity(selected) ? <>
              <div><dt>{uiText("Quantity basis")}</dt><dd>{uiText("Printed quantity; individual locations not measured")}</dd></div>
              {!plantingAreas.length && <><div><dt>{uiText("Drawing text")}</dt><dd>{selected.quantity_source.text}</dd></div>
              <div><dt>{uiText("Source reference")}</dt><dd>{selected.quantity_source.reference}</dd></div>
              <div><dt>{uiText("Source ID")}</dt><dd>{selected.quantity_source.id}</dd></div></>}
              {plantingAreas.map((area) => <div key={area.id}><dt>{uiText("Planting area")}</dt><dd>{area.label || conditions[area.condition_id]?.finish_tag} · {quantity(area)}</dd></div>)}
            </> : <div><dt>{uiText("Geometry")}</dt><dd>{uiText(selected.verts_norm?.length || 0)} {uiText("vertices · ")}{uiText(selected.verts_norm_holes?.length || 0)} {uiText("holes")}</dd></div>}
            {evidence.matched_text && <div><dt>{uiText("Drawing text")}</dt><dd>{uiText(String(evidence.matched_text))}</dd></div>}
            {evidence.schedule_row_tag && <div><dt>{uiText("Schedule tag")}</dt><dd>{uiText(String(evidence.schedule_row_tag))}</dd></div>}
          </dl>
          {!!plantingAreas.length && <details><summary>{uiText('Source')} · {selected.quantity_source.text}</summary><p>{selected.quantity_source.reference} · {selected.quantity_source.id}</p><button type="button" onClick={()=>onLocate(selected,{sourceOnly:true})}>{uiText('Show source callout')}</button></details>}
          <p className="workspace-receipt-note">{uiText("Recorded provenance. Review status does not verify measurement accuracy.")}</p>
          {Array.isArray(selected.source_callout_ids) && !!selected.source_callout_ids.length && <div className="workspace-inspector-actions workspace-area-actions" aria-label={uiText("Printed sources")}>
            {selected.source_callout_ids.map((id) => {
              const source = shapes.find((s) => s.id === id && s.sheet_id === selected.sheet_id && isCalloutQuantity(s));
              return source ? <button key={id} type="button" onClick={() => onLocate(source, { sourceOnly: true })}>{uiText("Show callout")} · {source.quantity_source.text}</button> : <p key={id}>{uiText("Source callout unavailable")} · {id}</p>;
            })}
            <p className="workspace-receipt-note">{uiText("Editing this area changes SF, not its linked printed EA. Shared beds do not locate individual plants.")}</p>
          </div>}
          {!!plantingAreas.length && <div className="workspace-inspector-actions workspace-area-actions">
            {plantingAreas.map((area) => <button key={area.id} type="button" onClick={() => onLocate(area)}>{uiText("Edit planting area")}{plantingAreas.length > 1 ? ` · ${area.label || conditions[area.condition_id]?.finish_tag}` : ""}</button>)}
          </div>}
          <div className="workspace-inspector-actions"><button type="button" onClick={() => onLocate(selected)}>{uiText("Show on plan")}</button>{selected.origin?.reviewed === false && <button type="button" className="workspace-primary" onClick={() => onReview(selected.id)}>{uiText("Mark reviewed")}</button>}</div>
          {gridArea && onGrid && <AreaGridPanel key={`${gridArea.id}:${JSON.stringify(getAreaGrid(gridArea))}`} area={gridArea} source={gridSource} frame={gridFrames?.get(gridArea.sheet_id)} onSave={onGrid} />}
        </section>}
        <footer className="workspace-footer"><span>{uiText(rows.length)} {uiText("of ")}{uiText(shapes.length)} {uiText("measurements")}</span><button type="button" onClick={onReport}>{uiText("Open report →")}</button></footer>
      </div>
    </aside>
  );
}

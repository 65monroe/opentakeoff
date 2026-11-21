// A source anchor is not an installed item's location. Keep that distinction
// on the existing count record so review, IDs and undo use the same machinery.
export const isCalloutQuantity = (s) => s?.quantity_source?.kind === "printed_callout";

export function calloutQuantityError(s) {
  if (s?.quantity_source === undefined) return null;
  const q = s.quantity_source;
  if (!q || q.kind !== "printed_callout" || q.unit !== "EA") return "Unsupported quantity source; expected a printed EA callout.";
  if (![q.id, q.text, q.reference].every((v) => typeof v === "string" && v.trim().length > 0)) return "A printed callout needs a source ID, drawing text and reference.";
  if (s.measure_role !== "count" || !Number.isSafeInteger(s.computed?.count) || s.computed.count <= 0) return "A printed callout needs a positive whole EA quantity on a count record.";
  if (!Array.isArray(s.verts_norm) || s.verts_norm.length !== 1 || !Array.isArray(s.verts_norm[0]) || s.verts_norm[0].length !== 2 || !s.verts_norm[0].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return "A printed callout needs one source anchor within its sheet.";
  return null;
}

// Additive disclosure only when needed; old exports stay unchanged. The
// condition multiplier applies to both bases just as it does to total EA.
export function countBasis(shapes, multiplier = 1) {
  const counts = shapes.filter((s) => s.measure_role === "count");
  if (!counts.some(isCalloutQuantity)) return {};
  const printed = counts.filter(isCalloutQuantity).reduce((n, s) => n + s.computed.count, 0);
  const located = counts.filter((s) => !isCalloutQuantity(s)).reduce((n, s) => n + (s.computed?.count || 1), 0);
  return {
    count_basis: { located_ea: located * multiplier, printed_ea: printed * multiplier },
    printed_callouts: counts.filter(isCalloutQuantity).map((s) => ({
      measurement_id: s.id, sheet_id: s.sheet_id, source_id: s.quantity_source.id,
      text: s.quantity_source.text, reference: s.quantity_source.reference,
      quantity: s.computed.count, unit: "EA", anchor_norm: [...s.verts_norm[0]],
      ...(typeof s.origin?.reviewed === "boolean" ? { reviewed: s.origin.reviewed } : {}),
    })),
  };
}

export const countBasisText = (row) => row.count_basis
  ? `${row.count_basis.located_ea} EA located; ${row.count_basis.printed_ea} EA from printed callouts`
  : "";

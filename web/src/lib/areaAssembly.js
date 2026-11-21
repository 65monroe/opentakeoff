// A view over existing records. No inferred plant allocations, duplicate
// measurements, or persisted assembly-to-shape mapping.
import { isCalloutQuantity, linkedCalloutAreas } from './calloutQuantity.js';
import { conditionTotals, itemRule } from './totals.js';

export function assemblyAreas(selected, shapes) {
  if (!selected) return [];
  if (selected.measure_role === 'floor_area') return [selected];
  if (isCalloutQuantity(selected)) return linkedCalloutAreas(selected, shapes);
  return shapes.filter(s => s.measure_role === 'floor_area' && s.sheet_id === selected.sheet_id &&
    s.id === selected.origin?.derived?.from_shape_id);
}

export function areaAssembly(area, shapes, conditions) {
  const condition = conditions[area.condition_id];
  const scope = shapes.filter(s => s.condition_id === area.condition_id);
  const family = condition?.variant_of || Object.values(conditions).some(c => c.variant_of === area.condition_id);
  const editReason = !condition ? 'Area condition unavailable.' : family
    ? 'This condition belongs to a material family. Edit its materials in the condition panel so inheritance is visible.'
    : scope.length !== 1 ? 'Materials apply to every measurement on this condition. Edit them in the condition panel to review that wider scope.' : '';
  const sources = [...new Set(area.source_callout_ids || [])].map(id => {
    const shape = shapes.find(s => s.id === id && s.sheet_id === area.sheet_id && isCalloutQuantity(s));
    return { id, shape, shared: shape ? linkedCalloutAreas(shape, shapes).length > 1 : false };
  });
  const edges = shapes.filter(s => s.measure_role === 'linear' && s.sheet_id === area.sheet_id &&
    s.origin?.derived?.from_shape_id === area.id).map(shape => {
      const ring = [...(area.verts_norm || []), area.verts_norm?.[0]];
      const stale = JSON.stringify(ring) !== JSON.stringify(shape.verts_norm) ||
        shape.origin.derived.gross_lf !== area.computed?.perimeter_lf;
      return { shape, stale };
    });
  const materials = (condition?.materials || []).map(material => ({ material,
    total: conditionTotals([{ ...condition, materials: [material] }], shapes)[0].materials[0],
    // Equivalent depth is a conversion of an existing coverage rate, never a
    // new source specification or an independently persisted depth field.
    depth: material.unit?.toUpperCase() === 'CY' && material.basis === 'area' &&
      itemRule(material) === 'coverage' && Number(material.per) > 0 ? 324 / Number(material.per) : null,
  }));
  return { condition, materials, sources, edges, editReason };
}

export function materialDraftError(row) {
  if (!row.name?.trim() || !row.unit?.trim()) return 'Enter a material name and unit.';
  if (!Number.isFinite(Number(row.per)) || Number(row.per) <= 0) return 'Enter a positive coverage rate or count per unit.';
  return '';
}

export function materialDraftPatch(before, draft) {
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => key !== 'id' && JSON.stringify(value) !== JSON.stringify(before[key])));
}

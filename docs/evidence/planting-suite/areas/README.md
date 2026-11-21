# SET callouts linked to editable planting areas

Both existing SET callouts now link to native editable area outlines. **Show on
plan** frames the source text and its bed together. **Show source callout** centers
the printed text; **Edit planting area** selects the normal area grips. The area
receipt links back to the source. Editing SF does not alter printed EA.

This is a fork-only increment on `codex/planting-suite`, tested on 2026-11-20.
No new PR, upstream merge or production deployment. No CLG skill, company memory,
private drawing or catalog data was used. Coordinates were visually traced from
the [public source](../source.json), using general PDF inspection and actual MCP
tools. This is source-assisted tracing, not automated bed recognition.

## What changed and what stayed fixed

| Record | Source | Linked area | Result |
|---|---|---|---|
| C1 | `127 - SET`, west hatch | BED-C1, 110.5 SF | SET-only herringbone region; curved south edge |
| C2 | `58 - SET`, east mixed bed | BED-C2, 329.88 SF | Shared bed; **north edge approximate** beneath symbols |

The C2 outline excludes the separate herringbone pocket to its east. Its north
edge is provisional: verify the extent before using its SF. It does not assign
the whole area exclusively to SET or divide it among the eight listed species.
Only the existing SET source record is linked in this sample; the other seven
species have not been transcribed into quantity records. The field accepts
multiple source IDs for future shared-bed records.

The five baseline records (three individually located trees and two printed
callouts), three original conditions, calibration and annotations are unchanged.
New links are stored on the **two new area records**, so attaching a bed does not
edit the original callout. SET remains **127 + 58 = 185 printed EA**, with zero
individually located SET points. Bed SF is separate. All seven records remain
pending; no review decision or scale confirmation was manufactured. Grid count
is not implemented here.

## Browser evidence

Tested in the **Codex in-app browser**, existing `http://127.0.0.1:5200/` tab,
against a local production build. Build identity and checks are in
[checks.json](checks.json). The public hosted app was not changed.

1. Exported the live browser project before changes: [baseline.json](baseline.json).
   A PDF-containing `.otk` backup is retained locally, outside tracked evidence.
2. Imported the MCP result using normal **Import takeoff**. The UI reported two
   new measurements and two new conditions; existing workspace decisions won.
3. Selected each SET entry and used **Show on plan**. Source text and linked bed
   were visible together. C1 source-only navigation also centered the printed text.
4. Opened **Edit planting area** for each bed. Dragged one native corner, observed
   SF change, then used Undo. C1 changed 110.5 → 128.38 → 110.5 SF; C2 changed
   329.88 → 339.94 → 329.88 SF. SET stayed 185 EA. C1's reverse link returned to
   the existing 127-EA record.
5. Exported JSON and a self-contained `.otk` through the UI. Reopened that archive
   using **Open plans**, then repeated **Show on plan** for both SET entries.
6. Downloaded JSON again. The complete before/after exports are exactly equal;
   all original records and new area geometries match their inputs exactly.

| Actual browser view | Evidence |
|---|---|
| Final compact receipts | [C1](browser-c1-final.jpg), [C2](browser-c2-final.jpg), [area controls](browser-c1-edit-final.jpg) |
| C1 source and bed | [Show on plan](browser-c1-linked.jpg), [after archive reopen](browser-c1-reopened.jpg) |
| C1 source-only view | [Printed callout centered](browser-c1-source.jpg) |
| C1 editable geometry | [Native grips](browser-c1-edit.jpg), [temporary edit, then undone](browser-c1-edit-changed.jpg) |
| C2 source and shared bed | [Show on plan](browser-c2-linked.jpg), [after archive reopen](browser-c2-reopened.jpg) |
| C2 editable geometry | [Native grips](browser-c2-edit.jpg), [temporary edit, then undone](browser-c2-edit-changed.jpg) |

The screenshots are actual application captures. The two `*-area-overlay.png`
files are MCP-rendered source overlays, not browser screenshots. Intermediate
edit captures intentionally show the temporary SF before Undo. A final receipt
layout pass wraps actions and shortens the single-bed edit button; final-build
captures and identities are recorded in the checks file.

## Reproduce and audit

Use the exact source page extraction and checksum in [the public source
manifest](../source.json). From the repository root:

```sh
node docs/evidence/planting-suite/link-areas.mjs /absolute/path/ccfp-L1.0.pdf docs/evidence/planting-suite/areas/baseline.json /absolute/path/output
node docs/evidence/planting-suite/areas/verify-exports.mjs
```

The first command reads `takeoff://wiki`, loads the public plan, imports the
baseline and uses `propose_takeoff`, `measure_polygon`, `edit_shape`, `view_sheet`,
`export_takeoff`, `export_report` and `export_marked_pdf`. It asserts preservation
of all baseline records. A fresh reproduction creates new **area** IDs, while
preserving the five baseline IDs. [Source traces](source-traces.json) give the
full-sheet image-pixel coordinates (5184 × 3456); saved vertices are normalized.

- [Editable MCP output](takeoff.json), [report](report.json), [MCP transcript](transcript.json)
- [MCP preservation assertions and area IDs](results.json)
- [Browser export before reopen](browser-before-reopen.json), [after reopen](browser-after-reopen.json)
- [C1 source overlay](c1-area-overlay.png), [C2 source overlay](c2-area-overlay.png)

For the browser, open the same PDF and import the JSON, or open the locally
exported `.otk` with **Open plans**. A project archive replaces the current
workspace; export the current job first. No source PDF or PDF-containing archive
is committed to Git.

## Limits and remaining contribution evidence

The MCP `edit_shape` operation now accepts `source_callout_ids` on a `floor_area`.
It requires valid printed-callout references on the same sheet. Import preserves
unresolved references; the receipt exposes missing sources instead of navigating
to them. Accepted source records stay unchanged; an agent still cannot edit an
accepted area. Automated tests cover source preservation, invalid links,
import, archive persistence, and native geometry edit/undo.

This pass verifies the requested public-plan flow. The existing contribution
gaps remain: a continuous actual-app recording, this changed flow on the bundled
sample plan, and human evaluation of the interaction. Existing report dark-theme
contrast and the unconfirmed source calibration are not fixed by these links.
No full-plan completeness, speed, automatic detection or human approval is claimed.

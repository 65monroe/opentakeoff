# Planting suite validation

Tested on 2026-11-20 from upstream
`8a31fb49d5a2c286c665017219073b0abe61695b`, independently of the count-ring and
bulk-review branches. The full checks ran on Node 24.22.1; after the desktop
update, the final public replay ran on Node 24.22.3. Local MCP version 0.9.117
is not published.
The version was unused when chosen; a maintainer can renumber it before merge.

## Expected versus observed

| Case | Expected | Observed |
|---|---|---|
| Division 32 before this branch | No suite | Refusal on upstream |
| Catalog / open by name / open by division | Planting method, one count preset, no extra tools | Pass; default tool list remains 70 |
| Open and reopen a method | No project mutation or duplicate work | Exact payload equality on bundled and public samples |
| GDI tree symbols | 1 EA | 1 EA at its symbol center |
| TAM tree symbols | 2 EA | 2 EA at their symbol centers |
| Existing tree callout | Corroborates those same 3 trees | No extra count points |
| SET printed callouts | 127 + 58 = 185 printed EA | 185 in two source notes; 0 measured SET EA |
| SET schedule comparison | 185 printed EA versus 185 scheduled | Difference 0 for those source quantities; individual locations remain unmeasured |
| Mixed quantity bases | Never combine printed SET EA with located tree EA silently | Report measures 3 EA; separate source ledger in source.json and notes |
| Code capitalization | `pa` and `Pa` remain distinct | Synthetic bundled-plan test: 0 and 1 measured EA respectively |
| A printed-only note | Does not create geometry or measured EA | Synthetic 12 + 8 note case: 2 notes, 0 shapes, 0 EA |
| Review | Agent work stays pending | 3/3 pending; no human approval created |
| Calibration | Printed 1 inch = 20 feet → 20/144 ft per image px | 0.1388888888888889; human confirmation false |
| Export/import | IDs, geometry, conditions, notes, proposals and review preserved | Exact equality; quantities remain 1, 2, 0 |
| Core before/after | Same count inputs, unchanged output | [3/3 exact measurement projections](results/core-comparison.json) |
| Planting schedule reader | No claim of supported automatic parsing | `find_schedule` refuses; schedule read visually from `view_sheet` |

The [saved results](results/results.json), [report](results/report.json) and
[tool trace](results/transcript.json) contain the observed output. These are
agent-executed checks, not human approval. There is no claim about time saved,
detector accuracy, all plants on the sheet, or a completed project estimate.

The before/after comparison removes random IDs across independent sessions
and excludes proposal prose and annotation presentation. It compares all three
normalized count locations, quantity values, roles, code assignments, origin
method/actor/review/assignment, calibration and quantity settings. The separate
reload check compares the original IDs exactly within the same exported run.

## Required checks

| Command | Result |
|---|---|
| `npm ci --prefix web`, `npm ci --prefix mcp`, `npm ci --prefix protocol` | Locked installs completed |
| `npm run check --prefix web` | Typecheck, lint, tests, benchmark, build and OCR distribution check pass; 3,835 tests pass, 4 skipped, 0 failed |
| `npm run typecheck --prefix mcp` | Pass |
| `npm test --prefix mcp` | 330 pass, 1 skipped, 0 failed |
| `npm run check --prefix protocol` | 61 pass; 11 schemas and 16 transport cases match docs |
| `npm run check:tool-count --prefix mcp` | 70 default / 72 gated tools; version and inventory checks pass |
| `npm run check:wiki --prefix mcp` | 11 packaged wiki pages current |
| `npm run check:versions --prefix mcp` | Included in tool-count check; all seven MCP version fields agree |
| `node scripts/check-doc-links.mjs` | 49 primary documentation files pass |
| `npm run build --prefix mcp` | Pass |
| `npm run smoke:dist --prefix mcp` | Built stdio server passes in flat and staged modes; 11 schema and 11 wiki resources |
| Public source download plus replay commands in README | Pass from a fresh download and extracted sheet |
| `node docs/evidence/planting-suite/compare-core.mjs ...` | Pass, 3/3 unchanged measurement projections |
| `git diff --check` | Pass |

The first full MCP test run hit Windows sandbox restrictions: one loopback
connection and one temporary-directory symlink failed. The same suite passed
with those local test permissions. No source workaround was made to silence
the failures. Build chunk-size and pdf.js legacy-build notices remain upstream
warnings, not failures. No GitHub CI or release result is claimed here.

## Browser and export checks

The actual browser tested was the ChatGPT in-app browser, 1280 by 720, using
the local Vite development build at `http://127.0.0.1:5198`. It was not the
public hosted application. The suite registry's source hash and the separately
built bundle hash are recorded in [build.json](results/build.json).

On bundled `sample-finish-plan.pdf` / AF101, the condition Trade property
accepts **Landscape planting**, the status-bar Trade filter shows its one
assigned condition, and the other eight conditions are hidden without deletion.
Returning to **All trades** and restoring **Auto (Finishes)** restores the
original nine-condition view. These are existing controls with a new option;
no new panel or interaction flow is introduced.

The public-plan MCP JSON was reimported into a fresh MCP session and checked
exactly. Its marked PDF was rendered with Poppler and inspected, including the
three tree symbols, two source-callout leaders and schedule-reference notes.
The public-plan browser import was interrupted by the desktop update. The
replacement Computer Use runtime then stopped because it could not establish
the browser URL confidently. No alternate UI-control mechanism was attempted
after that stop. Browser import/reopen and a continuous browser recording remain
unverified; they are not represented by the MCP trace or the saved screenshots.

## Notes for the reviewer

- Tool points use full-sheet pixels at PDF render scale 2.0; persisted points
  use normalized coordinates. This rotated source page displays at 5184 by
  3456 image pixels. Source selection and scale are pinned in source.json.
- The planting text is not available as ordinary matching text in the MCP
  extraction; its 782 other text items do not imply readable plant rows.
  The schedule and callouts were read from rendered regions.
- Geometry is explicitly supplied after visual inspection, not detected by
  the suite. The suite orchestrates existing tools; it does not measure itself.
- Source-linked bed quantity measurements and an MCP condition-metadata
  setter remain separate work for #659. This branch must not close that issue.
- The existing CLA was posted by the contributor:
  https://github.com/Kentucky-ai/opentakeoff/issues/659#issuecomment-6985194643.
- No claim of maintainer scope agreement, assignment, approval or merge.

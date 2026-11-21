# Printed quantity validation

Tested on 2026-11-20, Node 24.22.3, local MCP 0.9.117. The public replay extends
fork baseline `99f83814d18852adb389182f179377f939e40164`, which starts from upstream
`8a31fb49d5a2c286c665017219073b0abe61695b`. It does not include either review PR.
The original observations remain in [BASELINE-RESULTS.md](BASELINE-RESULTS.md).

## Expected versus observed

| Check | Expected | Observed |
|---|---|---|
| Existing trees | GDI 1, TAM 2; exact records retained | Pass: IDs, geometry, quantities, conditions, review and calibration unchanged |
| West SET source | Printed `127 - SET` at C1 | One pending record, 127 EA, source text/reference/anchor retained |
| East SET source | Printed `58 - SET` at C2 | One pending record, 58 EA, source text/reference/anchor retained |
| Source arithmetic | 127 + 58 = 185 | 185 printed EA; 0 located SET EA; schedule comparison remains separate |
| Work entries | Three trees plus two source quantities | Five records; all pending; no invented plant locations |
| Identical retry | Same IDs; no duplicate or review change | Exact payload equality |
| Conflicting or invalid input | Atomic refusal | Quantity, location, text/reference conflicts; nonpositive/fractional EA; wrong unit; empty source ID; out-of-sheet anchor tested |
| Existing human decisions | Preserve on retry and import | Synthetic automated fixtures pass; no real human approval claimed |
| Review and undo | Source fields and quantity survive | Existing browser review command and inverse restore exact records in tests |
| Anchor editing | Quantity survives movement; malformed edits refuse | Metric recomputation and MCP edit/undo tests pass; copied anchors are refused in the canvas code, browser gesture unverified |
| Export/import | Preserve all records | Exact shapes, conditions, calibration, annotations and proposals |
| Project archive | Preserve takeoff and PDF bytes | Existing archive writer/parser round-trip exact |
| Report | Located/printed split plus source ledger | JSON, CSV and workbook code paths pass |
| Marked PDF | Source text readable, bases disclosed | Poppler cover and plan inspected; automatic point labels removed after an overlap was found |
| DXF / geometry contribution | Do not present anchors as installed geometry | DXF skips with reason; contribution excludes and counts source records |
| Actual browser import / Show on plan / reload | Review both public sources and save/reopen | Pass in the local in-app browser; both source locations checked before/after reload and exported-archive reopen |
| Browser export preservation | Keep baseline records and decisions | Complete takeoff equality except the opened-sheet tab list; all 5 pending; report JSON identical |
| Dark-theme report appearance | Readable report table | Limitation: body text has poor contrast; quantity basis and exported totals verified, visual readiness not claimed |

[Recorded results](reviewable/results.json) list the preserved and new IDs.
The [MCP transcript](reviewable/transcript.json) is an ordered tool trace, not a
browser recording. Inputs are visually checked source coordinates, not automatic
detector output. No timing, accuracy, full-plan completeness or approval claim.
The separate [browser evidence](browser/README.md) contains actual screenshots,
downloaded files and a reproducible [persistence check](browser/verify-exports.mjs).

## Checks

The full web gate, full MCP suite, protocol gate, generated references, links,
MCP build and distribution smoke checks are recorded in
[checks.json](reviewable/checks.json). This file records local results, not GitHub
CI or a released MCP package. Existing React-hook, bundle-size and pdf.js notices
are not new failures. Poppler reports missing fallback fonts; the selected source
text, callouts and cover were inspected visually rather than trusting that log.
The [browser follow-up checks](browser/checks.json) record the repeated web gate
(3,837 passed, 4 skipped), protocol gate (62 passed), references and links on the
unchanged application code used for the browser captures.

Reproduce with the commands in [README.md](README.md). For the checks:

```sh
npm run check --prefix web
npm run typecheck --prefix mcp
npm test --prefix mcp
npm run check --prefix protocol
npm run check:tool-count --prefix mcp
npm run check:wiki --prefix mcp
npm run check:protocol-resources --prefix mcp
node scripts/check-doc-links.mjs
npm run build --prefix mcp
npm run smoke:dist --prefix mcp
```

Two first-pass failures were corrected: the new tool description lacked the
shared coordinate-contract sentence, and the `llms.txt` discovery count was
stale after adding the tool. The complete gates were rerun after those fixes.
The new protocol conditional also needed explicit array/object types under AJV's
strict mode; the protocol tests pass after that correction.

## Reviewer notes

- Inputs are full-sheet image pixels at PDF scale 2.0, top-left origin and y down.
  Persisted anchors use normalized coordinates. The rotated L1.0 sheet displays
  at 5184 by 3456 pixels. Calibration remains agent-set and unconfirmed.
- The count extension does not alter the canvas schema identifier. Older readers
  may preserve its fields without understanding its source-anchor display.
- The earlier native Chrome attempt at `127.0.0.1:5199` was unverified. The later
  authorized in-app browser run at `127.0.0.1:5200` passed both public source
  tests on build `6b14613160b3927a690270275654092d9f4bd3a2`; the
  [browser evidence](browser/README.md) pins its loaded bundle and hashes.
- Public-plan browser stills are now captured. Changed-surface evidence on the
  bundled sample and a continuous actual-browser recording remain required
  before this is ready for review. The report contrast also needs follow-up.
- The contributor's existing CLA is linked in [the baseline](BASELINE-RESULTS.md).
  No maintainer agreement, approval, merge or release is claimed.

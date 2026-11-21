# Landscape planting: reviewable source quantities

Printed bed quantities now have review records with **Show on plan**, using the
existing count, review and undo machinery. Each record stores the printed text,
source reference and one source anchor. That anchor is not a plant location.
The report distinguishes individually located EA from printed EA.

**Latest fork increment:** both SET records also link to editable planting areas.
Show on plan frames each source and bed together; boundary edit/undo and exported
archive reopening preserve all five original records exactly. See the
[linked-area evidence](areas/README.md), including the provisional C2 north edge.

This work stays on the contributor's `codex/planting-suite` fork branch for
[#659](https://github.com/Kentucky-ai/opentakeoff/issues/659). No new PR is opened.
**Both public SET browser tests pass:** the local in-app browser locates each
source, preserves it after reload and reopening the exported archive, and keeps
all five records pending. See the [browser evidence](browser/README.md) for
screenshots, exact export comparisons and limitations. A continuous recording
and the new flow on the bundled sample remain outstanding.

## Clean baseline

| Version | Native capability in this example | Recorded result |
|---|---|---|
| Upstream `8a31fb49` | Core counts and annotations; no planting suite or printed-quantity tool | 3 located tree EA; printed SET quantities in notes |
| First suite increment `99f83814` | Planting method plus existing Trade options | Same 3 tree records; SET measured EA remains 0 |
| This increment | `record_callout_quantity`, source receipts, source anchors and quantity-basis disclosure | Same 3 tree records plus 2 printed records: 127 + 58 = 185 SET EA |

Upstream already reviews count measurements and supports imported count values
greater than one. This example does not establish that upstream cannot store
185 EA. The added capability is an explicit MCP operation and source semantics:
the printed text, source ID and anchor remain distinguishable from an individually
located item in the receipt, report and exports. Ordinary count review is reused.

The [original baseline](BASELINE.md), [original checks](BASELINE-RESULTS.md) and
[baseline editable file](results/takeoff.json) remain available. The new replay
imports that exact file. It does not rerun the tree takeoff or regenerate its IDs.
Only two generated annotation texts change to describe the newly recorded
quantities; their IDs, positions, leaders and other fields remain unchanged.

No CLG skill, company memory file, private plan, private catalog or company
script is used. A custom skill can inform future requirements, but it is not a
hidden dependency or evidence of native OpenTakeoff capability here. Prior
conversation context is not used as quantity or geometry evidence. General PDF
inspection and Computer Use skills are the only external skills used.

The source was read visually and coordinates were supplied explicitly to MCP.
This is a reproducible, source-assisted workflow test, not a blind AI benchmark,
OCR accuracy result, automatic symbol-detection claim or speed comparison.

## Public source and observed result

The [source manifest](source.json) pins the public CCFP Nature Center Addendum 1,
PDF page 58, sheet L1.0, revision 02.11.2026, **Bid Alternate 2**. It includes the
source URL, checksum, scale, schedule rows and exact input coordinates.
Only GDI, TAM and SET are sampled; this is not a complete landscape estimate.

| Code | Individually located EA | Printed EA | Schedule EA | Review records |
|---|---:|---:|---:|---:|
| GDI | 1 | 0 | 1 | 1 |
| TAM | 2 | 0 | 2 | 2 |
| SET | 0 | 127 + 58 = 185 | 185 | 2 |

All five records remain pending. The quantity is 188 EA across these codes;
there are five review records, not 188 individually located plants. The schedule
comparison is disclosed separately and does not change the observed quantities.

- [Editable result](reviewable/takeoff.json), [report with source ledger](reviewable/report.json)
- [Assertions and preserved IDs](reviewable/results.json), [ordered MCP trace](reviewable/transcript.json)
- [Marked-PDF cover](reviewable/marked-cover.png), [marked plan](reviewable/marked-plan.png)
- [West source in marked PDF](reviewable/pdf-west-detail.png), [east source](reviewable/pdf-east-detail.png)
- [West MCP overlay](reviewable/west-callout.png), [east MCP overlay](reviewable/east-callout.png)
- [Actual browser receipts, source navigation and persistence](browser/README.md)
- [Checks and remaining work](RESULTS.md)

The images in `reviewable/` are MCP renders and Poppler renders of the marked PDF;
the images in `browser/` are actual in-app browser screenshots. The older bundled-plan Trade screenshots in
[the baseline](BASELINE.md) verify only that earlier increment's Trade controls.
No real plan PDF or `.otk` containing one is committed to Git.

## Reproduce

Use the repository's Node 24 environment, then run from the repository root:

```sh
npm ci --prefix web
npm ci --prefix mcp
npm ci --prefix protocol
node docs/evidence/planting-suite/prepare-source.mjs tmp/planting-suite/source
node docs/evidence/planting-suite/review-callouts.mjs tmp/planting-suite/source/ccfp-L1.0.pdf tmp/planting-suite/reviewable
node docs/evidence/planting-suite/package-review.mjs tmp/planting-suite/source/ccfp-L1.0.pdf tmp/planting-suite/reviewable/takeoff.json tmp/planting-suite/public-planting-review.otk
```

The first command refuses a changed source checksum. The MCP replay reads
`takeoff://wiki`, loads the plan, imports the preserved baseline, opens the suite,
records and retries both callouts, updates the two generated notes, inspects
source overlays and exports the report, editable takeoff and marked PDF. A fresh
MCP reload must preserve all records exactly. The archive packer uses the existing
OpenTakeoff writer and checks exact takeoff and PDF-byte equality on unpacking;
it creates no geometry or quantities.

## Browser verification

The completed public-plan test used a local preview at `127.0.0.1:5200`.
The [browser evidence](browser/README.md) identifies the tested build and gives
the exact save/reopen steps. For a new development run, use
`npm run dev --prefix web -- --host 127.0.0.1 --port 5199 --strictPort`.
Use a genuinely empty workspace at that origin. An `.otk` load replaces the
workspace, so do not load it into a customer project. Another tab at the same
origin can share its saved workspace.

1. Open `http://127.0.0.1:5199/` and drag the generated
   `tmp/planting-suite/public-planting-review.otk` into the empty app.
2. Open **Work and review**, search `SET`, and confirm two entries: **127 EA** and
   **58 EA**, both **Needs review**. Inspect their **Printed callout** receipts.
3. Select each entry and click **Show on plan**. Confirm the open diamond points
   to the matching printed source, with sufficient surrounding context. Repeat
   after hiding the condition or filtering to another trade; locating it should
   reveal it. No extra record should be created.
4. Open **Report**. Confirm GDI 1, TAM 2, SET 185 EA, with SET shown as **0 EA
   located; 185 EA from printed callouts**. Check CSV/Excel source rows too.
5. Reload the browser and repeat the receipt and quantity checks. Export the
   takeoff and compare IDs, source fields and review states with the loaded file.
   Keep the delivered sample pending; test approval and undo only in a separate
   disposable copy, without presenting automation as human approval.
6. Repeat the new receipt/navigation surface on the bundled sample with clearly
   labeled synthetic source quantities. Capture each changed surface and a short
   recording before calling the contribution ready for maintainer review.

The recorded public run covers steps 1–5 except browser CSV/Excel downloads.
The exported `.otk` was also reopened and both source locations checked again.
Step 6, a continuous recording, and the dark-theme report contrast follow-up
remain outstanding. See the browser result for the precise tested scope.

## Design and limits

This uses an explicit source extension on the existing count record so review,
selection, persistence and undo have one owner. A separate quantity ledger would
need parallel selection/review transport. Multipliers or repeated fake points
would lose the source/instance distinction. The chosen approach keeps the source
point explicit, adds no automatic labels over printed text, and leaves existing
measurement records unchanged.

- `record_callout_quantity` supports positive whole **EA** only. It does not read
  the source or infer identities. The operator supplies visually verified values.
- Stable source IDs prevent identical MCP retries from duplicating work. This is
  not a general spatial or semantic duplicate detector; never record both a bed
  quantity and individual counts for the same plants.
- Normal annotations remain annotations. There is no automatic note migration.
- Copy and duplicate refuse source anchors: a new printed quantity needs its own
  source. Moving an anchor preserves its quantity. MCP refuses role changes and
  reassignment of a source record to a different condition.
- Existing clients can retain the extension but may display it as a generic count.
  Use this branch for the new review labels and report disclosure.
- The existing normal import merges condition tags without case sensitivity;
  use an empty workspace when validating case-distinct document codes.
- MCP still has no planting schedule reader or condition `spec`/`trade` setter.
  Schedule identity remains in source notes and proposal rationales.
- DXF omits source anchors with an explicit reason. Geometry contribution omits
  them with an excluded-record count, rather than treating them as plant symbols.
- Material volumes, pricing/catalog integration, production deployment and the
  rest of #659 remain outside this increment.

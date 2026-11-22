# Landscape planting suite: public-plan evidence

Historical evidence for fork commit `99f83814`. See [the current increment](README.md)
for reviewable printed quantities; the observations below describe the earlier build.
The original "quantity representation" gap below concerns a supported source-callout
workflow, not the ability to import a count value greater than one or review a count.

This branch adds **Landscape planting** to `open_suite` and the existing Trade
menus. It gives the agent a source-backed planting method using core tools.
On a public landscape sheet, the example commits three located trees and
separately records two bed callouts totaling 185 plants without inventing
185 locations or adding those quantities to measured EA.

First increment of [#659](https://github.com/Kentucky-ai/opentakeoff/issues/659),
kept on the contributor's fork. No PR is opened, and the full issue is not
complete. See [results and checks](BASELINE-RESULTS.md) for the evidence and remaining
browser verification.

## Scope

The agent receives a planting method through `open_suite`, using existing core
tools. The suite preserves exact plant codes, separates individually located
plants from printed bed quantities, and exposes current source-callout and
metadata limits. It adds no tool, geometry algorithm or persisted field.

The source is the public CCFP Nature Center Addendum 1, PDF page 58, sheet L1.0,
revision 02.11.2026. Planting is Bid Alternate 2. The selected example checks
GDI, TAM and SET only; it is not a complete landscape takeoff.

The [source manifest](source.json) links the public PDF and pins its SHA-256,
page, revision, scale and selected schedule rows. The source PDF is downloaded
locally and is not committed. This example was derived afresh from the source;
the replay coordinates are intentionally explicit so someone else can audit
them. It does not claim automatic schedule recognition or symbol detection.

## What an agent receives

`open_suite {}` includes the planting catalog entry. Both
`open_suite {suite: "planting"}` and `{division: "32"}` return its method and
one count preset, with `tools_enabled: []`. The default tool list stays at 70.
The method is in [the registry](../../../web/src/lib/tradeSuites.ts).

## Reproduce the public example

Use Node 24, as pinned in the repository. From the repository root:

```sh
npm ci --prefix web
npm ci --prefix mcp
npm ci --prefix protocol
node docs/evidence/planting-suite/prepare-source.mjs tmp/planting-suite/source
node docs/evidence/planting-suite/run-public.mjs tmp/planting-suite/source/ccfp-L1.0.pdf tmp/planting-suite/run
node docs/evidence/planting-suite/compare-core.mjs docs/evidence/planting-suite/results/before.takeoff.json tmp/planting-suite/run/takeoff.json tmp/planting-suite/run/comparison.json
```

The download refuses a changed source checksum. The replay starts a real MCP
server over stdio, reads `takeoff://wiki`, opens the suite, checks its nonmutating
behavior, reads and renders source evidence, commits counts with `place_count`,
writes annotations with `annotate`, exports and reloads the editable takeoff.
It asserts the expected totals and exact IDs/geometry/review on the reload.

Outputs include `takeoff.json`, `report.json`, `marked.pdf`, source and overlay
images, `results.json`, and an ordered tool [transcript](results/transcript.json).
The transcript is a reproducible tool trace, not a continuous screen recording.
The PDF is the standard marked export; it is not a newly designed export.

To inspect the saved example in OpenTakeoff:

1. Use a separate empty local workspace. Another tab at the same origin can
   share saved data; do not merge into a working customer project.
2. Open the downloaded `ccfp-L1.0.pdf`, keeping that filename for sheet matching.
3. Choose **Everything else → Import takeoff…** and select the generated
   `takeoff.json`, or [the saved editable result](results/takeoff.json).
4. Inspect the three tree measurements and the condition-linked SET notes.
   The measured total is 3 EA; the notes disclose 185 printed SET plants.
5. To group a condition, expand **More: trade, heights, line style, columns**,
   choose **Landscape planting** in **Trade**, then use the status-bar
   **Trade** filter. Review and scale confirmation remain the estimator's acts.

The MCP reload above is tested. The public-plan browser import in step 3 was
interrupted by a desktop update and remains unverified in this pass; it is not
claimed as completed browser evidence.

## Source and export exhibits

| Exhibit | What to check |
|---|---|
| [Tree schedule](screenshots/schedule-trees.png) | GDI 1 and TAM 2; names, size and bid-alternate heading |
| [SET schedule](screenshots/schedule-set.png) | Sedum ternatum, 1 Gal., 12-inch o.c., 185 |
| [West callout](screenshots/source-callout-west.png), [east callout](screenshots/source-callout-east.png) | 127 SET + 58 SET = 185; these are source quantities, not individual locations |
| [Measured tree overlay](screenshots/measured-trees.png) | Three count points centered on three printed tree symbols; their quantity callout is not counted again |
| [Printed scale](screenshots/scale.png) | 1 inch = 20 feet; agent-set and unconfirmed |
| [Rendered marked PDF](screenshots/marked-pdf.png) | Counts, original callouts and exported source notes remain visible |
| [Bundled-plan condition property](screenshots/bundled-condition-trade.jpg), [trade filter](screenshots/bundled-trade-filter.jpg) | The two existing controls expose Landscape planting. CPT-1 is temporarily reassigned only to exercise the controls; no plant measurement is claimed on the finish plan. The assignment was restored afterward. |

The browser captures are actual app screens, not mockups. The plan crops and
count overlay are actual `view_sheet` outputs. The marked-PDF image is a Poppler
render of the exported PDF. No source plan PDF or private project is committed.

## Independence

Work starts from upstream `8a31fb49d5a2c286c665017219073b0abe61695b`.
No custom landscape skill, private project, catalog, previous takeoff geometry,
previous quantity result or company memory file is used. The method is based
on issue #659, repository guidance and fresh inspection of the public drawing.
This is a source-assisted workflow example, not a blind detector benchmark.
General PDF inspection and computer-use skills were used; no company takeoff
skill or company memory was loaded. Existing conversation context was not used
as a quantity or geometry source.

## Design choice

The first choice is a method-only suite, following the repository's
[suite guide](../../wiki/adding-a-suite.md). It exposes the domain procedure
without duplicating measurement tools or changing the canvas layout.

A new planting derive tool would be appropriate only when the core cannot
represent the required quantity. The public example establishes that gap for
printed bed quantities. A third option, several plant-category suites, would
split one schedule workflow across several entries and still leave that gap.
This increment uses one suite, preserves document codes, and documents the
missing quantity representation instead of introducing an unreviewed schema.

## Deliberate limits

- Printed bed quantities are source notes, excluded from measured EA. They are
  not measurement-review entries. A future source-callout model remains needed.
- MCP has no dedicated planting schedule reader and no `spec`/`trade` setter.
  Schedule identity is retained in proposal rationales and linked notes.
- Opening a suite does not assign trades to conditions. The browser's existing
  Trade property supports explicit Landscape planting assignment.
- Sod, seed, paving, CY/ton calculations, catalog lookup and prices are outside
  this increment. Coordinate with [sitework #617](https://github.com/Kentucky-ai/opentakeoff/issues/617).
- Human approval, a production release and a complete bid are not claimed.

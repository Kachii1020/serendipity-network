# v3 UI completion evidence — 2026-08-31

## Closed defects

- Removed resting rotation from functional controls, stamps, summaries, and
  route cards; selection now uses the shared purple inset ring and vertical
  translation only.
- Replaced the responsive auto-fit interest layout with exact 6×1, 3×2, and
  2×3 grids.
- Replaced the independently positioned pseudo timeline with testable route
  line/node elements sharing the same 2-stop and 3-stop centres.
- Removed the generic sibling border that gave the full-width evidence row a
  protruding vertical line; card actions and separators are clipped to the card.
- Replaced the browser's blue programmatic focus outline with the product's
  purple result accent and changed-stop outline.
- Added a shared, truthful 700ms search presentation for manual and Site Tool
  searches. It shows validation, published-hours/menu matching, and route/
  walking composition without claiming live web or inventory search.
- Moved detailed estimate exclusions into disclosure and reduced the visual
  weight of saved-plan and tool-activity sections.

## Verification

- `pnpm check`: PASS — 67 files, 388 tests, 8/8 typechecks, 20/20 source-audit
  regressions.
- `pnpm build`: PASS — 8/8 workspace builds.
- `pnpm test:v3:browser`: PASS — 11/11, including fast/slow/no-result/error,
  manual/Site Tool provenance, reduced motion, 6/3/2 grids, 2/3-stop geometry,
  focus, containment, axe, 320/390, and 200%/400% reflow.
- `pnpm test:visual`: PASS — 18/18; v3 adds desktop/mobile landing, result, and
  progress baselines.
- `pnpm test:security`: PASS — public build scan plus 5/5 browser security
  regressions.
- `APP_BASE_URL=http://localhost:3100 pnpm test:v3:release`: PASS — 20/20,
  20 unique correlations, p50 7ms, p95 32ms, max 116ms.

## Compatibility and remaining gate

REST paths, v3 envelopes, area packs, engine ranking, storage schema, and the
exact five Site Tool names/inputs/outputs are unchanged. Google remains OFF.
Production v2 and prior preview deployment `dpl_9kcpSUzfEsAq9KD4f7gkR1cFGfCA`
remain rollback anchors.

Google-OFF preview `dpl_FiAgEWBxQhbymhFvRZu5z6vp21Ko` is READY in `hnd1` at
<https://serendipity-phase0-cg3ymnih0-circle-connect123.vercel.app/v3> from
application commit `5c8e263`. A signed-in browser observed the manual progress
panel, then the result in 1,237ms with no warning/error log. The deployed
2-stop route had exact line/node centres, contained actions, zero resting card
rotation, purple result focus, and zero horizontal overflow. T338 is closed;
production promotion remains explicitly out of scope for this slice.

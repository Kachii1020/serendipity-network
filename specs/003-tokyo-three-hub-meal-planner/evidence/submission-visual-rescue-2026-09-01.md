# Submission visual rescue evidence — 2026-09-01

## Trigger

Real desktop browser zoom exposed failures not covered by the prior root-font
reflow gate: hub labels sat low, a selected segment escaped its rounded parent,
summary chips formed a 3+1 orphan row, the area stamp moved above the title,
and the vertical route rail appeared detached from the cards.

## Design references

- `design/result-zoom-rescue.png`: generated standalone 800px result reference.
- `design/analysis-loading-rescue.png`: generated standalone analysis-state
  reference.

The implementation adopts their open hierarchy, 2×2 summary, ordered stacked
cards, four analysis stages, and role slots. It deliberately omits generated
icons, gradients, and inter-card dashed decoration.

## Implemented boundary

- Hub labels are centred; segmented fills are clipped by a shared 16px parent.
- Result summary is 4×1 or 2×2 only.
- Area stamp, route line, and route nodes are removed.
- Cards expose their own walk source and remain an ordered semantic list.
- Search presentation is 2100ms minimum with four truthful stages and dynamic
  activity/meal slots; failures remain immediate.
- REST, engine, data, storage, and exact-five Site Tool contracts are unchanged.

## Local verification

- `pnpm test:v3:browser`: 13/13 PASS across
  1600/1280/1067/800/768/600/390, success/slow/no-result/error, manual/Site
  Tool, reduced motion, focus, storage, accessibility, and reflow.
- v3 visual baselines: 9/9 PASS for desktop, 800px zoom proxy, and mobile
  landing/result/progress.
- `pnpm check`: 388/388 tests, 8/8 typechecks, 20/20 source-audit regressions.
- `pnpm build`: 8/8 workspace builds.
- `pnpm test:security`: public asset scan plus 5/5 browser security PASS.
- `APP_BASE_URL=http://localhost:3100 pnpm test:v3:release`: 20/20, p50 5ms,
  p95 9ms, max 170ms, 20 unique correlations.

## Preview verification

Google-OFF deployment `dpl_Ek3TjAYh1FCa4jsCywCUyB1sFo85` is READY in `hnd1` at
<https://serendipity-phase0-6ddhami6n-circle-connect123.vercel.app/v3> from
application commit `eef07ac`.

The protected 800px browser path displayed all four analysis stages and three
role slots, then returned the source-backed Shibuya result in 2,644ms including
navigation. Deployed geometry recorded hub centre error 0px, summary `[2,2]`,
stamp/rail/node count 0, three walk labels, document overflow 0, and browser
warning/error logs 0. T342 is closed.

## Production promotion

After user review, canonical-route commit `40ee0e2` and metadata commit
`7021c2f` were built into Google-OFF deployment
`dpl_97KgepTTGC78xp14v6cQw97NeAfi` in `hnd1`. Vercel reported it READY, and the
exact deployment was promoted to <https://serendipity-phase0-hub.vercel.app>.
The fixed alias resolved back to the same deployment after promotion.

- `/` renders the v3 three-hub input surface and submits to `/plan`.
- `/plan` renders the v3 planner and registers the exact five tools in the
  automated Chrome WebMCP environment.
- `/legacy/source-planner` preserves v2; `/legacy/network-demo` remains intact.
- Production read-only search: 20/20 across Shibuya 7, Shinjuku 7, Ikebukuro 6;
  p50 47ms, p95 77ms, max 288ms, 20 unique correlations.
- Production browser regression: 14/14 covering canonical/legacy routing,
  responsive geometry, 2100ms truthful progress, no-result/error behavior,
  manual/tool provenance, exact-five lifecycle, storage, accessibility, and
  200%/400% reflow.

No Provider, Supabase, booking mutation, or Google Places request was made.
Real supported-client Sol/Terra 3/3 remains unclaimed. The immediate rollback
anchor remains v2 deployment `dpl_CLfLvnMvXbSVtK1ciH4kc4DvnbS6`.

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

T342 remains open until the immutable Google-OFF preview is deployed and the
800px input/loading/result path is replayed.

# Tasks: Source-backed evening planner

## Dependencies

- T201 is the immutable baseline for every later task.
- T202 precedes T203–T207; public shapes cannot be inferred independently.
- T203 must produce a valid CANDIDATE pack before T204 can prove the exact path.
- T204 precedes controller/UI work in T205–T207.
- T208 requires T202–T207; T209 requires all T208 local gates.
- T210 begins only after the production reliability run in T209 passes.

## Gate 0 and shared foundation

- [x] **T201** Preserve and verify the v1 rollback baseline on
      `feat/v2-source-backed-planner`: commit
      `f786b68429967b2fee3fe2dc5de8bd37220153ac`, tag
      `v1-production-2026-08-29`, source archive SHA-256
      `42aaa7c1e87fdadb00f8a4f467149700f8fd2dcf99ed45c649aa01fe3a7d02fc`,
      and Hub/Kiln/Nori/Loop rollback deployment IDs — verifies FR-213 and
      V2-RBK-001/003.

- [x] **T202** [US1] Add failing v2 JSON Schema/type/semantic/envelope tests,
      then implement the parallel planner contracts in
      `packages/contracts/src/planner-v2.ts` and package exports without
      changing v1 constants or schemas — verifies FR-201, FR-204–FR-208,
      FR-214–FR-215 and V2-CTR-001–004/V2-PACK-002–012.

- [x] **T203** [US1] Build and audit
      `apps/hub/data/shibuya.places.v2.json` with at least nine authorized real
      places, three categories, field-level source references, FREE/EXACT/RANGE
      prices, evidenced coordinates, and official links; run
      `scripts/audit-v2-sources.mjs` and record permissions/attribution under this
      specification's evidence directory — verifies FR-204–FR-207, FR-212,
      SC-203, V2-PACK-001–012, and V2-FIX-001–003.

## Independently usable product slices

- [x] **T204** [US1] Add failing deterministic composition/swap tests and
      implement `composeEveningPlan` plus `swapEveningPlanStop` in the v2 export
      beside the untouched
      v1 composer in `packages/bundle-engine`; use conservative maxYen budget and
      the locked coordinate-walk formula — verifies FR-202–FR-203, FR-207–FR-209,
      V2-ENG-001–014, and V2-SWAP-001–005.

- [x] **T205** [US1] [US2] Implement `POST /api/v2/plans/search`,
      `POST /api/v2/plans/swap`, `GET /api/v2/places/{id}/evidence`, the shared v2
      action controller, and exactly five top-level Site Tools
      (`find_evening_plan`, `show_place_evidence`, `swap_plan_stop`, `save_plan`,
      `delete_saved_plan`) with stale-result and operation locking tests — verifies
      FR-211–FR-215 and V2-API-001–005/V2-TOOL-001–008.

- [x] **T206** [US1] Replace the primary landing/planner experience with one
      concise source-backed flow: visible input in the first viewport, one concrete
      result, reference total, walking/time basis, no-booking copy, and a compact
      non-blocking Site Tool status; preserve `/phase0` — verifies FR-201–FR-203,
      FR-206, FR-211, FR-213–FR-214 and V2-UX-001–006/010.

- [x] **T207** [US2] [US3] [US4] Add evidence disclosure, single-position swap,
      official outbound links, and validated local save/delete with immutable
      snapshots and quota/corruption recovery — verifies FR-204–FR-210,
      V2-SWAP-001–005, V2-STO-001–009, and V2-UX-007/009.

## Convergence and release

- [x] **T208** Run and repair the complete local gate: source audit, focused v2
      tests, `pnpm check`, 8/8 build, result-size/public-payload scan, v1 regression,
      320/mobile/200%/400% visual checks, keyboard flows, and axe across every v2
      state; save evidence under this specification — verifies SC-201–SC-203,
      SC-205–SC-206, V2-REG-001–002, and all required local matrix rows.

- [x] **T209** Deploy Hub preview only, replay the exact
      `find → evidence → swap → save → delete` path 3/3, run five cold synthetic
      goals, promote the audited pack to ACTIVE, then deploy Hub production and run
      20 read-only journeys with search p95 ≤3s and external mutations 0; stop and
      roll back on the first non-favicon failure — verifies SC-204,
      V2-DEP-001–004, and V2-RBK-002.

- [ ] **T210** Reconcile spec/plan/data-model/contracts/tasks against the shipped
      code and evidence; update README, public data attribution, Devpost copy,
      screenshots, and the <3-minute demo to show the actual Chrome Site Tool path,
      real-place evidence, explicit no-booking boundary, and rollback state — closes
      FR-201–FR-215 and SC-201–SC-206 without rewriting specification 001 history.

## Local implementation evidence — 2026-08-29

- T204–T207: `pnpm test:v2` passes 58/58; Hub and all workspace typechecks pass.
- T208: `pnpm check` passes 257/257 tests and `pnpm build` passes 8/8.
- New v2 browser flow passes landing, human evidence/save, exact five Site
  Tools, 320px/400% reflow, planned/no-result/error axe states.
- Preserved v1 gates pass at `/legacy/network-demo`: Phase 0 27/27,
  accessibility 9/9, visual 12/12, commercial/UI completeness 15/15.
- Runtime security passes 55 public assets and 5/5 browser cases.
- Local canonical read-only reliability passes 20/20 with p95 30ms and 20
  unique correlations.
- Direct visual inspection at 1440×900 and 390×844 found no console errors;
  mobile CTA is inside the first viewport and result focus lands on the sourced
  plan summary.

## Production implementation evidence — 2026-08-30

- T209: final deployment `dpl_4LBiYvg2NP1KEq4WLT1Pry1u4C2b` is READY in
  `hnd1` at the fixed production alias.
- Production V2 browser suite passes 6/6; the exact five-tool
  `find → evidence → swap → save → delete` path passes 3/3 fresh contexts.
- Production read-only reliability passes 20/20 with p95 876ms, max 1036ms,
  and 20 unique correlations.
- Production security passes 54 public assets plus 5/5 runtime/header cases;
  live source URLs all return 200–399.
- Lighthouse passes `/` at 97/100/100/100 and SSR `/plan` at
  98/100/100/100; planner LCP 2414ms, TBT 14ms, CLS 0.00078.
- Five synthetic visible-UI runs yield 4/5 goal completion; all discovered
  truth, recovery, source-copy, locale, and interest-persistence defects are
  covered by the final code and regression suite.
- Full evidence: `evidence/production-closure-2026-08-30.md`.

T210 packaging update: the public repository is live at
`https://github.com/Kachii1020/serendipity-network`, default `main`, with MIT
detected by GitHub's License API. The 72.95-second English narrated demo is
complete at `artifacts/submission/serendipity-v2-demo.mp4`; public YouTube
upload remains open only because the available browser could not complete
Google authentication. See `evidence/youtube-upload.md`.

## Stop-loss

- If the four-hour source spike cannot prove rights and reference prices for a
  place, remove that place; do not copy official-site facts under a disclaimer.
- If no nine-place ACTIVE pack and canonical three-stop route exist within one
  implementation day, keep production on v1 and ship only a preview for review.
- Do not add Supabase migrations, authentication, payment, live inventory,
  runtime scraping, maps SDKs, multiple regions, party size, or new Provider
  services to unblock these tasks.
- Freeze features 48 hours before submission. Remaining work after freeze is
  reliability, clarity, evidence, rollback, and submission packaging only.

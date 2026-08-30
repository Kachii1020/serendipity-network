# Tasks: Tokyo three-hub meal planner

## Status and dependency rules

This checklist was reconciled against the repository on 2026-08-30. The
contract, reviewed three-area pack, pure composer, local APIs, optional
Google-off boundary, storage, consumer UI, and automated exact-five Site Tool
surface exist. T323–T324 and every convergence/production task remain open;
the early preview is not the final release candidate and production still runs
v2. See `evidence/rc-status-2026-08-30.md` for the claim boundary.

- T301 is the documentation baseline for all later work.
- T302 is a four-hour source stop-loss and precedes all ACTIVE data tasks.
- T303 precedes T304; public contracts are test-first.
- T304 unlocks synthetic engine, gateway, API, storage, and Site Tool work.
- T305–T307 may run in parallel after T302/T304 because they own separate area
  data/evidence files; T308 integrates them through shared audit/generation.
- T309 requires all three audited packs. T310/T311 can proceed against synthetic
  fixtures while data work runs, but production fixtures require T309.
- T312/T313 can use mock registered IDs after T304; production Google-on work
  additionally requires T309 and approved key/billing/policy configuration.
- T314–T323 require the contract and engine/controller prerequisites named in
  each task. T324 may proceed after T313.
- T325–T328 close one immutable local candidate. T329–T334 must use that exact
  commit/deployment; results from older candidates do not count.

## Documentation and design baseline

- [x] **T301** Preserve specifications 001/002 unchanged and create the v3
      decision-complete `spec.md`, `plan.md`, `data-model.md`,
      `contracts/planner-v3.md`, `test-matrix.md`, `tasks.md`, requirements
      checklist, and generated landing/result design references under
      `specs/003-tokyo-three-hub-meal-planner/` — establishes US1–US7,
      FR-301–FR-330, and SC-301–SC-312; no implementation evidence claimed.

## Source-rights gate and contracts

- [x] **T302** [US1] Run the bounded source spike and record candidate rights in
      `specs/003-tokyo-three-hub-meal-planner/evidence/source-pack-1.0.0-ledger.md`: verify
      official identity/address/coordinate/hours/public-access/menu/price pages,
      three restaurant Google place IDs, and at least four activities for each
      hub; reject copied descriptions/media and all Tabelog use — gate for
      FR-309–FR-313 via V3-DATA-001–005/V3-SRC-001.

- [x] **T303** [P] [US1] Add failing v3 contract/schema/semantic/public-safety
      tests in `packages/contracts/src/planner-v3.test.ts` and export-shape tests
      for exact intents, packs, reviewed ledgers, plans, evidence, Google
      signals, saved snapshots, envelopes, strict dates, sizes, and poison cases
      — covers FR-301–FR-317 and FR-324–FR-327 via V3-CTR/V3-DATA/V3-GGL-010.

- [x] **T304** [US1] Implement parallel v3 types, JSON Schemas, semantic
      validators, exact endpoint/tool output validators, and public-safety
      exports in `packages/contracts/src/planner-v3.ts`,
      `packages/contracts/src/planner-v3-shared.ts`, and
      `packages/contracts/package.json`; leave v1/v2 constants/exports untouched
      — pass T303 and `pnpm --filter @serendipity/contracts typecheck`.

## Three reviewed area packs

- [x] **T305** [P] [US1] Build Shibuya v3 CANDIDATE data and reviewed evidence
      under `apps/hub/data/planner-v3/` with the existing eligible activities,
      at least three official-menu restaurants, station, calendars, supported
      presets, and canonical meal/activity fixtures — verifies FR-304,
      FR-309–FR-312 and V3-DATA-001/004–011.

- [x] **T306** [P] [US1] Build the independently reviewed Shinjuku CANDIDATE
      pack/ledger/evidence under `apps/hub/data/planner-v3/` with at least four
      activities, three official-menu restaurants, two activity categories,
      station, calendars, presets, and fixtures — verifies FR-304,
      FR-309–FR-312 and V3-DATA-002/004–011.

- [x] **T307** [P] [US1] Build the independently reviewed Ikebukuro CANDIDATE
      pack/ledger/evidence under `apps/hub/data/planner-v3/` with the same
      minimums and no Tabelog/Google content beyond place IDs — verifies
      FR-304, FR-309–FR-313 and V3-DATA-003–011/V3-SRC-001.

- [x] **T308** [US1] Add shared reviewed-ledger generation, static source/rights,
      strict-date, menu-price, Google-ID, Tabelog-exclusion, live-link, and
      drift audits in `scripts/regenerate-v3-reviewed-claims.mjs`,
      `scripts/audit-v3-sources.mjs`, and root package scripts; generate ledgers
      only after human source review — pass V3-DATA-004–011 and V3-SRC-001–003.

- [x] **T309** [US1] Implement `apps/hub/data/planner-v3/index.ts`, validate
      registry-key/pack/review/fixture equality, execute every canonical and
      supported-preset fixture, then promote all three exact packs to ACTIVE;
      keep any incomplete hub CANDIDATE and block public v3 promotion — verifies
      FR-304, FR-310–FR-312 and V3-FIX-001–012.

## Pure composer, pricing, and replacement

- [x] **T310** [P] [US1] [US2] [US3] [US5] Add failing synthetic v3 engine and
      benchmark tests in `packages/bundle-engine/src/planner-v3.test.ts` for
      route grammars, constraints, preset matching, per-person/group arithmetic,
      deterministic ranking/IDs, Google-independent score, same-kind swap, and
      30-place p95 — covers FR-303, FR-305–FR-309, FR-318–FR-319 via
      V3-ENG/V3-PRICE/V3-SWAP.

- [x] **T311** [US1] [US2] [US3] [US5] Implement the pure v3 composer,
      coordinate travel, canonical IDs, candidate ranking, and swap in
      `packages/bundle-engine/src/planner-v3.ts` plus its package subpath export;
      require an injected area pack/review/asOf and no network — pass T310 and
      preserve the v2 p95 threshold.

## Optional Google boundary

- [x] **T312** [P] [US4] Add failing gateway tests in
      `apps/hub/lib/planner-v3/google-places.test.ts` for disabled config, fixed
      host/field mask, allowlisted IDs, <=3 deduplicated calls, two-second abort,
      no retry, closure semantics, malformed/non-JPY/poisoned-attribution
      responses, and log/cache/storage absence — covers FR-314–FR-317 via
      V3-GGL-001–013/V3-SEC-001–003.

- [x] **T313** [US4] Implement the injected server-only gateway in
      `apps/hub/lib/planner-v3/google-places.ts`, normalize and discard upstream
      bodies, add safe enrichment summaries/warnings, and ensure official-source
      planning succeeds when disabled/degraded — pass T312; do not configure
      Vercel or enable production yet.

## REST runtime, client state, and storage

- [x] **T314** [P] [US1] [US4] [US5] Add failing handler/route tests under
      `apps/hub/lib/planner-v3/` and `apps/hub/app/api/v3/` for search, swap,
      area evidence with strict stop-time query pairs, exact
      status/headers/sizes, ACTIVE/freshness checks,
      top-three meal enrichment, known-closed filtering, cancellation, and safe
      degradation — covers FR-301–FR-319 and FR-327–FR-328 via V3-API.

- [x] **T315** [US1] [US4] [US5] Implement the v3 runtime/handlers and
      `POST /api/v3/plans/search`, `POST /api/v3/plans/swap`,
      `GET /api/v3/areas/[area]/places/[placeId]/evidence`; validate exact
      outputs after every engine/gateway boundary and set `no-store` — pass T314.

- [x] **T316** [P] [US6] Add failing v3 storage tests under
      `apps/hub/tests/components/` for save/reload/idempotency, ten/256KiB
      limits, partial/unreadable corruption, v2 coexistence, exact
      cross-references, and structural rejection of all Google fields except
      reviewed place IDs — covers FR-315 and FR-324 via V3-STO-001–006.

- [x] **T317** [US6] Implement the independent v3 serializer and saved-plan
      drawer operations in `apps/hub/components/planner-v3/planner-storage.ts`;
      render official snapshots immediately and refresh transient Google context
      without persistence — pass T316.

- [x] **T318** [P] [US1] [US4] [US5] [US6] Add failing reducer/controller/query
      tests under `apps/hub/tests/components/` for form/URL parity, stable-plan
      search recovery, same-kind swap, dialogs, operation epochs, aborted/late
      Google/evidence responses, shared lock, focus, and word-count selectors —
      covers FR-302–FR-304 and FR-319–FR-328 via V3-UX/V3-RACE.

- [x] **T319** [US1] [US4] [US5] [US6] Implement the v3 client state machine,
      allowlisted query codec, shared five-action controller, dialog/evidence
      inline state, and cancellation guards in `apps/hub/components/planner-v3/`
      — pass T318 before visual component integration.

## Consumer UI and exactly five Site Tools

- [x] **T320** [US1] [US2] [US3] [US4] [US5] [US6] Implement the parallel
      `/v3` landing and `/v3/plan` full-width result using new v3 components and
      `apps/hub/app/planner-v3.css`: three hubs, 1–3 adults, date/time,
      per-person presets, manifest-backed moods, meal toggle, collapsed adjust,
      35/45-word progressive disclosure, sticker/ticket hierarchy, one change
      dialog, one save CTA, and safe official links — covers FR-302–FR-304 and
      FR-320–FR-323 via V3-UX/V3-VIS.

- [x] **T321** [P] [US7] Add failing exact-five Site Tool tests in
      `apps/hub/lib/tools/planner-v3-tools.test.ts` for v3 inputs/outputs,
      annotations, shared callbacks, all-or-none registration, Strict Mode,
      inventory `5 -> 0 -> 5`, custom-intent projection, races, and storage
      mutations — covers FR-325–FR-328 via V3-TOOL-001–006.

- [x] **T322** [US7] Implement v3 definitions/registration in
      `apps/hub/lib/tools/planner-v3-tools.ts` and connect them only to T319's
      controller; preserve exactly the approved names and add no official-link
      tool — pass T321 and manual/tool parity tests.

- [ ] **T323** [US4] Add public `/privacy` and `/terms` pages plus adjacent
      Google Maps attribution styling/assets where transient content appears;
      cite current Google terms/privacy, do not modify/logo-wrap attribution,
      and keep feature flag off until policy/key/quota review passes — verifies
      FR-315–FR-317 via V3-GGL-012–013. Pages and flag-off copy exist; final
      attribution asset/policy review remains open before Google can be enabled.

## Convergence, preview, and production

- [ ] **T324** [P] Add v3 browser journeys under `tests/e2e/` for all three
      areas, 1/3-party arithmetic, meal on/off, every visible preset, no-result,
      change dialog, evidence/Google separation, save/delete/reload, manual/tool
      parity, races, and first-mobile-viewport acceptance — covers
      V3-FIX/V3-UX/V3-TOOL/V3-RACE/V3-STO. A focused landing/manual/tool/mobile
      suite exists; the complete area/preset/no-result/race matrix and final
      reflow closure are still pending.

- [ ] **T325** [P] Extend accessibility and visual suites for every v3 state at
      320/390/768/1440, landscape, 200%, 400%, keyboard, reduced motion, forced
      colours, internal overflow, exact focus, 70% result width, word caps, and
      the three generated design baselines — covers SC-307–SC-308 via
      V3-A11Y/V3-VIS.

- [ ] **T326** [P] Extend security/source/release tests for fixed Google origin,
      restricted key absence, no cache/log/storage leakage, request/output
      limits, HTTPS links, Tabelog zero-use, live source/menu links, public copy,
      and unchanged Provider/Supabase surfaces — covers FR-313–FR-317,
      FR-327–FR-330 via V3-SRC/V3-SEC/V3-COPY.

- [ ] **T327** Run the exact local release-candidate gate: v3 contract/data/
      engine/gateway/API/tool/storage/browser/a11y/visual/security/source suites,
      `pnpm check`, all 8 builds, v1/v2 regressions, Google-off canonical matrix,
      isolated composer benchmark, and repo secret scan; record exact commit and
      results under this spec's `evidence/` — closes SC-302–SC-311 locally.

- [ ] **T328** Deploy the exact T327 commit to an immutable Hub preview with
      Google flag off, run each hub's human journey, 3/3 exact-five supported
      client journey, 20 read-only searches, Lighthouse, live links, and
      Product Reality Check; stop if score <85 or any dimension <70 — verifies
      SC-301 and SC-307–SC-312 via V3-DEP-001–005.

- [ ] **T329** Configure a billing-enabled Places API (New) project only after
      approval: restrict key to Places API and server egress as supported, set
      quota/budget alert, add `GOOGLE_PLACES_API_KEY` and
      `GOOGLE_PLACES_ENABLED` to Hub preview only, verify public Terms/Privacy
      and attribution, then rerun V3-GGL/V3-SEC/preview smoke. If unavailable,
      leave flag off and do not block T330 — covers FR-314–FR-317.

- [ ] **T330** Rehearse rollback to
      `dpl_CLfLvnMvXbSVtK1ciH4kc4DvnbS6`, restore the exact v3 preview candidate,
      and record route/API/tool checks without touching Provider or Supabase —
      verifies FR-330 and V3-RBK-001–002.

- [ ] **T331** Promote routes in the verified Hub candidate: move v2 consumer
      routes to `/legacy/source-planner`, retain `/legacy/network-demo`, point
      `/` and `/plan` to v3, rerun local route/tool inventory, build one immutable
      deployment, and promote that same deployment alias only after all gates
      stay green — verifies FR-325–FR-330.

- [ ] **T332** Run production 3/3 human/Site Tool smoke, 20/20 search reliability
      with p95 <=3s, Google-on and flag-off fallback (when configured), source/
      menu link audit, Lighthouse, public payload/storage scan, and 15-minute log
      observation; roll back on first non-favicon failure — closes SC-309–SC-312.

- [ ] **T333** Reconcile shipped behavior with all 003 artifacts and record
      deployment ID, pack versions, Google mode, exact commands/results,
      remaining limitations, and rollback state under `evidence/`; do not rewrite
      001/002 history or mark blocked Google-on evidence as passed.

- [ ] **T334** Update README, DATA-LICENSE, Devpost copy, screenshots, and the
      <3-minute demo to show three hubs, party/group price, official menu basis,
      full-width sticker result, exact five-tool multi-action journey, Google
      attribution or explicit flag-off fallback, no-live-availability boundary,
      and saved-plan sanitization — final submission packaging only after T332.

## Six-day critical path

| Day | Required exit                                                               |
| --- | --------------------------------------------------------------------------- |
| D-6 | T302–T305, T303/T304, and Shibuya walking skeleton from T310/T311/T315/T320 |
| D-5 | T306–T311 and all three audited ACTIVE packs                                |
| D-4 | T312–T323 complete; Google may remain flag-off                              |
| D-3 | T324–T327 exact local candidate frozen                                      |
| D-2 | T328–T331 preview, policy decision, rollback, route promotion               |
| D-1 | T332–T334 production evidence and submission media                          |
| D-0 | Smoke and submission only; no feature additions                             |

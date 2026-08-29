# Tasks: Serendipity Network

**Spec**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Test matrix**: [test-matrix.md](./test-matrix.md)  
**Status**: Core MVP plus commercial release foundation implemented — 90/96
required tasks complete; T082/T085, T089/T090, T102, and T106 remain required and open;
T093/T096 remain open as optional supporting research;
`direct`/`json-string` is the historical Chrome diagnostic decision, while
production uses five top-level Hub tools

## Dependency summary

- T001–T006 create the workspace foundation.
- T007 drafted the product UI contract; T008 locked the user-approved Sticker Network direction and remains the prerequisite for every product UI implementation task.
- T010–T019 are the blocking Phase 0 slice. T019 selects one composition mode.
- T020–T028 build shared deterministic foundations after T019.
- T030–T038 build the database/API foundation after contract schemas exist.
- T040–T047 deliver the Provider slice.
- T050–T063 deliver the Hub discover/select, reservation, recovery, and demo-reset slices.
- T070–T079 deliver product UI, WebMCP proof, accessibility, security, observability, and visual baselines.
- T080–T086 are deployment and submission gates.
- Direct-mode coordination tasks T065–T067 are active because T019 selected `direct`.
- T087–T090 implement score-lift lanes W1–W4: five top-level Hub Site Tools and
  truthful proof while preserving the Chrome iframe diagnostic.
- T091–T092 implement lanes E1–E2: safe production reset/repeatability and Tokyo
  compute plus bounded Provider failures.
- T093–T097 are impact follow-ons. T094/T095/T097 are the required implementation
  and automated-evidence path; T093/T096 are optional supporting research. All
  keep Shibuya as the only launch network and future areas behind data-pack gates.
- T098–T101 are the user-authorized UI-completeness follow-up. T098 freezes the
  contract, T099 implements it, T100 supplies focused local acceptance, and T101
  alone closes deployment plus production confirm/release reliability.

`[P]` means the task may run in parallel with adjacent tasks only when its listed prerequisites are complete and it does not share a target file.

## Setup and governance

- [x] **T001** Create the pnpm/Turborepo workspace in `/Users/ichika/webhackathon/package.json`, `/Users/ichika/webhackathon/pnpm-workspace.yaml`, and `/Users/ichika/webhackathon/turbo.json` — prerequisite for all code tasks; verify workspace package discovery.
- [x] **T002** Add strict shared TypeScript configuration in `/Users/ichika/webhackathon/tsconfig.json` and package configs — supports FR-005; verify `pnpm typecheck` has no implicit-any/unchecked-index exceptions without justification.
- [x] **T003** Add lint/format/test scripts and CI-safe environment validation in root config files — verify clean checkout commands are deterministic.
- [x] **T004** Add `/Users/ichika/webhackathon/.env.example` with names, scopes, and safe descriptions only — covers FR-023–025; verify no real secret values.
- [x] **T005** Add architecture decision record template and Phase 0 evidence directory under `/Users/ichika/webhackathon/specs/001-serendipity-network/evidence/` — supports SC-001 and T019.
- [x] **T006** Add canonical test provider/origin configuration in `/Users/ichika/webhackathon/packages/provider-config/` — covers FR-001, FR-021, FR-023; verify exact-origin parsing and no wildcard support.
- [x] **T007** Draft the product UI architecture, responsive state contract, accessibility rules, and visual verification matrix in `/Users/ichika/webhackathon/specs/001-serendipity-network/ui-plan.md` — covers FR-002, FR-008–009, FR-014–021, FR-026, FR-029; no product UI code is authorized by this task.
- [x] **T008** Review and lock `/Users/ichika/webhackathon/specs/001-serendipity-network/ui-plan.md` and root `/Users/ichika/webhackathon/DESIGN.md` with the user, including the selected Sticker Network direction, experience/proof hierarchy, and representative desktop/mobile wireframes — approved 2026-08-27; prerequisite satisfied for T028, T046–T047, and T070–T079, while T019 remains independently blocking.

## Phase 0 — blocking WebMCP slice

- [x] **T010** [US7] Add failing adapter contract tests for feature detection, exact-origin selection, normalized errors, cancellation, and lifecycle cleanup in `/Users/ichika/webhackathon/packages/webmcp/src/*.test.ts` — covers FR-002, FR-004, FR-022–023, FR-030 via P0-001/002/012–016.
- [x] **T011** [US7] Implement draft TypeScript declarations and compatibility adapter in `/Users/ichika/webhackathon/packages/webmcp/src/` — pass T010 without business logic.
- [x] **T012** [P] [US7] Create the two-Provider in-memory spike UI and diagnostic tools in `/Users/ichika/webhackathon/apps/provider/` — covers FR-021; verify P0-003/008/009.
- [x] **T013** [US7] Create the Phase 0 Hub with cross-origin discovery and a nested diagnostic Hub tool in `/Users/ichika/webhackathon/apps/hub/` — depends on T011/T012; verify P0-005/007/010/011.
- [x] **T014** [P] Add Playwright/Chrome launch configuration and deterministic Phase 0 fixtures in `/Users/ichika/webhackathon/tests/phase0/` and `/Users/ichika/webhackathon/playwright.config.ts` — covers automated portions of P0-001–016.
- [x] **T015** Add exact Hub/Provider OAC, permissions-policy, and CSP headers in both Next.js configs — covers FR-023; verify P0-004/006/015 and SEC-001–003 locally.
- [x] **T016** Deploy Hub plus two Providers to fixed HTTPS staging origins and record environment values in the evidence template — depends on T012–T015; verify DEP-001 for the spike.
- [x] **T017** Run P0-001–017 three times in Chrome and store sanitized results under the evidence directory — fixed-HTTPS evidence passed 15/15 on all three runs.
- [x] **T018** Run P0-018/019 three times in the ChatGPT desktop built-in browser with Codex and record visible tool inventory/routing — covers SC-001 and AE-011. Execution completed on localhost and fixed HTTPS; `document.modelContext` was unavailable in all six observations, so the gate did not pass.
- [x] **T019** Record `WEBMCP_COMPOSITION_MODE=nested|direct` and pinned execution encoding in `/Users/ichika/webhackathon/specs/001-serendipity-network/evidence/phase0-decision.md`; update research/plan if behavior differs — `direct` selected after `gpt-5.6-sol` fixed-HTTPS checks remained unavailable 3/3; Chrome diagnostic encoding pinned to `json-string`.

Phase 0 execution note (2026-08-27): Chrome 151 local and fixed-HTTPS evidence passed all 15 automated specs 3/3 with `json-string` as the only accepted execution encoding. The fixed Vercel Hub/Kiln/Nori origins are active. A bounded Codex recheck verified `gpt-5.6-sol` but exposed no Site Tools runtime in 3/3 fixed-HTTPS loads, activating the documented `direct` fallback. See `evidence/phase0-decision.md`.

## Shared contracts and deterministic foundations

- [x] **T020** [P] Add failing JSON Schema/envelope tests in `/Users/ichika/webhackathon/packages/contracts/src/` — CT-001–015 now pass and cover FR-003, FR-005, and FR-024.
- [x] **T021** [US1] Implement versioned intent, Slot, bundle, Provider operation, Hub operation, result, and error schemas in `/Users/ichika/webhackathon/packages/contracts/src/schemas/` — TypeScript types derive from the schemas and the exported Ajv registry compiles every operation boundary.
- [x] **T022** [P] Add canonical and fault fixtures in `/Users/ichika/webhackathon/packages/test-fixtures/src/` — includes three slots per Provider, the complete fixture travel pairs, and seven named deterministic faults.
- [x] **T023** [US1] Add failing example/property tests for feasibility, scoring, tie-breaks, reason codes, and three-item invariants in `/Users/ichika/webhackathon/packages/bundle-engine/src/*.test.ts` — BE-001–017 pass, including 1,000 generated sets and 20 repeated runs.
- [x] **T024** [US1] Implement the pure exhaustive bundle engine in `/Users/ichika/webhackathon/packages/bundle-engine/src/` — deterministic SHA-256 IDs, documented score, tie-breaks, hard constraints, and top-three limit pass SC-002/003 coverage.
- [x] **T025** [US1] Add score/fixture snapshot documentation generated from the engine result in `/Users/ichika/webhackathon/packages/test-fixtures/README.md` — canonical totals, components, and reasons are reviewable.
- [x] **T026** [US1] Add failing reducer/state-machine tests in `/Users/ichika/webhackathon/apps/hub/lib/store/hub-machine.test.ts` — ST-001–008 pass for canonical, invalid, recovery, reconciliation, release, and reset paths.
- [x] **T027** [US1] Implement the explicit Hub reducer and Zustand bindings in `/Users/ichika/webhackathon/apps/hub/lib/store/` — reducer remains pure and the store contains no network calls.
- [x] **T028** [P] Add root-`DESIGN.md` semantic tokens and accessible primitives in `/Users/ichika/webhackathon/packages/ui/` — literal contrast tests, 52/60px controls, 3px focus treatment, reduced motion, and identity-only Provider accents pass.

## Database and server foundation

- [x] **T030** Add initial schema/enums/tables/constraints/RLS migration in `/Users/ichika/webhackathon/supabase/migrations/001_initial_schema.sql` — schema lint passes and direct `anon`/`authenticated` mutations are denied by grants plus forced RLS.
- [x] **T031** Add failing pgTAP tests for capacity, idempotency, expiry, release, confirm, token ownership, reset, audit persistence, and seeded random transitions in `/Users/ichika/webhackathon/supabase/tests/` — 68 assertions pass across DB-001–021.
- [x] **T032** Implement `create_slot_hold`, `get_hold_status`, `confirm_slot_hold`, `release_slot_hold`, and `expire_due_holds` in `/Users/ichika/webhackathon/supabase/migrations/002_hold_functions.sql` — DB-001–017 and the DB-020 invariant sequence pass.
- [x] **T033** Implement operator-scoped idempotent demo reset and demo slot cancellation in `/Users/ichika/webhackathon/supabase/migrations/003_demo_reset.sql` — DB-018/021 pass.
- [x] **T034** Add canonical seed inventory/travel matrix in `/Users/ichika/webhackathon/supabase/seed.sql` — nine slots, complete fixture travel pairs, and canonical total capacity 17 restore on reset.
- [x] **T035** Add the 20-concurrent-attempt integration harness in `/Users/ichika/webhackathon/supabase/tests/concurrency/` — one capacity-one hold wins and concurrent release/expiry restore capacity exactly once.
- [x] **T036** [P] Implement server-only Supabase clients, scoped token signing/verification, hashing, and redaction helpers in `/Users/ichika/webhackathon/apps/provider/lib/server/` — Provider-owned deterministic hold-token format and wrong-Provider/expiry rejection pass unit tests.
- [x] **T037** [P] Implement Hub server inter-service credentials, AES-256-GCM active hold-token encryption/clearing, browser-session binding, and bundle-session persistence helpers in `/Users/ichika/webhackathon/apps/hub/lib/server/` — server-only boundaries, contextual decryption failure, encrypted-at-rest handoff, and owned reload pass unit tests and production builds.
- [x] **T038** Add sanitized audit writer/projection and tests in `/Users/ichika/webhackathon/apps/provider/lib/server/audit.ts`, `/Users/ichika/webhackathon/apps/hub/lib/server/audit.ts`, and shared tests — explicit safe-fact allowlist plus DB-019 persistence pass; secret-shaped fields are dropped before storage.

## Provider application slice

- [x] **T040** [US1] Add failing Provider Route Handler tests for search, auth, validation, hold replay, status, confirm, release, and errors in `/Users/ichika/webhackathon/apps/provider/tests/api/` — PA-001–008 and PA-013 pass with an injectable database boundary and explicit no-DB-before-auth assertions.
- [x] **T041** [US1] Implement Provider `/api/slots` and `/api/holds` Route Handlers in `/Users/ichika/webhackathon/apps/provider/app/api/` — PA-001–006 pass with bounded bodies, repeated schema/auth validation, normalized envelopes, and idempotent hold creation.
- [x] **T042** [US4] Implement Provider hold lookup under `/Users/ichika/webhackathon/apps/provider/app/api/holds/status/` plus status/confirm/release Route Handlers under `/Users/ichika/webhackathon/apps/provider/app/api/holds/[reference]/` — PA-006–008 pass; URLs contain only the safe client-request reference and mutations require the raw token in the private `x-serendipity-hold-token` header.
- [x] **T043** [US5] Implement operator-protected, demo-only cancellation endpoint in `/Users/ichika/webhackathon/apps/provider/app/api/demo/cancel-slot/route.ts` — DB-021/PA-013/SEC-008 pass; non-demo and unauthorized calls receive a normalized 404 without mutation. Full demo reset remains T063.
- [x] **T044** [US7] Add failing Provider iframe registration/state component tests in `/Users/ichika/webhackathon/apps/provider/tests/components/` — PA-009–011 pass for lifecycle-derived copy, inert untrusted content, and zero registrations after a Strict Mode-style dispose/remount.
- [x] **T045** [US7] Implement Provider tool registrations in `/Users/ichika/webhackathon/apps/provider/lib/tools/` using shared schemas and the adapter — exactly five search/hold/status/confirm/release tools register with the specified annotations; hold tokens remain in origin-scoped session storage, recover through a private response header, and clear on terminal state. Historical Phase 0 tools remain isolated behind `?phase0=1`.
- [x] **T046** [US7] Implement Sticker Network standalone `/` and compact `/embed` Provider UI in `/Users/ichika/webhackathon/apps/provider/app/` and components — PA-009 and the Provider portions of UI-017/023 pass at 1440×900, 390×844, 720×520, and 360×320 with no horizontal overflow; full Hub proof composition remains T072/T079.
- [x] **T047** [P] Add all three Provider identity configurations and CSS-first sticker assets in `/Users/ichika/webhackathon/packages/provider-config/src/` — Kiln/Nori/Loop production builds contain only the selected name/category/identity token while sharing the same semantic status and tool behavior.

## Hub discovery and selection slice

- [x] **T050** [US1] Add failing Provider gateway parity tests in `/Users/ichika/webhackathon/apps/hub/lib/provider-gateways/*.test.ts` — HO-001–003/017 now cover canonical equivalence, malformed data, exact-origin mismatch, duplicate tools, and Provider timeout/offline behavior.
- [x] **T051** [US1] Implement `WebMcpProviderGateway` for the T019-selected transport in `/Users/ichika/webhackathon/apps/hub/lib/provider-gateways/webmcp.ts` — every operation verifies exact origin/name and rediscovers before execution, so stale iframe authorities are never reused.
- [x] **T052** [US6] Implement server-only `HttpProviderGateway` and manual search route in `/Users/ichika/webhackathon/apps/hub/lib/provider-gateways/http.ts` and `/Users/ichika/webhackathon/apps/hub/app/api/manual/search/route.ts` — three-origin parity and unsupported configuration tests pass; Hub HMAC requests are verified at the Provider boundary.
- [x] **T053** [US1] Add failing discover/compose orchestration tests in `/Users/ichika/webhackathon/apps/hub/lib/orchestrator/discover.test.ts` — canonical, malformed, offline, no-result, and invalid-intent cases pass without partial bundles.
- [x] **T054** [US1] Implement discover/compose/ephemeral-candidate orchestration in `/Users/ichika/webhackathon/apps/hub/lib/orchestrator/discover.ts` — HO-001–003 pass using only the shared bundle engine; candidates remain page-local until the first hold, as required by the read-only contract.
- [x] **T055** [US1] Implement registration definitions for `find_serendipity_options` and `show_bundle` in `/Users/ichika/webhackathon/apps/hub/lib/tools/` — all inputs/outputs and stale versions validate; definitions remain unmounted while the selected production mode is `direct`.
- [x] **T056** [US2] Implement candidate selection, deterministic reasons, timeline/map view model in `/Users/ichika/webhackathon/apps/hub/lib/` — BE-018/HO-004/005 pass with stale selection leaving current state unchanged.

## Hub reservation and recovery slice

- [x] **T057** [US3] Add failing hold/compensation/unknown-result tests in `/Users/ichika/webhackathon/apps/hub/lib/orchestrator/hold.test.ts` — HO-006–010 and persistence-failure compensation pass in the five-case suite.
- [x] **T058** [US3] Implement parallel hold, status lookup, safe-reference persistence Route Handler, compensation, earliest expiry, and replacement selection in `/Users/ichika/webhackathon/apps/hub/lib/orchestrator/hold.ts` and `/Users/ichika/webhackathon/apps/hub/app/api/bundle-sessions/[sessionId]/hold/route.ts` — unknown creates reconcile by stable request reference; every known success is compensated on failure; replacement candidates remain unheld.
- [x] **T059** [US4] Add failing confirm/reconciliation/release tests in `/Users/ichika/webhackathon/apps/hub/lib/orchestrator/confirmation.test.ts` — HO-011–014 pass in the six-case suite, including lost-response recovery, mixed-state fail-closed behavior, expiry, and confirmed-release refusal.
- [x] **T060** [US3/US4] Implement confirm/reconcile/release orchestration and register `hold_bundle`, `confirm_bundle`, `release_bundle` in `/Users/ichika/webhackathon/apps/hub/lib/` — validated public envelopes contain no Provider tokens; two registration-boundary tests pass.
- [x] **T061** [US6] Implement manual hold/confirm/release Hub routes with server-side token encryption plus the exact-origin presentation-only `postMessage` bridge in `/Users/ichika/webhackathon/apps/hub/app/api/manual/` and Provider embed code — the in-process manual workflow verifies cookie ownership, encrypted persistence, reload, and confirmation; two strict bridge-validation tests reject unbound or sensitive messages.
- [x] **T062** [US3/US4] Implement persisted bundle-session reload/reconciliation in `/Users/ichika/webhackathon/apps/hub/lib/orchestrator/rehydrate.ts` and `/Users/ichika/webhackathon/apps/hub/app/api/bundle-sessions/[sessionId]/route.ts` — three reconciliation tests verify authoritative held/confirmed/terminal outcomes and mixed-state failure; manual mode rehydrates through server HTTP gateways.
- [x] **T063** [US5] Implement the operator-protected, demo-only Hub reset endpoint in `/Users/ichika/webhackathon/apps/hub/app/api/demo/reset/route.ts` — authorized reset invokes the T033 RPC; disabled, missing-secret, and wrong-secret requests share the same normalized 404 response.

Reservation/recovery verification note (2026-08-27): the repository Vitest suite passes 135/135, all eight workspace typechecks pass, scoped ESLint is clean, and both Hub and Provider Next.js production builds expose the expected workflow routes. Active manual hold tokens are encrypted before persistence and cleared before a bundle session is marked terminal.

## Conditional direct-mode slice

- [x] **T065** [conditional-direct] Add fallback coordination schemas/tests in `/Users/ichika/webhackathon/packages/contracts/src/schemas/fallback.ts` and Hub tests — derived public types cover composition, hold, release, confirmation, and reconciliation; three contract cases reject private fields and invalid cardinality.
- [x] **T066** [conditional-direct] Implement `hub_compose_provider_results` and hold preparation/result-recording tools in `/Users/ichika/webhackathon/apps/hub/lib/tools/direct/` — exact Provider/origin sets, stable safe request references, earliest expiry, recovery instructions, and non-auto-held replacements pass direct tool integration tests; public inputs/results contain no token or idempotency key.
- [x] **T067** [conditional-direct] Implement release/confirmation preparation/result-recording tools and direct-mode E2E/evals — seven coordination tools cover explicit user release, compensation completeness, unknown-confirm status reconciliation, and fail-closed receipts; an in-process E2E executes all three real Provider tool definitions explicitly through a confirmed receipt.

Direct coordination verification note (2026-08-27): the repository Vitest suite passes 144/144, all eight workspace typechecks pass, scoped ESLint is clean, and both Hub and Provider production builds pass. Provider WebMCP mutation tools now accept only safe public references and derive stable idempotency keys inside the owning iframe before same-origin HTTP calls.

## Product UI, accessibility, and observability

All tasks in this section depend on the approved T008 UI gate and the independently selected T019 composition mode. Components must consume validated view models rather than inventing Provider progress.

- [x] **T070** [US1/US2/US7] Add failing Hub component tests for idle/discovering/composed/no-results states and event-derived Provider sticker progress in `/Users/ichika/webhackathon/apps/hub/tests/components/` — six product-state tests cover UI-001–003, UI-021–022/024, FR-031, FR-032, and FR-034.
- [x] **T071** [US1/US2] Implement `MoodPrompt`, `ConstraintSummary`, `JourneySummary`, `StopBandList`, alternatives, totals, reason copy, and `JourneyAction` in `/Users/ichika/webhackathon/apps/hub/components/` — the approved Sticker Network hierarchy and one-primary-action contract render from the Hub reducer.
- [x] **T072** [US7] Implement `LiveProviderStrip`, Provider stickers, and `WebMcpProof` containing the real configured `/embed` iframes, exact-origin labels, `RouteProof`, and text-equivalent route — three frames remain mounted while collapsed and switch from `tabIndex=-1` to `0` only when proof opens.
- [x] **T073** [US3/US4/US5/US7] Add failing UI tests for held/countdown/confirm/receipt/recovery states, including no premature Provider success and visible compensation transitions — component coverage asserts authoritative Held/Confirmed copy, Released compensation, and an explicitly unheld replacement.
- [x] **T074** [US3/US4/US5] Implement reservation actions, earliest-expiry countdown, receipt, recovery notice, and authoritative per-Provider stamps in Hub components — expiry blocks confirmation, receipts receive focus, and release requires explicit confirmation.
- [x] **T075** [US6] Implement unsupported-browser notice and manual preference/action UI with explicit `Manual connection` Provider labels — the manual HTTP workflow shares the reducer and presentation bridge without claiming WebMCP connectivity.
- [x] **T076** [US7] Implement collapsible sanitized `ToolActivity` projection within `WebMcpProof` in `/Users/ichika/webhackathon/apps/hub/components/product/tool-activity.tsx` — only names, outcomes, providers, timestamps, safe correlations, and normalized error codes render.

Product UI verification note (2026-08-28): the repository Vitest suite passes 150/150, all eight workspace typechecks pass, scoped ESLint is clean, and the Hub production build passes. Local browser checks at 1440×900, 1024×768, and 390×844 show no horizontal overflow; the 1440 first viewport contains the invitation, single CTA, all three Provider stickers, and the proof trigger. These local captures are preliminary T079 evidence, not the final fixed-origin visual baseline.

- [x] **T077** [P] Add keyboard, axe, live-region, reduced-motion, 200% zoom, and responsive Playwright cases in `/Users/ichika/webhackathon/tests/e2e/accessibility.spec.ts` — eight Chrome cases pass UI-009–013/019 and SC-009 with zero serious/critical axe findings.
- [x] **T078** [P] Add static/runtime secret scanners and header assertions in `/Users/ichika/webhackathon/tests/security/` — 50 public build assets plus rendered Hub/frame/storage/URL surfaces pass, and exact Hub/Provider OAC, permissions policy, and CSP assertions pass three runtime cases.
- [x] **T079** Add deterministic Sticker Network visual baselines at 1440×900, 1024×768, and 390×844 plus the observer-facing WebMCP proof rehearsal — seven fixed-clock visual cases pass without snapshot updates; desktop composed state keeps CTA and proof entry in the first viewport, while one action reveals three exact-origin frames.

UI gate verification note (2026-08-28): 8/8 accessibility/responsive cases, 3/3 runtime security cases, the 50-file public asset scan, and 7/7 deterministic visual/rehearsal cases pass. A Strict Mode abort race discovered by the visual gate was fixed so an obsolete first-mount registration cannot force a healthy second WebMCP mount into manual mode. The baselines now visibly show `3 sites ready via WebMCP`, three separately named `Live site` Providers, authoritative operation labels, the main action, and one-action proof.

## Full-system verification and delivery

- [x] **T080** Configure four Vercel projects and fixed Hub/Kiln/Nori/Loop origins with environment-specific exact allowlists — covers DEP-001/002; do not add wildcard previews.
- [x] **T081** Run complete CT/BE/DB/PA/HO/ST/UI/SEC/DEP suites on fixed staging and record commands/results in evidence — Gates B/C; local lifecycle covers confirm/recovery/release, fixed production passes 20 sequential reset/search/hold/confirm receipts with Provider `HELD → CONFIRMED` proof, p95 bounds, 201 unique correlations, mandatory final reset, and a 20/20 post-reset read-only baseline.
- [ ] **T082** After T090, run AE-001–012 three times against the five top-level
      production Hub tools; preserve the historical selected composition mode only
      for Chrome diagnostics and refine metadata only within product intent — Gate D.
- [x] **T083** Run failure rehearsal using `FAULT-NORI-DISAPPEARS` and prove zero orphan holds or explicit incomplete compensation — SC-005.
- [x] **T084** Run final secret/log/screenshot scan and manually inspect browser bundles — SC-007.
- [ ] **T085** After T089–T091, rehearse and record the canonical under-three-minute
      top-level Site Tools workflow and under-ten-second proof-legibility check on
      production origins — SC-008/011.
- [x] **T086** Reconcile `spec.md`, `plan.md`, `contracts`, `data-model.md`, `test-matrix.md`, and task completion against actual behavior; append any gaps instead of marking them complete — final convergence gate.

Delivery update (2026-08-28): T081's dedicated production database and
read-only search portion now pass. Supabase migrations 001–005 plus seed are
active, protected reset passed twice with nine restored current-Tokyo slots at
capacity 20, all four deployments run in `hnd1`, and missing Provider
configuration is covered by a normalized `INTERNAL_ERROR` regression test.
T081's mutation-bearing fixed-origin reliability and final-invariant evidence
now pass.

Reliability update (2026-08-28): the PA-012 local slice passes 20 confirmations
plus 20 recovery/releases with all per-operation p95 bounds satisfied, and the
HO-016 deterministic browser test now asserts complete chronological safe
activity projection. Two independent 20-run production read-only measurements
also pass. A freshly authorized production execution completed 20/20 receipts,
all three Provider `HELD → CONFIRMED` transitions in every run, p95 bounds, 201
unique correlations, a mandatory final reset restoring nine slots, and a final
20/20 read-only baseline. `evidence/production-mutation-reliability.md` records
the pass; the earlier bounded rescue history remains in the attempt ledger.

Readiness audit update (2026-08-28): one authorized production
`search → hold → confirm` completed in approximately 76 seconds, satisfying the
manual three-minute portion of T085. The proof disclosure opened in
approximately 0.8 seconds, but T085 remains open because the browser used manual
fallback. The Provider frames now delegate `allow="tools"` for Chrome
diagnostics and exactly five product tools register at the top-level Hub, but
the available production client exposed no Site Tools API on three reloads.
Local submission packaging and historical first-time-human-validation gaps are
recorded in `evidence/hackathon-readiness-audit.md`. The required count is 83/87;
the four required open tasks and two optional research tasks are listed in the
document header.

## Score-lift tranche — approved, not yet complete

Official
[OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp) states
that ChatGPT does not discover tools registered inside same- or cross-origin
iframes. T019 is retained as historical Chrome evidence; the production judge
surface below is a new top-level Hub path. None of these tasks is complete merely
because its plan or contract text now exists.

- [x] **T087** [SL-W1] Reconcile the production/diagnostic architecture across `/Users/ichika/webhackathon/specs/001-serendipity-network/research.md`, `plan.md`, `contracts/webmcp-tools.md`, `test-matrix.md`, `tasks.md`, `score-lift-plan.md`, and the historical Phase 0 decision evidence — pass STL-001 with no claim that ChatGPT discovers iframe tools.
- [x] **T088** [SL-W2] Add failing controller/registry tests, then implement one shared product action controller and exactly five top-level Hub registrations in `/Users/ichika/webhackathon/apps/hub/lib/tools/product-tools.ts` and `/Users/ichika/webhackathon/apps/hub/components/product/hub-client.tsx` — pass STL-002–005; two read/three write tools, no legacy registry entries, strict cleanup, no duplicate business logic or secret-bearing public data.
- [ ] **T089** [SL-W3] Add `allow="tools"` for the Chrome diagnostic and make source provenance truthful in `/Users/ichika/webhackathon/apps/hub/components/product/webmcp-proof.tsx`, `tool-activity.tsx`, shared product types, and presentation bridges — pass STL-006–007 and SEC-013; label `Site tool` versus `Manual fallback` without implying an iframe tool ran.

T089 implementation note (2026-08-28): STL-006–007 and the automatable
schema/search-result/DOM/storage/public-asset subset of SEC-013 pass. The task
stays open because a real ChatGPT discover → hold → confirm run and its
`Available`/`Recently used` secret inspection have not run.

- [ ] **T090** [SL-W4] Add the deterministic top-level tool suite under `/Users/ichika/webhackathon/apps/hub/lib/tools/`, `/Users/ichika/webhackathon/tests/phase0/product-site-tools.spec.ts`, E2E visual/security suites, then run the real Sol/Terra ladder — pass STL-002–009 and record 3/3 evidence before claiming WebMCP 20+.
- [x] **T091** [SL-E1] Add `/Users/ichika/webhackathon/scripts/demo-reset-production.mjs`, root command wiring, and the capacity/rolling-date-compatible reset baseline — pass EX-001–002 twice with explicit production opt-in, nine restored slots, sufficient documented judge capacity, zero orphan holds, and no secret persistence.
- [x] **T092** [SL-E2] Configure all four Vercel functions for `hnd1` and add a five-second Provider transport deadline in `/Users/ichika/webhackathon/vercel.hub.json`, `vercel.provider.json`, and `apps/hub/lib/provider-gateways/http.ts` with regression tests — pass EX-003–004 while keeping caller cancellation distinct from internal timeout.
- [ ] **T093** [OPTIONAL-RESEARCH] [SL-I1] Recruit five urban spontaneous-evening consumers and two independent venue operators, run the baseline/problem interviews, and record anonymized evidence under `/Users/ichika/webhackathon/specs/001-serendipity-network/evidence/` — optionally strengthen IMP-001 with real observations; this task does not block T095 implementation, release, or internal score reporting, and Shibuya sessions cannot prove wider availability.

T093 launch update (2026-08-28): bilingual recruitment copy, eligibility
screeners, scheduling/session checklists, aggregate trackers, privacy/stop rules,
and the exact production-reset approval prerequisite are ready in
`evidence/t093-study-launch.md`. Status is `RECRUITING`; human counts remain
consumer 0/5 and Provider 0/2. The completed `SYN-*` preflight is non-human and
does not enter either denominator. Per the user-approved 2026-08-29 override,
recruitment may continue independently but is no longer on the required path.

- [x] **T094** [SL-I2] Add a fixed-input rolling service-date migration and tests in `/Users/ichika/webhackathon/supabase/migrations/004_rolling_demo_service_date.sql`, `supabase/tests/003_demo_controls.test.sql`, and the Hub reset route — pass IMP-002 with deterministic test dates and truthful current Tokyo “tonight” production slots.
- [x] **T095** [SL-I3] Implement the user-authorized bounded UX slice in `/Users/ichika/webhackathon/apps/hub/components/product/mood-prompt.tsx`, `hub-client.tsx`, `product-view.tsx`, `provider-strip.tsx`, `journey.tsx`, and shared product types, with verification in `/Users/ichika/webhackathon/apps/hub/tests/components/product-ui.test.ts`, `/Users/ichika/webhackathon/apps/hub/tests/components/plan-constraints.test.ts`, `/Users/ichika/webhackathon/tests/phase0/product-site-tools.spec.ts`, `/Users/ichika/webhackathon/tests/e2e/accessibility.spec.ts`, and `/Users/ichika/webhackathon/tests/e2e/visual.spec.ts` — IMP-003 and UI-028–032 pass locally and on fixed production: exact presets/defaults and nine-case matrix, shared Intent endpoint, one action, fixed Shibuya/solo/by-22:30 scope, truthful Provider/API provenance, no Connecting+Ready conflict, pre-Hold demo limits, stable detailed Route labels, 9/9 accessibility, 8/8 visual, and post-deploy 20/20 reliability; region, party size, and real Provider onboarding remain version 2.

T095 closeout (2026-08-29): blocking-only review additionally closed concurrent
search/stale-session races and rejects non-22:30 v1 Site Tool intent before any
request. Local gates pass 178/178 Vitest, 24/24 Chrome, 9/9 accessibility, 8/8
visual, and 50-assets+4/4 security. Non-human goal-only/comprehension gates pass
5/5 and 4/5. The final four production deployments pass the exact preset matrix
9/9, sequential receipt and Provider-state reliability 20/20, mandatory reset,
and post-reset read-only health 20/20.

- [ ] **T096** [OPTIONAL-RESEARCH] [SL-I4] After T095, optionally run five fresh unaided end-to-end consumer sessions and record anonymized metrics for IMP-004 (receipt completion, time, SEQ, comprehension, and baseline reduction) — supporting research only; absence of participants does not block implementation, release, or internal Potential Impact score reporting.
- [x] **T097** [SL-I5] Define and validate a versioned area data-pack schema and fixture-driven semantic/promotion tests in `/Users/ichika/webhackathon/packages/contracts/src/schemas/area-pack.ts` and `area-pack.test.ts` — pass IMP-005–007; keep every non-Shibuya pack dark until exact-origin supply, complete travel data, feasibility, reset/reliability, and production E2E gates all pass.

## UI-completeness follow-up — approved, production closure pending

T098–T101 preserve the completed T095 scope and the existing public Site Tool,
REST, database, origin, and Shibuya/solo contracts. They are strictly ordered:
T099 depends on T098, T100 depends on T099, and T101 depends on T100.

- [x] **T098** [US10] Reconcile `/Users/ichika/webhackathon/specs/001-serendipity-network/spec.md`, `plan.md`, `ui-plan.md`, `test-matrix.md`, and `tasks.md` with FR-041–044, SC-014–017, and UI-033–038 — lock deterministic transition focus, release/reconciliation safety, the 90-second compensation guard, and narrow warning/proof containment without rewriting T095 history.
- [x] **T099** [US3/US4/US5/US10] Implement `releasing` and compensation-guard reducer state, shared UI/Site Tool operation locks, deterministic state-target focus/scroll, safe release retry/status projection, session-only deadline persistence, narrow warning wrapping, and responsive Provider embeds in `/Users/ichika/webhackathon/apps/hub/lib/store/hub-machine.ts`, `/Users/ichika/webhackathon/apps/hub/components/product/`, `/Users/ichika/webhackathon/apps/hub/app/globals.css`, and `/Users/ichika/webhackathon/apps/provider/app/globals.css` — satisfy FR-041–044 without changing public wire contracts.
- [x] **T100** [US10] Add and run focused reducer/component/browser regressions in `/Users/ichika/webhackathon/apps/hub/lib/store/hub-machine.test.ts`, `/Users/ichika/webhackathon/apps/hub/tests/components/product-ui.test.ts`, `/Users/ichika/webhackathon/tests/e2e/ui-completeness-flow.spec.ts`, `/Users/ichika/webhackathon/tests/e2e/ui-completeness-layout.spec.ts`, and `/Users/ichika/webhackathon/tests/phase0/product-site-tools-workflow.spec.ts` — pass 28/28 focused reducer/component/contract and 13/13 browser cases for ST-009–014 and UI-033–038, with no test-side `scrollTo(0, 0)` masking.
- [x] **T101** [US10] Run full check/build/accessibility/visual/security gates, deploy Hub/Kiln/Nori/Loop to their fixed `hnd1` origins, and record production closure under `/Users/ichika/webhackathon/specs/001-serendipity-network/evidence/` — READY/HTTP 200/hnd1, preset 9/9, fixed-production UI 8/8, accessibility 9/9, visual 10/10, security 4/4, 20 sequential reset→plan→hold→confirm receipts, 20 sequential reset→plan→hold→release terminal Provider states with zero confirm requests, all p95 bounds, stop-on-error plus 12-second stabilization, mandatory final nine-slot reset, post-reset read-only search 20/20, and non-human goal/comprehension 4/5 all pass.

## Commercial release and final Site Tools tranche — approved, in progress

These tasks preserve the five public Site Tool names, Hub/Provider REST paths,
database schema, and Shibuya/solo scope. The judged tool surface moves from `/`
to `/plan`; final real-client evidence therefore runs only after T105.

- [ ] **T102** [US12] Add an isolated fixed-origin evaluation Hub/Provider environment, separate demo database/reset secret, and a server-only exact-origin fault gateway for Nori hold loss, inert Provider-output poisoning, and Loop confirm-response loss — cover AE-007/009/012 without exposing a public fault selector or changing production contracts.
- [x] **T103** [US11] Extend the approved Sticker Network design contract into a commercial Sticker Editorial system, preserve the six-candidate preview, bundle production fonts, and add original optimized hero/Provider illustration assets with source lineage — UI-039/040 pass with original WebP assets and local WOFF2 fonts.
- [x] **T104** [US11] Implement a static consumer landing page at `/` with one `/plan` CTA, product preview, three-step journey, Provider network, safety/demo scope, WebMCP explanation, launch metadata, and no Site Tool/Provider/DB activity — FR-045–047 and UI-039–043 pass locally and on production.
- [x] **T105** [US11/US12] Move the complete Hub workflow to request-dynamic `/plan`, register exactly five top-level tools there only, add allowlisted intent deep links, consumer-first connection copy, complete receipt recap, accessible confirmation/navigation safety, lazy proof frames, and internal-only `/phase0` discoverability — FR-048–051 and UI-044–048 automated portions pass; `/plan → / → /plan` is exactly `5 → 0 → 5`.
- [ ] **T106** [US11/US12] Run commercial UI, route lifecycle, accessibility, visual, security, performance, build, fixed-production confirm/release/read-only reliability, and final eligible Sol/Terra AE/STL/SEC evidence; update the direct Devpost/README URL to `/plan`, sanitize artifacts, and reconcile the required count to 96/96 only when every gate passes.

T102/T106 execution note (2026-08-29): the exact-origin server-only fault gateway,
five focused tests, design, production deployment, 192 unit/integration tests,
27/27 Chrome, 9/9 accessibility, 12/12 visual, 7/7 commercial production,
53-assets+4/4 security, Lighthouse, Confirm 20/20, Release 20/20, and final
read-only 20/20 pass. T102 remains open because the Supabase organization has
reached its two-active-free-project limit and no existing project was repurposed.
T106 remains open because the available final in-app browser exposed no
`document.modelContext` in 3/3 reloads, so real Sol/Terra AE/STL/Recently used
evidence cannot be claimed.

## Task-to-requirement coverage

| Task slice | Requirements                                                                     |
| ---------- | -------------------------------------------------------------------------------- |
| T001–T006  | FR-001, FR-005, FR-021, FR-023–025                                               |
| T010–T019  | FR-001–002, FR-004–005, FR-021–023, FR-030                                       |
| T020–T025  | FR-003, FR-005–008, FR-024                                                       |
| T026–T028  | FR-008–009, FR-013–020, FR-026, FR-031, FR-034                                   |
| T030–T038  | FR-011–018, FR-024–025, FR-028–029                                               |
| T040–T047  | FR-005, FR-010–012, FR-016–018, FR-021, FR-024–026, FR-028, FR-030, FR-033–035   |
| T050–T056  | FR-002–010, FR-021–023, FR-027, FR-030                                           |
| T057–T063  | FR-011–020, FR-024–025, FR-027–030                                               |
| T065–T067  | FR-005, FR-013, FR-016, FR-022, FR-024                                           |
| T070–T079  | FR-002, FR-008–009, FR-014–021, FR-024, FR-026–035                               |
| T080–T086  | FR-001–035 and SC-001–011 convergence evidence                                   |
| T087–T090  | SL-W1–W4; STL-001–009 top-level production Site Tools                            |
| T091–T092  | SL-E1–E2; EX-001–004 repeatability, region, and bounded failure                  |
| T093/T096  | Optional SL-I1/SL-I4; IMP-001/004 supporting human research                      |
| T094–T095  | Required SL-I2/I3; FR-036–040, SC-012–013, IMP-002/003, and UI-028–032           |
| T097       | Required SL-I5; IMP-005–007 dark-gated area-pack expansion                       |
| T098–T100  | Required US10; FR-041–044, SC-014–017, ST-009–014, and UI-033–038                |
| T101       | Required fixed-production UI-completeness deployment and reliability closure     |
| T102–T106  | Required US11/US12; FR-045–052, SC-018–024, UI-039–048, and final Gate D/E proof |

# Implementation Plan: Serendipity Network

**Spec**: [spec.md](./spec.md)  
**Research**: [research.md](./research.md)  
**Status**: Core MVP and score-lift foundation deployed — 87/91 required tasks
complete, with T093/T096 retained as optional research; the historical `direct`
diagnostic decision is preserved, exactly five top-level Site Tools are
implemented, T095/T101 production acceptance passes, and only real Sol/Terra
evidence remains pending

## Summary

Build a pnpm/Turborepo monorepo containing one Next.js Hub and one configurable
Next.js Provider app deployed to three origins. Phase 0 first tested nested and
direct cross-origin composition in Chrome and truthfully selected `direct` for
that diagnostic surface. The official
[OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp) now makes
the production-client boundary explicit: ChatGPT does not discover iframe tools.
The score-lift tranche therefore registers exactly five product tools in the
top-level Hub document and reuses the existing Hub server workflow instead of
rewriting the historical Phase 0 decision.

The full MVP uses a pure deterministic bundle engine, JSON Schema/Ajv contracts, Provider-owned Route Handlers, transaction-backed Supabase functions, Zustand UI state, real cross-origin Provider iframes, and a manual HTTP gateway that shares the same contracts.

The target problem is general to **urban spontaneous evening planners**, but the
only supported launch network is Shibuya. The UI and tool schema stay honest about
that boundary. Additional areas are future versioned data packs that must carry
real Provider supply, travel data, feasibility fixtures, and production evidence;
they are not implied by the general audience description.

The user-authorized T095 slice adds bounded start-time and budget presets plus
copy/selection clarity fixes. It does not add region, party-size, or real-Provider
controls, and its exit evidence is automated and synthetic rather than dependent
on recruiting human participants.

The user-authorized T098–T101 follow-up closes seven observed UI-completeness
gaps without redesigning the experience: deterministic transition focus at
320px/200%, reset and alternative focus, an atomic release lock with safe
retry/status reconciliation, a session-persisted 90-second compensation guard,
and proof/warning reflow inside their actual narrow containers.

## Technical context

- **Runtime**: Node.js current LTS supported by Next.js 16 and Vercel.
- **Workspace**: pnpm workspaces with Turborepo.
- **Frontend**: Next.js 16, React, TypeScript, and owned CSS.
- **UI primitives**: Owned semantic React components and native disclosure/button behavior.
- **Client state**: Zustand with an explicit reducer/state machine; no TanStack Query in MVP.
- **Animation**: Bounded CSS transitions for Provider state changes with mandatory reduced-motion variants.
- **Validation**: authored JSON Schemas compiled by Ajv; TypeScript types derived from the same schema definitions.
- **Backend**: Next.js Route Handlers and server-only service modules.
- **Database**: Supabase Postgres migrations, SQL functions, and pgTAP tests.
- **Tests**: Vitest, Testing Library, Playwright, pgTAP/Supabase CLI, axe-based accessibility checks, and bounded manual Site Tools evals.
- **Deployment**: four Vercel projects and one Supabase project.
- **Observability**: structured sanitized audit events and Vercel logs; no reasoning traces.

## Existing-system findings

- `/Users/ichika/webhackathon` contains the complete pnpm/Turborepo workspace,
  local README and credential-free CI, but is not yet a Git repository and has
  no owner-selected license.
- Hub, configurable Provider, WebMCP adapter, exact-origin configuration, Chrome test harness, and sanitized evidence records implement T001–T015.
- Chrome 151 local runs pass nested read and mutation composition. Its shipped `executeTool` accepts JSON-string input and the Provider callback may omit the documented second options argument.
- The fixed Vercel Hub/Kiln/Nori/Loop origins are active and return the expected exact-origin OAC, permissions-policy, and CSP headers.
- Chrome 151 passed the fixed-HTTPS 15-spec harness three consecutive times after the harness was corrected to wait for Provider iframe registration.
- A bounded fixed-HTTPS recheck verified the active model as `gpt-5.6-sol` and still found no `document.modelContext` in three consecutive Codex in-app browser loads. Per the Phase 0 rule, T019 selected `direct` with `json-string` retained as the Chrome diagnostic encoding.
- OpenAI's current Site Tools documentation explicitly excludes iframe-registered
  tools from ChatGPT discovery and recommends JavaScript registration on the
  top-level page. The production judge path must therefore be the Hub's five
  top-level tools; the Chrome cross-origin harness remains diagnostic evidence.
- Versioned JSON Schemas now generate the shared TypeScript types and Ajv validators; the canonical fixtures, exhaustive bundle engine, explicit Hub reducer/Zustand binding, and Sticker Network token/primitives package implement T020–T028.
- The deterministic foundations, database functions, Provider HTTP API, five
  Provider WebMCP diagnostic tools, and responsive standalone/embed Provider UI
  implement T020–T047. Coverage includes auth-before-database behavior,
  normalized fail-closed envelopes, private hold-token storage/recovery/clearing,
  Strict Mode-safe tool disposal, semantic Provider state projection, 73 pgTAP
  assertions, and live local Next-to-Supabase and browser UI checks.
- Exact-origin WebMCP and HMAC-authenticated server HTTP gateways, fail-closed discovery/composition, read-only candidate sessions, nested discovery tool definitions, and deterministic selection/timeline/map projections implement T050–T056. Both gateways produce identical canonical candidate ordering; the nested definitions are intentionally not mounted while `WEBMCP_COMPOSITION_MODE=direct`.
- Parallel hold/compensation, unknown-result lookup, confirm/release reconciliation, encrypted manual-mode persistence, owner-bound reload, presentation-only iframe synchronization, and the protected demo reset implement T057–T063.
- Derived fallback schemas and seven direct-provider coordination tools implement T065–T067. The direct E2E invokes the real three Provider tool definitions through compose, hold, and confirm, while recovery tests prove complete compensation and no auto-hold. Public WebMCP mutation inputs use safe references; each Provider iframe derives its stable idempotency key privately before the same-origin HTTP call.
- The approved Sticker Network Hub product UI implements T070–T076: a large mood invitation, event-derived Provider stickers, composed stop bands, authoritative hold/confirm/recovery states, honest manual fallback, and a one-action WebMCP proof containing three real always-mounted Provider documents, route/text proof, and sanitized activity.
- Keyboard/focus/live-region, axe, reduced-motion, responsive/200%-text reflow,
  exact-origin headers, public-asset/runtime secret scans, and seven deterministic
  visual baselines implement T077–T079. The full repository suite passes 187/187
  tests, eight workspace typechecks, root lint, and format checks; local
  accessibility, security, and visual suites pass 9/9, 4/4 plus 50 assets, and
  8/8.
- T080 deploys all four exact production origins. T083 proves complete and
  explicit-incomplete compensation for `FAULT-NORI-DISAPPEARS`; T084 completes
  the final public-surface scan. The dedicated database, protected reset,
  current-Tokyo inventory, one manual production workflow, five top-level tool
  implementation, provenance bridge, and versioned area-pack validator pass.
  Fixed production mutation reliability now passes 20/20 with Provider status
  proof, p95 bounds, final reset, and post-reset baseline. Real Sol/Terra evals
  remain open in T082/T085/T089/T090. T095 now passes its nine-preset,
  accessibility, visual, shared-Intent, and post-deploy 20/20 gates. T093/T096
  remain open only as optional supporting research.
- T098–T101 now add deterministic transition focus, release/reconciliation
  locking, the session-only compensation guard, narrow proof/warning reflow, and
  their focused regression suite. The focused reducer/component/contract cases
  pass 28/28 and the affected browser workflow/layout cases pass 13/13. The four
  fixed origins are redeployed; Confirm and Release pass 20/20 each, followed by
  final reset and read-only 20/20.

## Target repository structure

```text
webhackathon/
├── apps/
│   ├── hub/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── bundle-sessions/[sessionId]/hold/route.ts
│   │   │   │   ├── bundle-sessions/[sessionId]/route.ts
│   │   │   │   ├── demo/reset/route.ts
│   │   │   │   ├── manual/search/route.ts
│   │   │   │   ├── manual/hold/route.ts
│   │   │   │   ├── manual/confirm/route.ts
│   │   │   │   └── manual/release/route.ts
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── orchestrator/
│   │   │   ├── provider-gateways/
│   │   │   ├── server/
│   │   │   └── store/
│   │   └── tests/
│   └── provider/
│       ├── app/
│       │   ├── api/
│       │   │   ├── slots/route.ts
│       │   │   ├── holds/route.ts
│       │   │   ├── holds/status/route.ts
│       │   │   ├── holds/[reference]/route.ts
│       │   │   ├── holds/[reference]/confirm/route.ts
│       │   │   ├── holds/[reference]/release/route.ts
│       │   │   └── demo/cancel-slot/route.ts
│       │   ├── embed/page.tsx
│       │   └── page.tsx
│       ├── components/
│       ├── lib/
│       │   ├── server/
│       │   ├── store/
│       │   └── tools/
│       └── tests/
├── packages/
│   ├── bundle-engine/
│   ├── contracts/
│   ├── provider-config/
│   ├── test-fixtures/
│   ├── ui/
│   └── webmcp/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── tests/
│   ├── e2e/
│   ├── phase0/
│   └── evals/
├── specs/001-serendipity-network/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── playwright.config.ts
```

## Architecture

### 1. Page and agent boundary

The Hub page is the only top-level product surface. Its Server Component renders
configuration and the initial shell. `HubClient` owns the Zustand state machine;
the score-lift product controller registers exactly five Hub Site Tools in a
top-level Client Component and projects their validated results into that state.

Each Provider `/embed` page is an actual cross-origin demo iframe. It renders a
compact Provider card and registers Provider tools through `packages/webmcp` for Chrome
cross-origin diagnostics. ChatGPT does not discover these iframe registrations;
on the production path the frame only reflects safe state from the Hub workflow.

The Provider root page offers a small standalone inventory view to prove that each origin remains a coherent site outside the Hub.

### 2. Two Provider gateway implementations

The orchestrator depends on one internal interface:

```ts
interface ProviderGateway {
  search(
    input: SearchSlotsInput,
    context: CallContext,
  ): Promise<Result<SearchSlotsData>>;
  hold(
    input: HoldSlotInput,
    context: MutationContext,
  ): Promise<Result<HoldData>>;
  getHoldStatus(
    input: GetHoldStatusInput,
    context: CallContext,
  ): Promise<Result<HoldStatusData>>;
  confirm(
    input: ConfirmHoldInput,
    context: MutationContext,
  ): Promise<Result<ConfirmationData>>;
  release(
    input: ReleaseHoldInput,
    context: MutationContext,
  ): Promise<Result<ReleaseData>>;
}
```

- `WebMcpProviderGateway` discovers exact-origin iframe tools and executes them
  through the compatibility adapter in the Chrome diagnostic harness.
- `HttpProviderGateway` runs only on the Hub server and calls Provider HTTP APIs
  using a server-only inter-service credential. Both human clicks and top-level
  Hub Site Tools use it in the production product path.

Both return the same contract envelope and feed the same orchestration and
bundle-engine code. The judged WebMCP path is a top-level Site Tool callback that
invokes the Hub workflow route; manual mode invokes that same route without
claiming a tool call.

Manual-mode Provider results are mirrored into the visible Provider iframes through an exact-origin `postMessage` presentation channel. The message carries only Provider slug, safe action/status, expiry, and correlation ID. Provider frames validate the Hub origin, schema version, Provider slug, and browser session. This channel cannot invoke inventory operations and never contains hold tokens or idempotency keys.

### 3. WebMCP compatibility adapter

`packages/webmcp` owns:

- local TypeScript declarations for the current draft surface;
- feature detection and origin-keying diagnostics;
- registration with `AbortController`-based cleanup;
- exact-origin discovery and origin/name verification;
- `toolchange` invalidation;
- execution timeouts and `AbortSignal` propagation;
- the Phase 0-pinned `executeTool` input encoding;
- parsing/validating the serialized result into the common envelope;
- normalized transport errors.

The adapter does not contain business rules. Mutation calls receive a precomputed idempotency key and are never automatically retried with a different encoding or key.

### 4. Historical nested-composition diagnostic

```text
Chrome diagnostic caller
  -> Hub find_serendipity_options
    -> Hub state: discovering
    -> WebMcpProviderGateway discovers three exact-origin tools
    -> Provider search tools execute in parallel
    -> outputs validate
    -> pure bundle engine composes/ranks
    -> candidate snapshot remains in validated Hub page state
    -> Hub state: composed
    -> result envelope returns to agent
```

High-level tool definitions exercised in this historical mode:

1. `find_serendipity_options`
2. `show_bundle`
3. `hold_bundle`
4. `confirm_bundle`
5. `release_bundle`

This diagram is retained because it explains the T019 gate. It is not the
ChatGPT production architecture after the documented iframe limitation.

### 5. Historical direct-provider diagnostic

T019 selected this path for the verified Chrome capability surface. Provider tools
remain individually named and directly usable by a compatible in-page diagnostic
caller. Hub tools are reduced to presentation/state operations that accept
validated Provider results. These tools remain valuable architecture evidence,
but ChatGPT's built-in browser does not discover them inside Provider iframes.

The architecture flag is build-time configuration, not a runtime coin flip:

```text
WEBMCP_COMPOSITION_MODE=direct
```

### 6. Production ChatGPT Site Tools path

The official OpenAI client path is independent of the historical composition
flag:

```text
ChatGPT Work/Codex in the built-in browser
  -> exactly five tools registered in the top-level Hub document
  -> shared product action controller
  -> existing same-origin Hub workflow Route Handlers
  -> HttpProviderGateway calls Kiln/Nori/Loop in parallel
  -> Supabase transaction functions
  -> validated result updates the same Hub reducer and visible proof
```

The five names are `find_serendipity_options`, `show_bundle`, `hold_bundle`,
`confirm_bundle`, and `release_bundle`. The controller owns cancellation,
operation locking, stale-version checks, and one reducer projection shared with
human actions. It never places Provider credentials, hold tokens, or idempotency
keys in the browser-visible input, output, activity, or bundle.

If Site Tools are unavailable, the same buttons and Route Handlers remain usable
as an explicitly labeled manual fallback. A manual action is never relabeled as a
Site Tool call.

### 7. Bundle engine

`packages/bundle-engine` is pure and has no React, WebMCP, fetch, or database dependency. It:

1. Normalizes and sorts Provider slots.
2. Enumerates the cartesian product of one slot per Provider.
3. Rejects products that violate hard constraints.
4. Calculates price, activity minutes, travel minutes, spare gaps, and end time.
5. Calculates the documented normalized score and deterministic reason codes.
6. Sorts with the documented tie-breaks and returns at most three immutable candidates.

The small fixture size makes exhaustive enumeration clearer and safer than a graph abstraction. Property tests protect future fixture growth.

### 8. Hold orchestration

The Hub derives three Provider-scoped creation idempotency keys from one bundle operation ID. Holds execute in parallel with `Promise.allSettled` and a 5-second operation deadline. In the production top-level/manual path, the Hub server encrypts raw Provider hold tokens; in the Chrome diagnostic path, each Provider iframe retains its own token. Both public surfaces return only safe hold references.

- All succeed: persist the selected snapshot and three safe hold references, compute the earliest `expiresAt`, and enter `held`.
- In manual HTTP mode only, the Hub server encrypts returned Provider tokens into the three bundle items before returning the public hold result. If that persistence fails, it compensates all known holds and does not enter `held`.
- Any business or transport failure: release every known successful hold in parallel using stable release keys.
- A response is unknown: query status using the stable client request reference before deciding whether compensation is needed.
- Compensation incomplete: enter `error` with `COMPENSATION_INCOMPLETE`; never enable confirmation.

The replacement candidate excludes the failed slot and already-invalid candidates. It is displayed but not held automatically.

### 9. Confirmation and reconciliation

Before confirmation, the Hub presents the immutable bundle snapshot and verifies that the earliest hold expiry has not passed. Provider confirms execute with stable idempotency keys.

- Known success from all Providers enters `confirmed`.
- Timeout or dropped response enters `reconciling` and calls `get_hold_status`.
- Mixed confirmed/held state remains an explicit reconciliation error; the MVP does not claim atomic cross-provider rollback.
- Retrying confirmation uses the same Provider idempotency keys.

The seeded demo does not inject a confirm-stage business failure. Hold-stage failure is the demonstrated recovery path.

### 10. Provider API and database boundary

Provider diagnostic tools do not access Supabase from the browser. They call
their own Provider origin:

```text
Provider WebMCP execute
  -> same-origin Route Handler
    -> schema and scoped-access validation
    -> server-only database function call
    -> normalized result
    -> Provider iframe store update
```

Provider `/embed` receives a validated safe browser-session UUID from the Hub query string, or generates one for a standalone frame, and receives a 15-minute Provider-scoped demo access token at render time. It authorizes only the documented Provider endpoints and never authorizes direct database access. The Hub server uses a separate inter-service credential for manual mode. Service-role credentials never reach browser JavaScript.

Hold creation returns a private same-origin HTTP payload with a `publicResult` and `holdToken` split. Provider tool code persists the token in its own origin-scoped session only and exposes only `publicResult` to WebMCP/Site Tools. Unknown-result lookup for an active hold can re-derive the token into the private `x-serendipity-recovered-hold-token` response header; the tool stores it and strips the header from its result. Subsequent mutation URLs use the safe client-request `reference`; confirm/release carry the token only in `x-serendipity-hold-token`. The Route Handler resolves both the safe reference and token hash and rejects the operation unless they identify the same browser-session-bound hold. Raw tokens never appear in URLs or public envelopes, and terminal operations clear the session copy.

The local Supabase stack keeps Auth enabled only so its generated server credential can authenticate PostgREST; application users do not authenticate through Supabase Auth. Provider authorization remains the short-lived scoped token enforced before any database lookup.

On the production top-level Site Tools path, the browser calls the Hub's
same-origin workflow boundary; the Hub server then calls these Provider APIs with
its inter-service credential. No Provider access token is issued to the top-level
tool callback.

### 11. State persistence

- Zustand is the immediate UI source of truth.
- Candidate snapshots remain client-local while the workflow is read-only. The Hub creates `bundle_sessions` and persists the selected immutable snapshot when the first hold mutation begins.
- Provider hold state remains authoritative in `holds`.
- `bundle_items` links sessions to slots/holds. It may hold an
  application-encrypted Provider token only for Hub-server-orchestrated operations,
  including manual and top-level Site Tool calls; Chrome diagnostic sessions
  persist safe references only.
- Each Provider iframe stores its own active token in origin-scoped
  `sessionStorage` for Chrome diagnostic sessions, keyed by safe reference and
  browser session, and clears it on terminal state. The token never appears in a
  public result.
- A random browser-session cookie binds same-tab reload/reconciliation to the Hub session. Provider token plaintext is never returned in public Hub envelopes or written to logs.
- After a same-tab reload, the Chrome diagnostic may rediscover Provider tools and
  resolve local safe references. Production manual and top-level Site Tool paths
  rehydrate through the Hub server HTTP gateway with decrypted tokens.

## Headers and origin policy

Hub responses:

```text
Origin-Agent-Cluster: ?1
Permissions-Policy: tools=(self "https://<kiln>" "https://<nori>" "https://<loop>")
Content-Security-Policy: frame-src https://<kiln> https://<nori> https://<loop>; ...
```

Provider responses:

```text
Origin-Agent-Cluster: ?1
Permissions-Policy: tools=(self)
Content-Security-Policy: frame-ancestors https://<hub>; ...
```

Every iframe also includes `allow="tools"` for the Chrome cross-origin diagnostic
surface. This delegation is not represented as ChatGPT support because the
built-in browser does not discover iframe tools. Providers do not send
`X-Frame-Options: DENY` or `SAMEORIGIN`. Actual CSP directives are assembled and
tested per environment; placeholders are never deployed.

## Error and retry policy

| Operation       |      Timeout |                      Automatic retry | Unknown-result handling                     |
| --------------- | -----------: | -----------------------------------: | ------------------------------------------- |
| Search          | 3 s/provider | Once for retryable transport failure | Fail closed if one Provider remains unknown |
| Show bundle     |          1 s |                                 None | Preserve current selection                  |
| Hold            |    5 s total |    Same key only after status lookup | Query status, then compensate if held       |
| Get hold status |          3 s |                                 Once | Surface reconciliation error                |
| Confirm         |    5 s total |                        Same key only | Query status before reporting               |
| Release         |    5 s total |                        Same key once | Query status; warn if still held            |

Business errors are fulfilled as `ok: false` envelopes. Programmer errors, invalid adapter state, and user cancellation may reject internally but are normalized at the orchestration boundary.

## UI design

The approved product contract is maintained in [ui-plan.md](./ui-plan.md), with
literal visual rules in the repository root [DESIGN.md](../../DESIGN.md). The user
selected the lightweight Sticker City direction and approved its refinement as
**Sticker Network**. This closes T008; it does not bypass the independent T019
WebMCP architecture gate.

### Information hierarchy

1. Invitation: one oversized mood question, four large choices, compact fixed-scope
   constraints, an honest `Shibuya launch network` boundary, and one
   `Plan my night` action.
2. Live Provider strip: three colorful Kiln/Nori/Loop stickers showing separately
   named connection and operation state from actual orchestration events.
3. Journey: one three-stop recommendation rendered as Provider-colored stop bands,
   with totals, travel/spare gaps, a deterministic reason, and one state-derived action.
4. Progressive disclosure: ranked alternatives, then `See WebMCP in action`.
5. Proof: three real cross-origin Provider iframes, exact-origin identity, stylized
   route plus text equivalent, and sanitized Tool Activity.

### T095 bounded intent and clarity amendment

T095 is an additive amendment to the locked Sticker Network hierarchy. The first
viewport keeps the same mood-first invitation and single `Plan my night` action.
One native disclosure, `Adjust time & budget`, is closed by default and contains
only these values:

| Constraint   | Closed set             | Default |
| ------------ | ---------------------- | ------- |
| Start after  | 18:00, 18:30, 19:00    | 18:00   |
| Total budget | ¥4,500, ¥5,000, ¥6,000 | ¥5,000  |

`area: "shibuya"`, `partySize: 1`, and the 22:30 end boundary remain visible and
fixed. A preset change updates local selection only; it neither searches nor
mutates inventory. On the existing plan action, the selected values are combined
with the Tokyo service date and current mood tags into the same validated
`Intent` shape consumed by the shared product action controller.

The canonical seeded fixture matrix is locked as follows:

| Start | ¥4,500                   | ¥5,000                   | ¥6,000                   |
| ----- | ------------------------ | ------------------------ | ------------------------ |
| 18:00 | at least one valid route | at least one valid route | at least one valid route |
| 18:30 | `NO_VALID_BUNDLE`        | 2 routes                 | 3 routes                 |
| 19:00 | `NO_VALID_BUNDLE`        | `NO_VALID_BUNDLE`        | `NO_VALID_BUNDLE`        |

The result and no-result state repeat the effective start and budget so the
constraint is never hidden after search. Tests preserve the canonical default
winner at 18:00 plus ¥5,000.

T095 also closes five presentation ambiguities without changing orchestration:

1. Generic network copy says `Three Provider sites`; `Site Tool` and `Manual
fallback` are used only as provenance labels.
2. The manual notice says that availability came through Provider APIs and that
   no Site Tool call occurred.
3. A Provider still `Connecting` does not simultaneously render or announce
   operation `Ready`.
4. Before hold, the durable review says the hold is temporary, the reservation is
   a demo, no payment occurs, and no real booking is created.
5. Alternatives retain stable `Route 1`, `Route 2`, and `Route 3` labels from the
   original ranked candidate set and show time, price, travel, and activity titles;
   choosing a route does not renumber the others.

Implementation stays within the existing product components and shared action
controller. Component, preset-fixture, Playwright accessibility, visual,
fixed-production matrix, and post-deploy 20-run reliability evidence now pass;
see `evidence/t095-ux-generalization.md`.

Primary implementation paths are `mood-prompt.tsx`, `hub-client.tsx`,
`product-view.tsx`, `provider-strip.tsx`, `journey.tsx`, and shared product types
under `apps/hub/components/product/`; verification paths are
`apps/hub/tests/components/product-ui.test.ts`,
`packages/bundle-engine/src/index.test.ts`, `tests/e2e/accessibility.spec.ts`, and
`tests/e2e/visual.spec.ts`.

### T098–T101 UI-completeness follow-up

This follow-up preserves T095 and the one-action Sticker Network hierarchy. It
changes only state-transition safety, focus/scroll behavior, and narrow-container
presentation.

- **Focus controller**: compare the prior and next durable UI state, then focus
  the state-specific target with `preventScroll` and reveal it using non-animated
  `scrollIntoView({ block: "start" })`. Cancel the queued animation frame during
  cleanup so Strict Mode or a newer transition cannot apply stale focus. Initial
  load and background Provider messages do not trigger focus.
- **Release controller**: add `releasing` plus explicit start/completed/failed
  events. One shared operation lock gates buttons and top-level Site Tools before
  transport. A retryable error retains the active hold and reuses the idempotent
  release; a non-retryable result reloads the existing bundle session and
  validates its unchanged response shape before projecting released/expired,
  confirmed, held, or mixed/unknown status.
- **Compensation guard**: derive `blockedUntil` from the failure envelope's
  completion time plus 90 seconds and persist only that ISO timestamp under
  `serendipity-compensation-blocked-until-v1`. Reload restores an unexpired guard;
  expiry changes only the available fresh-search action and performs no network
  request or release-success projection.
- **Narrow proof**: keep the 320px minimum on the standalone Provider home, not
  the embed document. At Hub widths below 768px, warning text wraps and each
  proof iframe is 20rem high; the compact Provider presentation keeps identity,
  connection, operation, and latest action within both iframe axes.

The public Site Tool names and inputs, REST paths and response wire shapes,
database schema, fixed Shibuya/solo/by-22:30 intent, and Provider origin policy do
not change.

### Responsive behavior

- `>=1280px`: centered journey column near 1120px; the Provider strip may share
  result-heading space, but detailed technical proof expands below the journey.
- `768–1279px`: single decision column; Provider stickers remain a readable row or wrap.
- `<768px`: prompt, constraints/action, Provider strip, journey, alternatives, then
  proof disclosure. Provider frames stack only inside the expanded proof layer.
- At 320px and 200% text enlargement, transition focus reveals the new route or
  reset heading before any lower action. The action remains reachable by forward
  document scroll; no sticky CTA or reverse-scroll dependency is introduced.

Desktop is the demo priority, but the primary workflow must remain operable at 390px.

### Visual architecture

Structure and skin are separated with semantic Tailwind v4 theme variables.
Components use product-level tokens, not literal palette values. Provider deployments
override only their Provider identity accent and local label; status semantics,
spacing, focus, and action hierarchy remain shared.

The product surface uses the root `DESIGN.md` light-blue canvas, black cutout
outlines, large pill controls, violet primary action, and mint/yellow/orange Provider
identities. Provider identity color never doubles as workflow status. The selected
direction is implemented CSS-first without a required illustration or remote-font
dependency.

`LiveProviderStrip` consumes an explicit presentation projection from validated
gateway/orchestrator events. It never infers success from elapsed time, iframe copy,
or CSS state. `WebMcpProof` owns disclosure presentation of the mounted Provider
frames, `RouteProof`, and `ToolActivity`; it does not own tool registration or
business state. This lets the same events drive the journey, Provider stickers,
real iframe UI, and accessible announcements without duplicate authorities.

## Data and compatibility

The database is greenfield, so no production migration/backfill exists. Migrations must still be reversible during development:

- Schema migrations are additive until the first tagged demo release.
- Seed/reset is idempotent and scoped to demo records.
- A migration rollback script is kept for destructive schema experiments, but production demo resets use functions rather than dropping tables.
- Contract schemas carry a `schemaVersion`; unsupported versions fail closed.
- Candidate snapshots carry `bundleVersion`; stale agent/UI operations fail without side effects.

Contract version 1 supports only `area: "shibuya"`. Describing the audience as
urban does not broaden this enum. A future area is supplied by a versioned data
pack containing an area slug, IANA timezone, currency, exact-origin Provider set,
location nodes, complete directed travel matrix, service window, deterministic
feasible fixture, and boundary/localization copy. A pack remains dark until its
schema compatibility, origin headers, feasibility, reset/reliability, and one
production E2E all pass. The product adds no region selector until at least two
such packs are genuinely available.

T095 requires no schema version or database migration: every preset already fits
the version 1 timestamp and budget contract. Region selection, party sizes above
one, and third-party/real Provider onboarding remain version 2 capabilities.

Details are in [data-model.md](./data-model.md) and [contracts/webmcp-tools.md](./contracts/webmcp-tools.md).

## Quality and operations

### Security and privacy

- Exact cross-origin allowlists; no wildcard exposure.
- Server-only service credentials and restricted database grants.
- Short-lived Provider page access token; unguessable hold token stored as a Provider-side hash and, for Chrome diagnostic sessions, only in the owning iframe's origin-scoped session store.
- Active Provider hold tokens copied to Hub persistence by manual/server mode are encrypted with a separate server-only bundle encryption key and cleared after terminal workflow state.
- Input length limits on every free-text/tag field.
- No raw prompt, reasoning, secret token, idempotency key, or database credential in audit events.
- Controlled demo endpoints require an operator secret and are disabled outside demo environments.

### Accessibility

- Semantic headings and landmarks.
- Native buttons/links or Radix primitives for interactions.
- Native disclosure and radio-group semantics for the closed time/budget presets;
  group labels and selected values remain available at 200% text zoom.
- Visible focus, keyboard disclosure behavior, live regions for state changes, and text equivalents for map paths.
- State-transition focus targets the route summary, held/release/recovery/error
  heading, receipt, or invitation as appropriate; alternative selection never
  falls back to `body`, and background Provider events never steal focus.
- Status is never communicated by color alone.
- `prefers-reduced-motion` removes nonessential transitions.

### Performance

- Provider searches run in parallel.
- Bundle enumeration uses small deterministic fixtures. Production Site Tools and
  manual actions reuse the server orchestrator; the Chrome diagnostic retains its
  in-page composition coverage.
- No map SDK, image-heavy hero, Realtime subscription, or general cache client in the critical path.
- Route Handler responses use explicit no-store semantics for inventory and hold state.

### Observability

- Every operation gets a correlation ID and Provider-scoped child IDs.
- Audits record origin, tool/API name, action, status, error code, and duration.
- Browser activity shows a sanitized projection; detailed server logs remain bounded and token-redacted.
- Phase 0 captures DevTools screenshots/log exports as manual evidence without committing secrets.

### Rollout and rollback

1. Preserve the completed local and fixed-origin Phase 0 evidence and recorded
   `direct` diagnostic decision.
2. Register and verify five top-level Hub tools in local and preview environments.
3. Verify truthful proof labeling, secret scans, lifecycle cleanup, and manual
   parity before production mutation.
4. Enable the protected reset, align compute with the Tokyo database, and prove
   bounded Provider failure handling.
5. Run the real ChatGPT Site Tools 3/3 gate, complete workflow matrix, and reset
   rehearsal on fixed production origins.
6. Land the user-authorized T095 presets and clarity fixes after their automated
   component/fixture/accessibility/visual tests; human sessions are optional
   supporting research, not a rollout dependency.
7. Land T098–T100 locally, then deploy T101 to all four fixed `hnd1` origins and
   run both 20-cycle reset/plan/hold/confirm and reset/plan/hold/release paths;
   stop on any non-favicon error, stabilize for 12 seconds, and finish with reset
   plus 20/20 read-only search.
8. Keep future area packs, party-size expansion, and real Provider onboarding dark
   until their version 2 supply/evidence gates pass.

Rollback options:

- Remove/disable the top-level product registrations while retaining manual HTTP
  mode and the historical Chrome diagnostics.
- Keep `WEBMCP_COMPOSITION_MODE=direct` for the diagnostic harness; it is not a
  production product-path switch.
- Revert to the prior Vercel deployment.
- Run demo reset to clear ephemeral holds; never drop production tables during a demo rollback.

## Requirement mapping

| Requirements | Design elements                                        | Primary verification                                  |
| ------------ | ------------------------------------------------------ | ----------------------------------------------------- |
| FR-001–002   | target clients, top-level product tools, dual paths    | P0 diagnostics; STL top-level and manual parity       |
| FR-003–007   | shared contracts and pure bundle engine                | schema tests, examples, property tests                |
| FR-008–010   | Hub state/UI and immutable candidates                  | component and E2E selection tests                     |
| FR-011–014   | database hold functions and hold orchestrator          | pgTAP concurrency/idempotency; recovery integration   |
| FR-015–018   | confirmation, status reconciliation, release/expiry    | API integration and E2E receipt tests                 |
| FR-019–020   | recovery candidate and no-results states               | deterministic failure fixtures                        |
| FR-021–023   | Provider iframe diagnostics and exact origins          | Phase 0 Chrome matrix and header tests                |
| FR-024–025   | server boundary, scoped credentials, redaction         | static bundle scan, API auth tests, log scan          |
| FR-026–027   | accessible UI and bounded operations                   | axe/keyboard/reduced-motion and latency checks        |
| FR-028–030   | demo controls, audit facts, lifecycle invalidation     | operator E2E, redaction tests, iframe reload tests    |
| FR-031–035   | Sticker Network hierarchy and live WebMCP proof        | component, visual, E2E, and manual demo tests         |
| FR-036–037   | closed preset disclosure and shared effective intent   | IMP-003; UI-028–029 component/fixture/PW acceptance   |
| FR-038–040   | truthful provenance, pre-hold scope, stable routes     | UI-030–032 component/a11y/visual acceptance           |
| FR-041       | deterministic transition focus and scroll controller   | UI-033–034/038 at 320px and 200% text                 |
| FR-042       | atomic release state, retry, and status reconciliation | UI-035 reducer/component/Site Tool workflow           |
| FR-043       | session-only 90-second compensation safety guard       | UI-036 reload/clock/request-count acceptance          |
| FR-044       | narrow warning and Provider proof container reflow     | UI-037 internal overflow and essential-content checks |

## Commercial release design

The final public information architecture has two consumer routes under one root
layout. `/` is a static landing surface; `/plan` owns `HubClient`, request-scoped
browser identity, workflow state, Provider presentation, and the five top-level
product Site Tools. Result, hold, release, recovery, confirmation, and receipt
remain states inside `/plan`, not separate routes.

The root landing uses the approved Sticker Editorial extension: a single maximal
hero, original cut-paper Provider illustrations, restrained editorial sections,
and the existing mint/yellow/coral identities. It contains no Client Component
workflow, Provider iframe, or Provider/API call. The direct judge and README URL
is `/plan`.

`/plan` calls Next.js `connection()` before creating the request UUID. It accepts
only the existing mood, start, and budget presets from query parameters and
passes them as initial controls without initiating work. Browser/session/hold
identifiers remain memory/cookie state and never enter a URL.

Product proof frames mount only after the native disclosure opens. The historical
`/phase0` route remains the always-mounted Chrome cross-origin diagnostic and is
removed from consumer navigation. This reduces initial network cost without
changing the official top-level ChatGPT architecture.

The isolated evaluation project uses the same public five-tool definitions and
route handlers with a server-only `SERENDIPITY_EVAL_FAULT` gateway decorator.
The decorator is accepted only for the fixed evaluation Hub with demo mode and a
separate database. Production rejects the variable. Its scenarios are Nori hold
loss, inert Loop search-result poisoning, and Loop confirm commit with a dropped
response followed by ordinary status reconciliation.

| Requirement | Design element                                                                | Verification                                          |
| ----------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| FR-045–047  | static landing, exact navigation, metadata assets                             | UI-039–043, request inventory, Lighthouse             |
| FR-048–051  | request-dynamic planner, safe query seed, dialog/navigation guard, lazy proof | UI-044–048, route lifecycle, axe/PW                   |
| FR-052      | server-only evaluation gateway and separate fixed environment                 | unit/integration guard tests, deployed AE-007/009/012 |
| SC-018–024  | final product, reliability, real-client and security gates                    | T106 commercial ledger and Site Tools evidence        |

## Alternatives and decisions

| Decision              | Choice                                                                  | Reason                                                                                    | Rejected alternative                                               |
| --------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Production Site Tools | Five top-level Hub tools over shared server workflow                    | Official ChatGPT docs exclude iframe tools; gives one visible, testable product path      | Claim iframe tools as the ChatGPT judge surface                    |
| Phase 0 diagnostics   | Preserve `direct` Provider tools plus Hub coordination                  | Truthful record of verified Chrome behavior and useful cross-origin architecture evidence | Rewrite T019 as if the later limitation were known                 |
| Geographic scope      | General urban problem, Shibuya launch data pack                         | Broadly relevant need without claiming unsupported inventory or regions                   | Add an empty region selector or claim Tokyo-wide use               |
| T095 input scope      | Closed time/budget presets behind one disclosure                        | Adds useful agency while preserving one action and deterministic fixture coverage         | Free-form fields, region/party controls, or another CTA            |
| Impact evidence       | Automated/synthetic T095 acceptance is required; human studies optional | Implements the user-approved scope without making recruitment a code or score blocker     | Block implementation or score reporting on participant recruitment |
| UI-completeness focus | Explicit durable-state targets with deterministic scroll                | Preserves context at 320px/200% and is testable without browser focus heuristics          | Focus the whole shell or force `scrollTo(0, 0)` in tests           |
| Compensation recovery | 90-second session-only guard and explicit fresh search                  | Prevents unsafe mutation while making no unverifiable release claim                       | Permanent dead end or automatic success/status request at expiry   |
| Bundle size           | Exactly three, one per Provider                                         | Strong story and deterministic UI                                                         | Variable one-to-three stop marketplace                             |
| Bundle algorithm      | Exhaustive pure enumeration                                             | Tiny fixture set, easiest to prove                                                        | Graph framework or optimization service                            |
| Holds                 | Parallel plus compensation/status lookup                                | Fast and shows distributed coordination                                                   | Sequential-only workflow                                           |
| Confirm failure       | Reconcile unknown outcomes; no confirmed cancellation                   | Appropriate MVP boundary                                                                  | Pretend cross-origin confirmation is atomic                        |
| Manual compatibility  | Server-side HTTP Provider gateway                                       | Keeps normal UI functional                                                                | Static unsupported-browser screen                                  |
| Provider code         | One configurable app, three deployments                                 | Less duplication, still distinct origins                                                  | Three independent codebases                                        |
| Database              | One Supabase project with Provider-owned functions                      | Hackathon practicality and reliable reset                                                 | Three database projects                                            |
| Map                   | SVG and travel matrix                                                   | Deterministic, fast, no API/license dependency                                            | Google Maps                                                        |
| Client cache          | Zustand + fetch                                                         | Workflow state is small and explicit                                                      | TanStack Query                                                     |
| Live updates          | Tool results first                                                      | No correctness dependency on subscriptions                                                | Supabase Realtime from the start                                   |
| Visual direction      | Sticker Network: playful experience plus real proof                     | Fits the lightweight MVP while exposing WebMCP                                            | Field Guide/dashboard rail; raw Slush clone                        |
| Public IA             | Static `/` landing plus stateful `/plan`                                | Commercial entry without fragmenting tools or workflow state                              | Multi-route results/checkout or duplicate root tools               |
| Commercial visuals    | Sticker Editorial with original illustration and real UI capture        | Preserves distinctiveness while improving launch trust                                    | Stock Tokyo photos or generic SaaS cards                           |
| Final real-client run | Once on the final `/plan` route                                         | Avoids invalidating evidence by moving the tool document afterward                        | Complete on `/` and repeat after route migration                   |

## Governance check

| Rule/gate                                   | Result              | Evidence or exception                     |
| ------------------------------------------- | ------------------- | ----------------------------------------- |
| User-visible intent precedes implementation | Pass                | `spec.md` scenarios and FRs               |
| Unstable API isolated and researched        | Pass                | `research.md`, `packages/webmcp` boundary |
| Side effects are explicit and idempotent    | Pass                | contract and database design              |
| Cross-origin access is least privilege      | Pass                | exact origin/header plan                  |
| Failure recovery is observable              | Pass                | US5 and compensation design               |
| Manual UI is preserved                      | Pass                | dual Provider gateway                     |
| Requirements map to evidence                | Pending final audit | `test-matrix.md` and `tasks.md`           |

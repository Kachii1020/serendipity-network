# Score Lift Plan: 20+ on Every Non-Creativity Criterion

**Status**: Approved for execution — W1–W4/E1–E2 foundation plus the
user-authorized T095 bounded UX slice; score claims remain gated by required
production and automated/synthetic evidence, with human research optional  
**Input**: Raise WebMCP Leverage, Execution, and Potential Impact above 20/25
without diluting the approved lightweight UI  
**Baseline evidence**: [Hackathon readiness audit](./evidence/hackathon-readiness-audit.md)

## 1. Target and score-reporting rule

| Official criterion    | Current proxy | Exit target | Score may be reported only after                                                                             |
| --------------------- | ------------: | ----------: | ------------------------------------------------------------------------------------------------------------ |
| WebMCP Leverage       |         14/25 |       22/25 | Top-level five-tool product flow completes 3/3 in ChatGPT Sol/Terra with Site Tools evidence                 |
| Execution             |         18/25 |       22/25 | Repeatable reset, bounded latency, 20-run reliability gate, clean-clone build, and final rehearsal pass      |
| Potential Impact      |         13/25 |       21/25 | Real “today” intent, bounded T095 controls/clarity, exact fixture outcomes, and automated UX acceptance pass |
| Creativity & Ambition |         22/25 |       22/25 | Preserve current concept; do not add novelty for novelty's sake                                              |
| **Target total**      |    **67/100** |  **87/100** | Every row has required production or automated/synthetic evidence; optional human research may strengthen it |

The organizer publishes four equally weighted criteria but not a numeric judging
scale. These scores remain internal evidence-calibrated proxies.

## 2. Product contract and scope lock

```text
Demo: an urban spontaneous-evening planner asks for help in the supported Shibuya
launch network; the agent finds, holds, and confirms a three-site route while the
same UI visibly changes.

Exact path: top-level Hub Site Tool → existing Hub workflow route → three
Provider HTTPS APIs in parallel → Supabase → Hub receipt and safe proof.

Done: one repeatable production fixture, 3/3 real Sol/Terra agent completions,
20/20 measured workflow completions, and T095 automated/synthetic acceptance for
the bounded presets and clarity contract.

Cut: unsupported-area claims, region and party-size selectors, third-party/real
Provider onboarding before a version 2 supply contract, payment, authentication,
map SDK, provider marketplace, recommendation ML, new visual direction, and a
general itinerary builder.
```

The primary consumer is an **urban resident, worker, or visitor** with two to four
unexpectedly free evening hours, a fixed budget, and no desire to reconcile
availability across multiple independent venue sites. The need is general; the
available launch network is not. Shibuya is the only currently supported area and
the only area used for production claims. The Provider-side beneficiary is a
small urban venue with last-minute capacity that wants to stay on its own origin
instead of joining a centralized marketplace.

## 3. Architecture decision that unlocks WebMCP 20+

The historical `direct` plan cannot be the ChatGPT judging path. Official
[OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp)
states that the built-in browser does not discover tools registered inside
same-origin or cross-origin iframes and recommends JavaScript registration on
the top-level page.

Therefore the production judging surface becomes:

```text
ChatGPT Sol/Terra
  → five tools registered in the top-level Hub document
    → existing same-origin Hub workflow Route Handlers
      → Kiln, Nori, and Loop server APIs in parallel
        → Supabase
  → Hub reducer, Provider presentation bridge, proof, and receipt
```

Exactly five public tools are exposed:

1. `find_serendipity_options` — read-only
2. `show_bundle` — read-only
3. `hold_bundle` — mutation
4. `confirm_bundle` — mutation
5. `release_bundle` — mutation

The existing seven direct coordination tools and fifteen iframe Provider tools
remain the historical Chrome architecture diagnostics. They are not the ChatGPT
critical path and T019 is not rewritten.
`allow="tools"` is still added to product iframes for Chrome/WebMCP standards
coverage, but it is not presented as the built-in-browser solution.

## 4. Lane W — WebMCP Leverage 14 → 22

### W1 (`SL-W1`). Reconcile the architecture before code

**Files**:

- `specs/001-serendipity-network/research.md`
- `specs/001-serendipity-network/plan.md`
- `specs/001-serendipity-network/contracts/webmcp-tools.md`
- `specs/001-serendipity-network/evidence/phase0-decision.md`
- `specs/001-serendipity-network/test-matrix.md`

Record the distinction between the Chrome cross-origin capability harness and
the production ChatGPT top-level Hub surface. Preserve the historical `direct`
decision instead of rewriting it as if iframe limitations were previously known.

**Exit**: every production tool claim has one named runtime and one executable
test; no artifact implies that ChatGPT discovers iframe tools.

### W2 (`SL-W2`). Build one shared product action controller

**Files**:

- new `apps/hub/lib/tools/product-tools.ts`
- `apps/hub/components/product/hub-client.tsx`
- existing `apps/hub/lib/tools/discovery-tools.ts`
- existing `apps/hub/lib/tools/reservation-tools.ts`

Extract the existing manual UI actions into a controller shared by button clicks
and top-level Site Tools. Site Tool execution uses the current `/api/manual/*`
routes, contracts, server-side Provider orchestration, encrypted token storage,
idempotency, compensation, and reconciliation. It does not reproduce business
logic in browser code.

The controller owns current candidates, selected bundle, active hold, operation
lock, and reducer projection through mutable refs so registered callbacks never
capture stale React state.

**Exit**:

- top-level document registers exactly five tools and disposes all five on unmount;
- Strict Mode remount leaves one registration per name;
- manual buttons and Site Tools produce equivalent validated results;
- search cannot mutate inventory;
- hold/confirm/release require explicit matching inputs and existing state;
- cancellation reaches the underlying request;
- no private token enters a tool input, output, activity row, or browser bundle.

### W3 (`SL-W3`). Make proof truthful and judge-readable

**Files**:

- `apps/hub/components/product/webmcp-proof.tsx`
- `apps/hub/components/product/tool-activity.tsx`
- `apps/hub/components/product/types.ts`
- `apps/hub/lib/manual-presentation.ts`
- `apps/provider/lib/manual-presentation.ts`

Add `allow="tools"` to each iframe for Chrome. Label each event as `Site tool`
or `Manual fallback`; show actual tool name, Hub/Provider origin, status,
duration, timestamp, and correlation ID. Provider frames must say that a Hub
Site Tool requested the Provider API when that is what happened—never that the
iframe tool itself ran.

**Exit**: the expanded proof explains the five-tool orchestration in under ten
seconds and SEC-013 confirms no secret-shaped value.

### W4 (`SL-W4`). Verification ladder

**Automated files**:

- new `apps/hub/lib/tools/product-tools.test.ts`
- new `tests/phase0/product-site-tools.spec.ts`
- extend `tests/e2e/visual.spec.ts`
- extend `tests/security/security.spec.ts`

**Automated gates**:

- five top-level tools, 2 read and 3 write;
- legacy seven direct tools absent from the product registry;
- invalid or stale input makes zero network calls;
- one Site Tool call makes one matching Hub request;
- manual clicks are never labeled as WebMCP;
- Chrome still discovers the fifteen Provider diagnostics when delegated;
- removing one iframe permission fails closed in Chrome;
- UI states and safe activity remain synchronized.

**Real model gate**: latest ChatGPT desktop, personal/Pro workspace, Site Tools
enabled, GPT-5.6 Sol or Terra:

1. Recommendation-only prompt calls `find_serendipity_options` and no mutation, 3/3.
2. Explicit 90-second hold calls `hold_bundle` once, 3/3.
3. Explicit confirmation calls `confirm_bundle` once, 3/3.
4. Explicit release calls `release_bundle` and never confirm, 3/3.
5. Full `find → hold → confirm` reaches the visible receipt under three minutes, 3/3.
6. Recently Used records safe inputs/results and passes the secret scan.
7. Tool-poisoning and unknown-confirm cases remain fail-closed.

WebMCP may be reported as 21–23 only after this real model gate. Chrome or mocked
`document.modelContext` alone cannot satisfy it.

## 5. Lane E — Execution 18 → 22

### E1 (`SL-E1`). Make demo inventory repeatable before another confirmation

Reuse the existing protected reset RPC and Hub route. Do not build an admin UI.

**Files/config**:

- new `scripts/demo-reset-production.mjs`
- `package.json`
- Hub production `DEMO_MODE=true`
- Hub-only `DEMO_OPERATOR_SECRET`

The script must reject every origin except the fixed Hub, require an explicit
production-reset opt-in, read the secret only from process environment, verify
the response schema and nine restored slots, and perform a read-only search
after reset. Unauthorized and non-demo requests remain indistinguishable 404s.

Before public judging, raise the demo baseline capacity enough for at least
twenty complete judge runs while keeping the same shared-inventory and
concurrency semantics. Fold this data-only change into the planned rolling-date
migration in I2 rather than creating a separate migration; it must not create
per-user fake inventory.

**Exit**: reset passes twice, final inventory equals the documented baseline,
orphan `HELD` count is zero, and the script cannot run accidentally.

### E2 (`SL-E2`). Align compute with the Tokyo database and bound failures

Vercel currently runs Hub and Provider functions in Washington (`iad1`) while
Supabase is in Tokyo. Vercel's official
[region guidance](https://vercel.com/docs/functions/configuring-functions/region)
recommends placing functions close to the data source; `hnd1` maps to Tokyo
`ap-northeast-1`.

**Files**:

- `vercel.hub.json`
- `vercel.provider.json`
- `apps/hub/lib/provider-gateways/http.ts`
- `apps/hub/lib/provider-gateways/provider-gateways.test.ts`

Set one region, `hnd1`, for all four projects and enable Fluid Compute if the
project setting is not already active. Add a five-second Provider transport
deadline; classify caller cancellation separately from internal timeout.
Do not add multi-region or Edge execution.

**Exit**: deployment inspection shows `hnd1`; hanging Provider tests stop within
the bound; search/hold/confirm still preserve exact error semantics.

### E3. Convert one successful run into measured reliability

**Files**:

- new `scripts/measure-production-workflow.mjs`
- new `tests/e2e/production-reliability.spec.ts`
- `specs/001-serendipity-network/evidence/full-system-verification.md`

The harness runs reset and the same complete workflow twenty times, keeps
credentials only in memory, records only status/correlation/duration, and resets
again in `finally`.

**Required metrics**:

| Metric                                    | Gate           |
| ----------------------------------------- | -------------- |
| Receipt completion                        | 20/20          |
| Non-2xx, invalid envelope, unknown result | 0              |
| Search p95                                | ≤3 seconds     |
| Hold p95                                  | ≤5 seconds     |
| Confirm p95                               | ≤5 seconds     |
| Automated click-to-receipt p95            | ≤20 seconds    |
| Duplicate/missing correlation IDs         | 0              |
| Final orphan holds                        | 0              |
| Final inventory                           | exact baseline |

A preliminary read-only production measurement during planning passed 20/20
with p50 1.317 seconds, p95 1.808 seconds, and max 4.807 seconds. Preserve its
raw command/output when E3 starts; the mutation and UI gates remain unrun and
require separate explicit approval.

### E4. Close coherent-product gaps

**Files**:

- `apps/hub/components/product/hub-client.tsx`
- `apps/hub/components/product/hold-countdown.tsx`
- `apps/hub/components/product/journey.tsx`
- `tests/e2e/accessibility.spec.ts`

Move focus to search result, hold review, recovery/error, and receipt after user
actions; stop announcing every countdown second; make the selected mood copy
dynamic. Extend keyboard and axe coverage through the complete canonical state
sequence instead of idle only.

### E5. Package a judge-runnable submission

**Files**:

- `.gitignore`
- new root `README.md`
- new root `LICENSE` after owner approval
- new `.github/workflows/ci.yml`
- submission checklist under `specs/001-serendipity-network/evidence/`

The README contains a 30-second judge path, architecture, live origins, honest
manual/WebMCP distinction, setup, migration/seed, tests, security boundaries,
and fixture limits. Run a secret scan and the README commands from a clean clone.
Public repository creation/push, license selection, and YouTube upload remain
separate user-authorized external actions.

**Final rehearsal**: two consecutive live Site Tool completions after reset,
rollback to the previous deployment rehearsed, and a narrated video targeting
2 minutes 20 seconds.

## 6. Lane I — Potential Impact 13 → 21

Impact cannot reach 20 through copy alone. The required path is a truthful current
Tokyo date, useful but bounded controls, deterministic outcome coverage, and
automated product clarity/accessibility evidence. Consumer and Provider studies
remain valuable supporting research, but the user has made them optional rather
than implementation, release, or internal score-reporting blockers.

### I1 (`SL-I1`). Optional supporting problem research

Run five 10-minute consumer interviews/usability sessions across urban residents,
workers, or visitors and at least two independent venue/operator interviews.

**Consumer baseline task**: solve the general problem—assemble a spontaneous
urban evening after 18:00 under a hard budget using ordinary browsing—then repeat
inside Serendipity's supported Shibuya launch network. Record the geographic
constraint explicitly so a Shibuya test is not reported as multi-city evidence.

**Provider question**: would exposing one last-minute slot through an origin-owned
tool be preferable to maintaining a separate centralized marketplace listing?

**Optional research targets**:

- at least 4/5 consumers report cross-site compatibility or choice overload;
- at least 2/2 Providers recognize stale capacity or duplicate listing work;
- no aided completion is counted as success.

Results may revise the audience/problem statement and strengthen a submission,
but recruiting, sample completion, or a missed target does not block T095 or the
bounded Potential Impact score. The cohort may validate the general problem, but
it cannot prove availability in an area for which the product has no Provider
supply.

### I2 (`SL-I2`). Make “tonight” true without building a marketplace

Keep deterministic 2030 fixtures for automated tests. Add a reset migration that
can project baseline slot times onto an explicit Tokyo service date. Production
reset uses the current Tokyo date; database tests pass a fixed date.

**Files**:

- new `supabase/migrations/004_rolling_demo_service_date.sql`
- extend `supabase/tests/003_demo_controls.test.sql`
- `apps/hub/app/api/demo/reset/route.ts`
- `packages/test-fixtures/src/index.ts` remains deterministic

No cron or public reset endpoint is required. The private pre-demo reset fixes
both repeatability and truthful “tonight” semantics.

### I3 (`SL-I3`). Add only two adjustable constraints behind one disclosure

The default first viewport keeps the same invitation hierarchy and one dominant
action. Add one collapsed `Adjust time & budget` disclosure with accessible
single-select choices. Start time is limited to 18:00, 18:30, or 19:00; budget is
limited to ¥4,500, ¥5,000, or ¥6,000; defaults remain 18:00 plus ¥5,000. Shibuya,
solo, and the 22:30 end boundary stay visible and fixed as the launch scope. Do
not add region, party-size, or real Provider controls in this lane.

The canonical preset matrix is acceptance, not a product aspiration:

| Start | ¥4,500             | ¥5,000                   | ¥6,000             |
| ----- | ------------------ | ------------------------ | ------------------ |
| 18:00 | at least one route | canonical route succeeds | at least one route |
| 18:30 | honest no-result   | exactly 2 routes         | exactly 3 routes   |
| 19:00 | honest no-result   | honest no-result         | honest no-result   |

**Files**:

- `apps/hub/components/product/mood-prompt.tsx`
- `apps/hub/components/product/hub-client.tsx`
- `apps/hub/components/product/product-view.tsx`
- `apps/hub/components/product/provider-strip.tsx`
- `apps/hub/components/product/journey.tsx`
- `apps/hub/components/product/types.ts`
- `apps/hub/tests/components/product-ui.test.ts`
- `packages/bundle-engine/src/index.test.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/visual.spec.ts`

The same intent object drives the human button and the `find_serendipity_options`
tool. Do not create a second agent-only set of constraints.

**UI invariants**:

- one dominant action;
- unchanged default action count;
- disclosure closed by default;
- no horizontal overflow at canonical widths/200% text;
- complete keyboard and screen-reader labels;
- selected constraints appear in the result summary and receipt context.
- generic identity uses neutral `Three Provider sites` wording;
- the manual notice says availability came through Provider APIs and that no Site
  Tool call occurred;
- `Connecting` never appears simultaneously with operation `Ready`;
- temporary demo/no payment/no real booking is visible before Hold;
- alternatives keep stable Route 1/2/3 labels and expose time, price, travel, and
  activity titles without renumbering.

Changing a preset makes no request until the existing plan action. Human clicks
and Site Tool actions continue through the same validated `Intent` contract and
shared controller. T095 now passes IMP-003 and UI-028–032 in code, browser tests,
the fixed-production preset matrix, and the post-deploy reliability recheck.

### I4 (`SL-I4`). Optional supporting usability research

Optionally run five fresh unmoderated sessions after implementation.

| Outcome                                                  | Gate        |
| -------------------------------------------------------- | ----------- |
| Unaided receipt completion                               | ≥4/5        |
| Median completion time                                   | ≤90 seconds |
| Median dominant clicks                                   | ≤4          |
| Median backtracks/misclicks                              | ≤1          |
| Understand 3 independent sites/temporary hold/no payment | ≥4/5        |
| Understand Site Tool vs manual fallback                  | ≥4/5        |
| Single Ease Question                                     | ≥6/7 median |
| Planning time or cross-site steps vs baseline            | ≥50% lower  |

Record anonymized task metrics and short paraphrased findings; do not invent
testimonials or business outcomes. Passing results may strengthen the impact
story, but study completion is not required to implement or release T095 and is
not an internal Potential Impact score gate. The required 20–22 evidence is the
rolling-date demo, exact preset fixture matrix, automated accessibility/clarity
acceptance, production reliability, and bounded Shibuya-only claims.

### I5 (`SL-I5`). Make geographic expansion data-backed, not cosmetic

The general audience positioning does not authorize another live area. Keep
`area: "shibuya"` in version 1 and define a versioned area data-pack boundary for
future supply expansion.

Each candidate pack must include:

- stable area slug, IANA timezone, currency, and localized boundary copy;
- exactly three independently deployed exact-origin Providers under the current
  three-stop contract;
- location nodes and a complete directed travel-time matrix;
- supported service window and a deterministic feasible three-stop fixture;
- reset baseline/capacity plus contract, bundle, security, and E2E evidence.

**Exposure gate**:

1. An incomplete pack fails schema validation and makes zero Provider calls.
2. A complete pack stays dark until exact-origin headers, feasible bundle,
   protected reset, reliability, and one production journey pass.
3. The UI gains a region selector only after a second pack passes every gate.
4. Marketing, tool metadata, and the demo name only areas that have passed.

This creates a credible version 2 path from a Shibuya network to other dense urban areas
without spending the hackathon on unsupported inventory or pretending that a
dropdown is geographic coverage. Region selection, party sizes above one, and
third-party/real Provider onboarding remain version 2 work; they are not part of
T095.

## 7. Dependency order and stopping rules

```text
W1 architecture decision
  → W2 top-level tools
    → W3 truthful proof
      → W4 automated preview gate
        → E1 reset/repeatability
          → E2 hnd1 + deadlines
            → I2 rolling service date
              → I3 minimal constraints
                → I3 automated IMP-003/UI-028–032 acceptance
                  → E3 reliability + W4 real-model gate
                  → E5 submission package/video

I1/I4 optional human research may run independently
I5 area-pack contract → version 2 expansion remains dark
```

Parallel work allowed:

- I1/I4 interviews may start at any time and never block required work.
- I5 contract design does not depend on participant recruitment, but no second
  area may be exposed during the first launch slice.
- E4 accessibility fixes can run beside E2 after shared Hub-client changes land.
- E5 README draft can start after W1, but final screenshots and instructions wait
  for the production architecture.

Stop conditions:

1. If eligible Sol/Terra still exposes no Site Tools after three documented
   attempts, stop the WebMCP 20+ claim and resolve account/app rollout. Continue
   the independently authorized T095 automated UX slice; do not conflate its
   evidence with real Site Tools evidence.
2. If `hnd1` does not improve tail latency, keep the better measured deployment
   and profile the exact request; do not add caching or multi-region by instinct.
3. If the T095 nine-case fixture matrix, accessibility checks, clarity copy, or
   stable route-label tests fail, keep T095 open and repair the implementation;
   do not weaken the expected outcomes.
4. If any reliability run leaves an orphan hold or unknown confirmation, stop
   the 20-run sequence, reset, repair, and preserve the failed evidence.

## 8. Timebox

| Slice                                          |                Focus time |
| ---------------------------------------------- | ------------------------: |
| W1–W3 top-level tool path and truthful proof   |                 6–8 hours |
| W4 automated tests and preview                 |                 3–4 hours |
| E1–E2 reset, region, and timeouts              |                 4–6 hours |
| I2–I3 rolling date and minimal constraints     |                 5–7 hours |
| E3/E4 reliability and accessibility            |                 6–8 hours |
| Optional I1/I4 human research                  | 4–6 hours plus recruiting |
| I5 area data-pack contract/future gate         |                 1–2 hours |
| E5 clean repository, rehearsal, and video      |                 5–7 hours |
| **Required focused implementation/validation** |           **30–42 hours** |

Execution alone can reach 21–22 in roughly 14–20 hours. The full 87-point target
requires real Site Tools availability plus the required production and
automated/synthetic T095 evidence. Human participants are optional supporting
research and are not part of the required estimate.

## 9. Current approved slice

W1–W2, the automated W3/W4 foundation, E1–E2, and T095 are complete. The
remaining required gates are the real W3/W4 Site Tools evidence tasks
T082/T085/T089/T090. T093/T096 may continue independently as optional research
and do not delay the completed T095 slice.

Expected first-slice result:

- exactly five top-level Hub Site Tools;
- product and manual flows share one action controller;
- proof distinguishes Site Tool from fallback;
- Chrome iframe diagnostics remain intact;
- private reset is ready;
- Shibuya remains the only live area while the product narrative addresses the
  broader urban spontaneous-planning problem;
- T095 offers only the exact closed presets, preserves the canonical default,
  and proves its nine outcomes and clarity rules automatically;
- region, party-size, and third-party/real Provider controls remain version 2;
- no additional production confirmation is run until the preview and reset
  gates pass.

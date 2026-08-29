# Research and Compatibility Baseline: Serendipity Network

**Status**: Current as of 2026-08-28  
**Purpose**: Record unstable external facts and the decisions they drive. Product behavior belongs in `spec.md`; this file is evidence for the technical plan.

## R-001 — Site Tools target environment

Official OpenAI documentation describes Site Tools as ChatGPT's implementation of the proposed WebMCP standard. The documented clients are ChatGPT Work and Codex in the ChatGPT desktop built-in browser. The same page currently recommends GPT-5.6 Sol or Terra, states that Luna has WebMCP disabled, excludes Enterprise/Edu, and warns that availability depends on rollout.

**Source**: [OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp)

**Decision**:

- The acceptance target is Codex in the latest ChatGPT desktop app using Sol or Terra.
- ChatGPT acceptance uses tools registered by JavaScript in the top-level Hub
  document; descendant-frame registrations are not part of that acceptance path.
- Chrome is a diagnostic environment, not evidence that the OpenAI client path works.
- Account/model availability is a release preflight item, not an application bug.

## R-002 — Standard maturity and change isolation

The WebMCP document is a Community Group draft and explicitly is not a W3C Standard or on the W3C Standards Track. The draft exposes `Document.modelContext`, imperative registration, tool discovery, execution, cancellation, origin exposure, and a permissions policy.

**Source**: [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/)

**Decision**:

- Every direct WebMCP call lives in `packages/webmcp`; application code depends on an internal adapter.
- Phase 0 is a release gate and produces a checked compatibility record.
- A failing compatibility gate selects the documented direct-provider fallback rather than delaying all feature work.

## R-003 — Cross-origin discovery is intentionally supported

The current draft and Chrome guide support discovery of descendant-frame tools from explicit secure origins. A cross-origin frame must receive the `tools` permissions policy, the Provider must expose the tool to the exact Hub origin, and the Hub must request the Provider through `fromOrigins`.

**Sources**: [Chrome imperative WebMCP guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [WebMCP draft](https://webmachinelearning.github.io/webmcp/)

**Decision**:

- Provider cards remain real `/embed` iframes for visible origin proof and Chrome
  cross-origin capability diagnostics.
- Production and fixed staging origins are allowlisted exactly.
- Wildcards and arbitrary Vercel preview origins are not used for integration acceptance.
- This Chrome/draft capability does not imply that ChatGPT discovers iframe tools;
  R-013 records the narrower production-client behavior.

## R-004 — `executeTool` input-shape compatibility risk

The current draft IDL defines `executeTool(RegisteredTool, object, options)` and serializes the object. The current Chrome guide still demonstrates passing a JSON string. This is an externally visible compatibility discrepancy during an evolving origin trial.

**Sources**: [WebMCP draft ModelContext interface](https://webmachinelearning.github.io/webmcp/#modelcontext), [Chrome imperative WebMCP guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api)

**Decision**:

- Phase 0 pins the actual accepted shape for each target client using a read-only diagnostic tool.
- Production uses one configured shape through the adapter.
- A state-changing call is never retried automatically with another encoding.
- Contract validation remains independent of the transport encoding.

## R-005 — Origin isolation and lifecycle

Chrome documents that WebMCP is available only to origin-isolated documents and is disabled when `document.domain` is enabled, including through `Origin-Agent-Cluster: ?0`. The draft also tracks execution cancellation and cleanup when caller or target documents unload.

**Sources**: [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp), [WebMCP draft](https://webmachinelearning.github.io/webmcp/)

**Decision**:

- Hub and Providers send `Origin-Agent-Cluster: ?1` and never set `document.domain`.
- Provider reload/navigation invalidates cached tool references.
- The Hub listens for `toolchange` and also rediscovers before every side-effecting orchestration.

## R-006 — Tool metadata and results are untrusted

OpenAI documents that website-provided tool definitions and results are untrusted and that browser safety checks do not make a site trustworthy. Chrome security guidance similarly treats tool metadata, external content, and side effects as security boundaries.

**Sources**: [OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp), [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

**Decision**:

- Provider results are validated with Ajv even though the demo controls the seed data.
- Search and status tools use `readOnlyHint`; cross-origin Provider tools use `untrustedContentHint`.
- Tool descriptions are short, factual, and free of instructions unrelated to their operation.
- Business errors are returned as a structured envelope; secrets and raw prompts are excluded.

## R-007 — Deterministic tests and agent evals are both required

Chrome's evaluation guidance separates deterministic function/UI tests from probabilistic agent selection tests and recommends testing tool choice, parameters, results, and page changes.

**Source**: [Chrome WebMCP eval guidance](https://developer.chrome.com/docs/ai/webmcp/evals)

**Decision**:

- The matrix has contract/unit/integration/E2E tests plus a small prompt-based agent suite.
- Agent evals cannot substitute for database concurrency or compensation tests.
- A 3/3 consecutive-run criterion is used for the hackathon compatibility gate; it is evidence, not a claim of general model determinism.

## R-008 — Next.js application boundary

Next.js Route Handlers use `route.ts` files inside the `app` directory and support the required HTTP methods. Browser-only `document.modelContext` remains inside Client Components.

**Source**: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

**Decision**:

- Server Components render shells and bootstrap data.
- Client Components own WebMCP registration and visible workflow state.
- Provider API access, secrets, and database functions stay in Route Handlers/server modules.

## R-009 — One repository can back multiple origins

Vercel supports multiple projects from one monorepo, with each project configured to a root directory and receiving its own domain. Shared packages outside a project root are supported by the monorepo build configuration.

**Sources**: [Vercel monorepos](https://vercel.com/docs/monorepos), [Vercel monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq)

**Decision**:

- One Hub project points to `apps/hub`.
- Three Provider projects point to `apps/provider` and differ by `PROVIDER_SLUG` and fixed origin configuration.
- Cross-origin acceptance runs on fixed staging or production domains.

## R-010 — Database-side invariants

Supabase is managed Postgres, supports database functions, and recommends explicit RLS/grants for exposed tables. Browser clients do not need direct table writes for this product.

**Sources**: [Supabase database overview](https://supabase.com/docs/guides/database/overview), [Supabase database functions](https://supabase.com/docs/guides/database/functions), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

**Decision**:

- Capacity mutation, hold expiry, release, and confirmation use database functions and transactions.
- Browser roles receive no direct mutation grants to inventory or hold tables.
- The service-role key exists only in Provider and Hub server environments.
- pgTAP covers constraints, idempotency, expiry, and concurrency-sensitive transitions.

## R-011 — Historical browser-agent visibility assumption

The draft defines `getTools({ fromOrigins })` for in-page agents, but says a browser's own agent uses a different internal observation mechanism whose exact tool-map presentation is implementation-defined. `exposedTo` is therefore not a reliable way to promise that the ChatGPT browser agent will see only the five Hub tools while ignoring descendant Provider tools.

**Source**: [WebMCP draft interaction with agents](https://webmachinelearning.github.io/webmcp/#interaction-with-agents)

**Decision**:

- Provider tools use unique Provider-prefixed names and narrow metadata so they do
  not overlap with whole-evening Hub operations in the Chrome diagnostic harness.
- Phase 0 records the actual inventory exposed by each diagnostic runtime.
- This was the working assumption when T019 selected `direct`; it remains part of
  the historical Chrome decision and is superseded for the ChatGPT production
  surface by the explicit limitation in R-013.

## Resolved architecture questions

| Question                                                             | Resolution                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Does Phase 0 need Supabase?                                          | No. It uses in-memory deterministic fixtures.                                       |
| Are three Provider codebases needed?                                 | No. One Provider app is deployed three times.                                       |
| Can the Hub rely only on WebMCP?                                     | No. Manual mode uses a server-to-server HTTP Provider gateway.                      |
| Are Provider iframe results trusted because we own them?             | No. Cross-origin results are validated and annotated as untrusted.                  |
| Can mutation calls try both JSON-string and object encodings?        | No. Phase 0 pins one encoding; mutation calls never probe by retry.                 |
| Does recovery automatically hold a replacement?                      | No. It presents an unheld replacement and asks again.                               |
| Is confirm rollback implemented?                                     | No. Unknown outcomes are reconciled; cancellation after confirmation is a non-goal. |
| Is Realtime required?                                                | No. Add it only if the optional cancellation animation needs it.                    |
| Can `exposedTo` hide Provider tools from the built-in browser agent? | Not relevant to the ChatGPT judge path: iframe tools are not discovered.            |
| Is the product available outside Shibuya today?                      | No. Shibuya is the sole launch network; broader urban need is the target problem.   |

## Remaining external uncertainties

- Site Tools rollout and account entitlement at recording time.
- Whether the production demo account exposes the five top-level Hub tools.
- The exact WebMCP execution input shape in a future shipped desktop runtime;
  the production Hub registers callbacks and does not call `executeTool` itself.

These are contained by direct mode, manual HTTP parity, and the production preflight.

## R-012 — Phase 0 runtime findings, 2026-08-27

Chrome 151.0.7922.174 with the WebMCP testing features enabled passed the local
15-spec harness three consecutive times. Nested Hub callbacks successfully
discovered and executed both exact-origin Provider read and mutation tools.

Observed compatibility facts:

- `executeTool` accepted JSON-string input and rejected object input in the
  read-only probe. The provisional pinned encoding is therefore `json-string`.
- Chrome 151 sometimes invoked a registered tool callback without the documented
  second options object. The adapter types and Provider callback tolerate an
  absent options argument; caller-side timeout still fails closed.
- `getTools({ fromOrigins })` returned other same-origin tools as well as the
  requested cross-origin tool set. Exact name/origin filtering remains mandatory.
- The fixed-HTTPS harness initially exposed a test race: Hub registration could
  complete before Provider iframe registrations. Waiting for each expected
  Provider state removed the race, after which all 15 specs passed 3/3.
- Codex in-app browser exposed no `document.modelContext` on either the localhost
  or fixed-HTTPS Hub in three runs each.
- A bounded T019 recheck verified the active model as `gpt-5.6-sol` and again found
  no `document.modelContext` in three fixed-HTTPS loads. Hub and both Providers
  visibly entered their unsupported state.

T019 therefore selected `WEBMCP_COMPOSITION_MODE=direct`. This is the specified
fallback, not a claim about general Site Tools availability. Provider tools keep
unique names for future supported clients, while the ordinary product path remains
usable through the server-side HTTP gateway.

## R-013 — ChatGPT does not discover iframe tools

The official
[OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp) states
that ChatGPT's built-in browser currently does not discover tools registered in
iframes, including both same-origin and cross-origin frames. It directs sites to
register JavaScript tools in the top-level page. The same document distinguishes
this supported subset from the broader WebMCP specification and Chrome developer
surface.

**Decision**:

- The production judging surface is exactly five JavaScript tools registered in
  the top-level Hub document: `find_serendipity_options`, `show_bundle`,
  `hold_bundle`, `confirm_bundle`, and `release_bundle`.
- Those callbacks reuse the Hub's validated workflow routes and server-side
  Provider orchestration. They do not discover or execute Provider iframe tools.
- The fifteen Provider tools and seven direct coordination tools remain useful
  Chrome cross-origin diagnostics. `allow="tools"` is retained for that diagnostic
  surface only and is never cited as evidence of ChatGPT compatibility.
- T019 remains a truthful record of the 2026-08-27 Phase 0 experiment. The new
  top-level production path is an evolution based on a subsequently confirmed
  client limitation, not a retroactive change to the Phase 0 result.
- Manual UI actions and top-level Site Tools share the same server workflow, while
  their activity labels remain distinct.

## R-014 — General audience, bounded launch network

The underlying problem is not unique to one neighborhood: an urban resident or
visitor with an unexpectedly free evening must reconcile time, budget, travel,
and live capacity across independent venue sites. Geographic availability is a
separate product fact.

**Decision**:

- The target audience is **urban spontaneous evening planners**. The initial
  validation cohort may include residents, workers, and visitors.
- Shibuya remains the only supported and evidenced launch network. Product copy,
  tool schemas, demos, and score claims must not imply that Shinjuku, another
  Tokyo area, or another city is live.
- An unsupported area receives an honest boundary response and causes no Provider
  call or inventory mutation. The launch UI does not show a region selector.
- Future geography is added as a versioned **area data pack**, not through ad hoc
  conditionals. A pack must define its area slug, timezone/currency, exactly three
  exact-origin Providers under the current three-stop contract, locations,
  complete directed travel matrix, service window, feasible deterministic
  fixture, and localized boundary copy.
- A pack is not exposed until schema compatibility, origin/security checks,
  bundle feasibility, reset/reliability, and at least one end-to-end production
  journey pass for that area. A second visible area therefore requires real
  supply and evidence, not only a new dropdown value.

# Serendipity Network

Serendipity Network turns an unexpectedly free evening into one compatible
route across three independent venue sites. A person or agent can find a
workshop, food stop, and cultural stop that fit one time window and budget,
temporarily hold all three, and confirm only after the complete route is safe.

The broader problem applies to urban residents, workers, and visitors who do
not want to reconcile live availability across many sites. The current working
network is deliberately narrower: **Shibuya, one person, tonight, three demo
Providers, and no payment**. Other cities are not offered until they have real
Provider origins, complete travel data, feasible inventory, and the same safety
and reliability evidence.

**Live site:** <https://serendipity-phase0-hub.vercel.app>  
**Direct planner and judged Site Tools surface:**
<https://serendipity-phase0-hub.vercel.app/plan>

## 30-second judge path

1. Open the [live planner](https://serendipity-phase0-hub.vercel.app/plan).
2. If the browser exposes Site Tools, ask: **“Find a surprising evening in the
   supported Shibuya network and show the best route. Do not hold or confirm
   anything.”** The page should visibly move to a three-stop result, while the
   activity disclosure labels the call `Site tool`.
3. If the yellow banner says that WebMCP is unavailable, choose a mood and press
   **Plan my night**. This exercises the same Hub orchestration and three real
   Provider APIs, but the disclosure correctly labels it `Manual fallback`; it
   is a product fallback, not evidence that WebMCP ran.
4. Expand the proof disclosure—**See WebMCP in action** or **See the live site
   architecture**, depending on browser support—to inspect safe origin,
   duration, timestamp, correlation, and source information.

For the complete reversible flow, continue with **Hold for 90 seconds**, then
**Confirm demo reservation**, review the decision dialog, and choose **Confirm
demo route**. A successful receipt contains one safe reference
from each Provider. These are synthetic demo reservations and no money is
charged. The protected inventory reset is operator-only and is not a judge
action.

## Live sites

| Role                   | Fixed production origin                          |
| ---------------------- | ------------------------------------------------ |
| Consumer landing       | <https://serendipity-phase0-hub.vercel.app>      |
| Hub planner/Site Tools | <https://serendipity-phase0-hub.vercel.app/plan> |
| Kiln workshop Provider | <https://serendipity-phase0-kiln.vercel.app>     |
| Nori food Provider     | <https://serendipity-phase0-nori.vercel.app>     |
| Loop culture Provider  | <https://serendipity-loop.vercel.app>            |

Every allowlist uses these exact origins; no wildcard Provider or framing origin
is accepted.

## What WebMCP does here

The top-level Hub document registers exactly five product Site Tools:

| Tool                       | Inventory effect | Purpose                                                                           |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `find_serendipity_options` | Read-only        | Query all three Providers and compose feasible routes.                            |
| `show_bundle`              | Read-only        | Select and explain one current candidate.                                         |
| `hold_bundle`              | Mutation         | Hold every stop, compensating successful partial holds if another Provider fails. |
| `confirm_bundle`           | Mutation         | Confirm the active holds and reconcile unknown outcomes before issuing a receipt. |
| `release_bundle`           | Mutation         | Release active holds without rolling back a confirmed reservation.                |

Human buttons and Site Tools call one product action controller and the same
server workflows. Business rules are not duplicated in prompts or browser
callbacks.

The embedded Provider documents also expose origin-owned tools for the Chrome
cross-origin compatibility harness. ChatGPT's built-in browser does not discover
tools inside iframes, so those diagnostic tools are not presented as the judged
path. The five top-level Hub tools are the ChatGPT path.

```text
ChatGPT Site Tool or human button
  -> shared Hub action controller
    -> same-origin Hub workflow route
      -> Kiln, Nori, and Loop HTTPS APIs in parallel
        -> Supabase transaction functions
      -> pure bundle composition and compensation/reconciliation
  -> visible Hub result, proof, hold state, or receipt
```

## Repository map

```text
apps/hub/                  Top-level product, Site Tools, and orchestration APIs
apps/provider/             One origin-owned Provider app deployed three times
packages/contracts/        JSON Schemas, validators, and public envelopes
packages/bundle-engine/    Deterministic route feasibility and ranking
packages/webmcp/           Draft-runtime adapter and lifecycle handling
supabase/                  Schema migrations, seed inventory, and pgTAP tests
tests/                     Browser, accessibility, security, and visual suites
specs/001-serendipity-network/  Product contract, test matrix, and evidence
```

The detailed architecture and tool contracts live in
[`plan.md`](specs/001-serendipity-network/plan.md) and
[`webmcp-tools.md`](specs/001-serendipity-network/contracts/webmcp-tools.md).

## Run locally

### Prerequisites

- Node.js 20.9 or newer
- pnpm 11.19.0 (the repository pins it through `packageManager`)
- Docker or another Supabase-compatible local container runtime

Install the locked dependency graph, then start and seed local Supabase:

```bash
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:reset
pnpm exec supabase status --output env
```

Copy `.env.example` to `.env.local`. Map the local status output's `API_URL` to
`SUPABASE_URL` and `SECRET_KEY` to `SUPABASE_SECRET_KEY`. Generate independent
local-only values for signing secrets and a 32-byte base64url encryption key;
never reuse production values.

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

At minimum, the database-backed full flow needs these server-only values:

| Variable                       | Requirement                                            |
| ------------------------------ | ------------------------------------------------------ |
| `SUPABASE_URL`                 | Local API origin from `supabase status`.               |
| `SUPABASE_SECRET_KEY`          | Local secret key; never prefix it with `NEXT_PUBLIC_`. |
| `HOLD_TOKEN_SECRET`            | Independent random value of at least 32 bytes.         |
| `PROVIDER_ACCESS_TOKEN_SECRET` | Independent random value of at least 32 bytes.         |
| `HUB_INTERSERVICE_SECRET`      | Shared only by Hub and Providers; at least 32 bytes.   |
| `BUNDLE_ENCRYPTION_KEY`        | Exactly 32 random bytes encoded as base64url.          |

The checked-in example supplies safe local origins. `DEMO_MODE` should remain
`false` for ordinary development. `DEMO_OPERATOR_SECRET` is required only for
the protected reset path.

Load the local values into the shell, leave `PROVIDER_SLUG` unset so the launcher
can assign a distinct identity to each Provider, and start all four sites:

```bash
set -a
source .env.local
set +a
unset PROVIDER_SLUG
pnpm dev:phase0
```

Open <http://localhost:3100>. Kiln, Nori, and Loop run on ports 3101, 3102, and
3103 respectively.

### Migrations and seed

`pnpm db:reset` recreates the local database, applies every file under
`supabase/migrations/` in order, and applies `supabase/seed.sql`. The committed
2030 fixtures remain deterministic for tests; the protected production reset
projects those fixture times onto the current Tokyo service date.

Production linking, migration pushes, reset credentials, and deployment are
operator actions. They are intentionally omitted from the judge path and must
not be run against an unverified project.

## Verify

The credential-free CI gate is:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Local Supabase adds the database and live Provider API gates:

```bash
pnpm db:lint
pnpm db:test
pnpm test:provider-api:local
```

Browser suites are explicit because they need their documented local or deployed
environment:

```bash
pnpm test:phase0
pnpm test:a11y
pnpm test:security
pnpm test:visual
```

See the [verification evidence](specs/001-serendipity-network/evidence/score-lift-implementation.md)
for the latest measured run. Mocked or Chrome-only Site Tool tests do not count
as a real ChatGPT Sol/Terra completion.

## Safety properties

- Search and route presentation are read-only; hold, confirm, and release are
  separately annotated mutations.
- Every public input and output is schema-validated, size-bounded, and returned
  in a shared safe envelope.
- Mutation idempotency keys are operation-scoped, hashed before persistence, and
  never returned in activity or tool output.
- Hold tokens stay at their owning boundary. Server-orchestrated tokens are
  encrypted with AES-256-GCM before session persistence.
- A partial multi-Provider hold triggers compensation. Unknown outcomes are
  reconciled before the UI claims success; unresolved cases fail closed.
- Provider requests have a five-second internal deadline distinct from caller
  cancellation.
- Server credentials never use `NEXT_PUBLIC_`; public assets and runtime output
  have dedicated secret scans.
- The production reset requires demo mode, an explicit operator opt-in, a
  separate 32-byte secret, and the fixed Hub origin.

## Known limits

- Shibuya is the only supported launch network. The general urban use case is a
  product direction, not a multi-city availability claim.
- The experience is currently solo, uses three synthetic Providers and seeded
  inventory, and does not take payment or contact real venues.
- The default product exposes mood selection plus one closed time/budget
  disclosure. Location, party-size, and marketplace controls remain version 2.
- Browser support for the draft Site Tools surface varies. The UI falls back to
  manual orchestration and labels that source honestly.
- Automated Site Tool and synthetic QA evidence is labeled honestly. Optional
  human research remains documented in the
  [readiness audit](specs/001-serendipity-network/evidence/hackathon-readiness-audit.md)
  but is not a submission or implementation prerequisite.

## Submission status

The live deployment exists. A public repository URL with an owner-selected
open-source license and a public demo video under three minutes remain official
submission gaps. Real Sol/Terra completion is not needed for basic app operation
or eligibility, but it is required for the remaining Site Tools tasks and a
defensible WebMCP Leverage score above 20. No license is implied by the current
repository contents.

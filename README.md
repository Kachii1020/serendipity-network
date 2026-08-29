# Serendipity

Serendipity turns a free afternoon or evening in Shibuya into one route a
person can actually inspect and follow. Choose a date, time window, reference
budget, interests, and walking limit. The planner returns two or three real
places with published hours, reference prices, coordinate-based walking
estimates, field-level evidence, and official links.

It does **not** claim live availability, complete a booking, or contact a venue.
Every result says so before the user saves or leaves the site.

**Live product:** <https://serendipity-phase0-hub.vercel.app>

**Planner and judged Site Tools:**
<https://serendipity-phase0-hub.vercel.app/plan>

**Public source:** <https://github.com/Kachii1020/serendipity-network>

## 30-second judge path

1. Open the [planner](https://serendipity-phase0-hub.vercel.app/plan).
2. In a WebMCP-enabled browser, ask:
   **“I am solo at Shibuya Station from 17:00 to 22:00. Keep it under ¥5,000;
   I want art, books, and somewhere quiet. Build one plan and show the price
   source for the first stop.”**
3. The agent calls `find_evening_plan`; the same page renders one sourced
   two- or three-stop route. `show_place_evidence` opens the cited identity,
   address, hours, price, and official-link claims.
4. Ask **“Swap the last stop for a different interest, then save the plan.”**
   `swap_plan_stop` changes one stop and visibly summarizes price, walking, and
   downstream-time changes. `save_plan` stores a bounded snapshot in this
   browser only.

Without WebMCP, the visible controls run the same validated controller. The
small `Manual controls` label is a capability status, not a claim that an agent
ran.

## What the result means

- **Places are real:** the ACTIVE Shibuya pack contains nine municipal or
  public cultural, library, park, botanical, and activity locations.
- **Sources are explicit:** every identity, address, hours, price, coordinate,
  and official link is backed by CC BY 4.0, CC0, or Shibuya City's compatible
  reuse terms.
- **Prices are references:** only the listed admission or activity is counted.
  Transport, food, optional purchases, and live inventory are excluded.
- **Walking is an estimate:** licensed coordinates are converted using a 1.25
  route factor, 75 metres per minute, rounded up to five minutes. It is not
  turn-by-turn navigation.
- **Freshness is bounded:** data is checked within seven days before ACTIVE
  promotion, warned after 14 days, and excluded after 60 days.
- **No filler:** when interests are supplied, every stop must match at least one
  of them. Otherwise the planner returns an honest no-result.

The initial pack deliberately excludes private commercial venues whose reuse
rights, trademark permission, current price, or schedule could not be defended
within the hackathon window.

## WebMCP surface

The top-level `/plan` document registers exactly five tools:

| Tool                  | Effect           | Purpose                                                   |
| --------------------- | ---------------- | --------------------------------------------------------- |
| `find_evening_plan`   | Read-only        | Compose the best current source-backed route.             |
| `show_place_evidence` | Read-only        | Reveal the claims and sources behind one stop.            |
| `swap_plan_stop`      | Read-only        | Replace exactly one stop while retaining all constraints. |
| `save_plan`           | Browser mutation | Save a validated plan and evidence snapshot locally.      |
| `delete_saved_plan`   | Browser mutation | Idempotently remove one local snapshot.                   |

Human controls and Site Tools call the same five controller methods. Tool
wrappers only validate input, current state, output safety, and size. They do not
contain a second copy of the planning rules.

```text
human form or top-level Site Tool
  -> shared PlannerClient controller and operation lock
    -> v2 search / swap / evidence route
      -> validated, versioned Shibuya source pack
      -> deterministic 3-stop, then 2-stop composer
    -> the same visible plan, evidence, swap summary, or local save state
```

Search and swap are stateless on the server. A swap carries the current public
plan snapshot; the engine deterministically reconstructs and rejects any stale
or modified snapshot before replacing one stop. No runtime scraping, map API,
Provider call, Supabase query, account, or PII is involved in v2.

## Repository map

```text
apps/hub/                         Product UI, v2 APIs, Site Tools, source pack
packages/contracts/planner-v2     Parallel schema v2; v1 contracts unchanged
packages/bundle-engine/planner-v2 Deterministic 2–3 stop composition and swap
packages/webmcp/                  Tool registration and lifecycle adapter
specs/002-source-backed-evening-planner/ Product, data, test, and task contract
tests/e2e/planner-v2.spec.ts       Product/WebMCP/mobile/accessibility journey
```

The original distributed reservation network remains available, unlinked and
`noindex`, at `/legacy/network-demo`; its Phase 0 harness remains at `/phase0`.
Its Provider apps, Supabase schema, compensation logic, and reliability evidence
were not deleted or relabeled as the new consumer product.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm 11.19.0. CI and production use
Node.js 24.

```bash
pnpm install --frozen-lockfile
pnpm --filter @serendipity/hub dev
```

Open <http://localhost:3100>. The v2 planner needs no credentials, database, or
external API. To run the archived four-origin reservation demo as well, start
its documented local Supabase environment and use `pnpm dev:phase0`.

## Verify

```bash
pnpm audit:sources       # rights, evidence references, HTTPS, ACTIVE pack
pnpm test:v2             # contracts, pack, engine, APIs, tools, state, storage
pnpm test:v2:browser     # UI, exact five tools, a11y, mobile, 400% reflow
pnpm test:v2:release     # 20 sequential read-only canonical searches
pnpm test:security       # public assets, headers, legacy and v2 runtime safety
pnpm check               # format, lint, 8 typechecks, all unit/integration tests
pnpm build               # all eight workspace builds
```

The archived v1 browser gates remain executable:

```bash
pnpm test:phase0
pnpm test:a11y
pnpm test:visual
```

## Safety and privacy

- Tool and API inputs are exact-schema validated; request bodies are capped at
  16 KiB and public results at 64 KiB.
- External URLs are predeclared HTTPS sources. The server accepts no arbitrary
  URL and performs no runtime external fetch.
- Public envelopes contain bounded correlations and normalized errors, never
  tokens, cookies, credentials, raw HTML, or hidden instructions.
- Saved plans are explicit, local-only, capped at ten records and 256 KiB, and
  contain only the normalized intent, public plan, public evidence, and save
  time. Corrupt storage is preserved and reported rather than overwritten.
- Search and swap fail closed under concurrent or stale operations. A failed
  evidence, swap, save, or delete never removes the displayed plan.
- Official links require an explicit user click and use `noopener noreferrer`.

## Data and code licenses

Code is released under the [MIT License](LICENSE). The curated source pack and
its attribution obligations are documented separately in
[DATA-LICENSE.md](DATA-LICENSE.md). The app uses original text summaries and no
third-party venue photos or logos.

## Known limits

- Shibuya only; solo only; dates from today through seven days ahead.
- Published regular hours may not contain holidays or same-day closures. Users
  must recheck the official page before travelling.
- Coordinate walking estimates do not account for crossings, construction,
  accessibility, stairs, or station exits.
- The initial rights-clear pack is strongest for culture, books, quiet,
  hands-on, and outdoor interests. Unsupported music, food, coffee, or shopping
  requests return no-result rather than unrelated recommendations.
- Browser support for draft Site Tools varies. The manual UI remains fully
  functional and labels that mode honestly.

## Submission status

The product, public GitHub repository, dated Git history, GitHub-detected MIT
license, source-rights audit, and live Vercel deployment are present. A public
YouTube demo under three minutes remains the final account-owner submission
action until its URL is recorded.

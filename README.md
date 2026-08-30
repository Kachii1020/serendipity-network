# Serendipity

Serendipity v3 builds a source-backed Tokyo plan for one to three adults. Pick
Shibuya, Shinjuku, or Ikebukuro; choose a time window, per-person budget,
interest, and whether to include a meal. The planner combines two or three real
places, uses official menu prices for the budget, calculates a group estimate,
and links every stop back to published evidence.

It does **not** claim live seats, make a reservation, guarantee a final bill, or
contact a venue. Users must check each official site before they go.

## Release status

v3 is an implementation candidate, not the production product yet.

- **Current production (v2):**
  <https://serendipity-phase0-hub.vercel.app>
- **Current production planner (v2):**
  <https://serendipity-phase0-hub.vercel.app/plan>
- **Current v3 review preview (protected, Google OFF):**
  <https://serendipity-phase0-1llyy24wx-circle-connect123.vercel.app/v3>
- **Public source:**
  <https://github.com/Kachii1020/serendipity-network>

The fixed production URL remains on v2 until one immutable v3 candidate passes
the complete browser/reflow/security/source gate, real supported-client Site
Tools verification, rollback rehearsal, and production reliability run. The
recorded v2 rollback deployment is `dpl_CLfLvnMvXbSVtK1ciH4kc4DvnbS6`.

## What is implemented in v3

- Three ACTIVE area packs: Shibuya, Shinjuku, and Ikebukuro.
- Four activities and three official-menu meals per area.
- Party sizes 1–3, per-person budgets, six interests, meal on/off, and walking
  limits.
- `Activity → Meal → Activity` routes with honest two-stop fallback; meal-off
  routes contain activities only.
- Full-width route output with per-person and group price estimates, walking,
  reasons, official links, evidence, same-role stop replacement, and local save.
- Parallel v3 contracts, deterministic composition, stateless search/swap/
  evidence APIs, and exactly five Site Tools sharing the visible controller.

Restaurant budget decisions use official menus. Transport, optional orders,
taxes or fees not shown by the source, and live availability are excluded.
Walking is a coordinate estimate, not turn-by-turn navigation.

## Try v3 locally

Requirements: Node.js 22.13 or newer and pnpm 11.19.0. CI and production use
Node.js 24.

```bash
pnpm install --frozen-lockfile
pnpm --filter @serendipity/hub dev
```

Open <http://localhost:3100/v3>. A representative path is:

1. Keep **Shibuya**, **1 adult**, **¥4,000 per person**, and the meal enabled.
2. Build the plan and inspect the full-width route, official menu basis, and
   group estimate.
3. Change one stop, open its sources, and save the refreshed plan locally.

The same path works through visible controls when Site Tools are unavailable.
Automated exact-five registration is green; the final 3/3 run in a real
supported Site Tools client remains a release gate.

## WebMCP surface

Only the v3 planner document registers tools. The landing page registers none.

| Tool                  | Effect           | Purpose                                              |
| --------------------- | ---------------- | ---------------------------------------------------- |
| `find_evening_plan`   | Read-only        | Compose and render one plan for a validated intent.  |
| `show_place_evidence` | Read-only        | Open the published evidence behind a current stop.   |
| `swap_plan_stop`      | Read-only        | Replace one stop with another stop of the same role. |
| `save_plan`           | Browser mutation | Save a bounded official-evidence snapshot locally.   |
| `delete_saved_plan`   | Browser mutation | Idempotently delete one local snapshot.              |

Tool wrappers validate input, current state, output, and size. Business logic
stays in the same controller used by the UI.

```text
visible controls or one of five Site Tools
  -> shared v3 controller and operation lock
    -> v3 search / swap / evidence API
      -> reviewed area registry
      -> deterministic meal-aware composer
      -> optional request-scoped Google boundary
    -> the same visible route, evidence, swap, or local save state
```

## Google mode

Google Places enrichment is optional and currently **off** because no approved,
restricted production key is configured. Official-menu planning works without
it. The adapter accepts only pre-reviewed Place IDs, requests a bounded field
set, times out without retry, and discards upstream responses after creating a
safe request-scoped signal.

Google response content is not stored in the source pack, reviewed ledger, or
localStorage. Google-on policy, attribution, quota, security, and production
evidence remain open and do not block an official-source-only release.

Six of nine meals currently have an authoritative pre-reviewed Place ID. The
three remaining meals skip enrichment rather than guessing an ID; the
specification's non-null-ID wording must be reconciled before the final RC.

## Data and evidence

Pack `1.0.0` contains 21 places and 40 source records. The recorded pack gate
passed 9/9 source-audit regressions, 4/4 typed pack tests, 36/36 live source
URLs, and the `3 areas × party 1/3 × meal on/off` engine matrix, 12/12. No
Tabelog data, reviews, ratings, venue photos, or copied descriptions are used.

Detailed source decisions are in
[`specs/003-tokyo-three-hub-meal-planner/evidence/source-pack-1.0.0-ledger.md`](specs/003-tokyo-three-hub-meal-planner/evidence/source-pack-1.0.0-ledger.md).
The current claim boundary is in
[`specs/003-tokyo-three-hub-meal-planner/evidence/rc-status-2026-08-30.md`](specs/003-tokyo-three-hub-meal-planner/evidence/rc-status-2026-08-30.md).

## Repository map

```text
apps/hub/app/v3/                    v3 landing and full-width planner routes
apps/hub/app/api/v3/                search, swap, and evidence endpoints
apps/hub/components/planner-v3/     form, controller, result, and local storage
apps/hub/data/planner-v3/           three reviewed ACTIVE area packs
apps/hub/lib/planner-v3/            registry, boundary, runtime, Google adapter
apps/hub/lib/tools/planner-v3-tools.ts  exact-five Site Tool definitions
packages/contracts/src/planner-v3*  parallel v3 schemas and validators
packages/bundle-engine/src/planner-v3* deterministic composer and replacement
specs/003-tokyo-three-hub-meal-planner/ product, data, tests, tasks, evidence
tests/e2e/planner-v3.spec.ts         focused browser and WebMCP journeys
```

The v2 source planner and original distributed reservation network remain
preserved. Provider apps and the Supabase schema are unchanged.

## Verify

```bash
pnpm audit:sources:v3   # reviewed pack, official menu, rights, drift
pnpm test:v3            # contracts, engine, data, runtime, tools, state, storage
pnpm test:v3:browser    # focused UI, exact-five, accessibility, mobile/reflow
pnpm test:v3:release    # 20 sequential read-only searches against APP_BASE_URL
pnpm check              # format, lint, eight typechecks, all unit/integration
pnpm build              # all eight workspace builds
```

The final RC gate is still pending after the latest UI/reflow corrections. Do
not treat an earlier green count or the early preview as production evidence.

## Safety and privacy

- Requests are exact-schema validated and bounded; responses use normalized v3
  envelopes and `Cache-Control: no-store`.
- Runtime external calls cannot accept a user-provided host or Place ID.
- Public data contains no credentials, raw HTML, ratings, reviews, PII, or live
  availability claims.
- Saved plans use `serendipity.saved-itineraries.v3`, cap records and bytes, and
  contain only intent, immutable official plan/evidence snapshots, reviewed
  Google Place IDs, and save time.
- Official pages require an explicit click and use safe external-link behavior.

## Data and code licenses

Code is released under the [MIT License](LICENSE). Source-pack attribution and
usage limits are documented in [DATA-LICENSE.md](DATA-LICENSE.md). All venue
summaries are original and the app ships no third-party venue photos or logos.

## Known limits

- Only Shibuya, Shinjuku, and Ikebukuro are supported.
- Party size changes group-price arithmetic; it does not claim that seats are
  available for that group.
- Published hours and menu prices can change. Users must recheck official pages.
- Coordinate walking estimates omit station exits, construction, stairs, and
  accessibility conditions.
- Google enrichment stays off until its separate operational gate is approved.
- Reservations, payments, free-form destinations, map navigation, scraping,
  and live seat checks are out of scope.

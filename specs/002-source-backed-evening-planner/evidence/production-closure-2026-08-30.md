# V2 production closure — 2026-08-30 JST

## Current pack 1.3.0 release candidate

**Evidence class:** production runtime and deterministic browser automation. No
human-study or official ChatGPT Site Tools-client claim is made.

- Preview: `dpl_6nozjvuwkaftDEUoeu9GGdZ1uEqQ`, READY. Vercel protection returned
  401 to public fetch; authenticated `vercel curl` verified `/`, search, and
  evidence as HTTP 200 before promotion.
- Production: `dpl_CLfLvnMvXbSVtK1ciH4kc4DvnbS6`, READY in `hnd1`, aliased to
  <https://serendipity-phase0-hub.vercel.app>.
- Provider deployments and Supabase schema changed: **no**.

| Current-candidate gate                | Result                                              |
| ------------------------------------- | --------------------------------------------------- |
| `pnpm check`                          | PASS — 342/342 units, 8/8 typechecks, audit 11/11   |
| `pnpm build`                          | PASS — 8/8                                          |
| Focused v2                            | PASS — 135/135                                      |
| Production v2 browser                 | PASS — 12/12                                        |
| Exact five WebMCP path                | PASS — 3/3 fresh Chrome contexts                    |
| Production read-only reliability      | PASS — 20/20, p95 246ms, max 848ms, 20 correlations |
| Public asset/runtime security         | PASS — 56 assets and 5/5 browser cases              |
| Source audit                          | PASS — 9 routable places, 18 sources, pack 1.3.0    |
| Independent blocking-only code review | PASS — no P0/P1 release blockers                    |

The 320×568 recovery case also verifies that a failed or empty re-search keeps
the previous verified plan and places its explanation inside the viewport.

## Previous deployment record

> **Historical deployment evidence.** This record describes
> `dpl_4LBiYvg2NP1KEq4WLT1Pry1u4C2b` and the product state observed at that
> deployment. It predates the current pack 1.3.0 reviewed-source/data-license,
> strict-date, schedule-calendar visibility, warning-replacement, registration
> rollback, evidence-race, exact-output, and storage-repair closure batch. It is
> retained as regression evidence and does not close current tasks T208 or T209.

**Evidence class:** production runtime, deterministic automation, and non-human
synthetic QA. No human-study claim is made.

## Deployment

- Product: <https://serendipity-phase0-hub.vercel.app>
- Planner: <https://serendipity-phase0-hub.vercel.app/plan>
- Final Hub deployment: `dpl_4LBiYvg2NP1KEq4WLT1Pry1u4C2b`
- Region/status: `hnd1`, READY, HTTP 200
- Immediate prior v2 rollback: `dpl_6mU9LLcpQbNGU2pYzZvqmZBqckRb`
- Original v1 rollback: `dpl_J1mVSFuwhxwVfam9gHyiucMMwwZU`
- Provider deployments and Supabase schema changed: **no**

Production captures:

- [390px landing](production-landing-390.png)
- [1440px sourced plan](production-plan-1440.png)

## Product truth

- ACTIVE pack: 9 real Shibuya places, 16 rights-declared sources.
- Rights: Tokyo/Shibuya CC BY 4.0 or compatible reuse terms; Wikidata CC0.
- External venue images/logos/copied descriptions: 0.
- Runtime scraping, arbitrary URL fetch, Provider calls, Supabase calls: 0.
- Every result stop displays a real name, address, published-hours fit,
  FREE/EXACT/RANGE reference price, coordinate walking estimate, comparison
  date, evidence link, and official handoff.
- Every returned stop matches at least one selected interest; unsupported
  requests return `NO_VALID_PLAN` instead of filler.
- Booking/live availability/discount/partnership claims: 0.

## Verification ledger

| Gate                                 | Result                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| `pnpm check`                         | PASS — 54 files, 260 tests, 8/8 typechecks                  |
| `pnpm build`                         | PASS — 8/8                                                  |
| `pnpm test:v2`                       | PASS — 61/61 after SSR/lightweight-client work              |
| V2 production browser                | PASS — 6/6                                                  |
| Exact five WebMCP path               | PASS — 3/3 fresh contexts                                   |
| Production read-only reliability     | PASS — 20/20, 20 unique correlations, p95 876ms, max 1036ms |
| Production security                  | PASS — 54 public assets, 5/5 runtime/header tests           |
| Source-rights/static audit           | PASS — 9 places, 16 sources                                 |
| Release source URL audit             | PASS — all source/official URLs HTTP 200–399                |
| Preserved v1 Phase 0                 | PASS — 27/27 at `/legacy/network-demo`                      |
| Preserved v1 accessibility           | PASS — 9/9                                                  |
| Preserved v1 visual baselines        | PASS — 12/12, no snapshot changes                           |
| Preserved commercial/UI completeness | PASS — 15/15                                                |

Lighthouse production results:

| Route                 | Perf | A11y | Best Practices | SEO |    LCP |  TBT |     CLS |
| --------------------- | ---: | ---: | -------------: | --: | -----: | ---: | ------: |
| `/`                   |   97 |  100 |            100 | 100 | 2473ms | 16ms |       0 |
| SSR canonical `/plan` |   98 |  100 |            100 | 100 | 2414ms | 14ms | 0.00078 |

The planner initially measured Performance 84, LCP 2743ms, and TBT 407ms.
Moving browser validation to lightweight contract subpaths and server-rendering
the first deterministic result closed the performance gate without weakening
validation or tests.

## Synthetic QA

Five context-isolated visible-UI runs were attempted. Four met their goal and
one failed, satisfying the declared `>=4/5` gate. The failed run exposed that a
Hands-on-only route contained unrelated filler. The engine now requires every
stop to match at least one selected interest, and a regression fixes that rule.

Other synthetic findings and closures:

- raw weekday numbers → human-readable weekday names;
- unexplained swap side effects → visible price/walking/time change summary;
- unexplained early finish → deadline-headroom/no-filler explanation;
- ambiguous reference price → admission/activity-only definition;
- omitted station approach → every stop, including the first, shows its leg;
- OS-localized time fields → deterministic `HH:mm JST` selects;
- Books recovery silently reset → deduplicated query allowlist plus browser test;
- technical WebMCP copy → plain-language AI capability explanation.

Final comprehension in the rerun was source evidence 5/5, reference price 5/5,
no-live/no-booking 5/5, and WebMCP purpose 4/5. These are synthetic QA results,
not human usability evidence.

## Remaining submission actions

- Public repository: <https://github.com/Kachii1020/serendipity-network> —
  public, default branch `main`, GitHub License API detects `MIT`.
- Record and publish the public YouTube demo under three minutes.
  The finished 72.95-second narrated MP4 and exact upload metadata are recorded
  in [youtube-upload.md](youtube-upload.md); browser authentication is the only
  blocker.
- Run the official in-app Site Tools client when the account exposes it; Chrome
  WebMCP is already an allowed and production-verified path.

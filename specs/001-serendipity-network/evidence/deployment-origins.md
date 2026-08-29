# Phase 0 deployment origins

**Status**: Fixed production aliases active and header-verified  
**Vercel scope**: `circle-connect123`

| Role | Project                   | Intended fixed production origin             | Status                         |
| ---- | ------------------------- | -------------------------------------------- | ------------------------------ |
| Hub  | `serendipity-phase0-hub`  | `https://serendipity-phase0-hub.vercel.app`  | READY, production alias active |
| Kiln | `serendipity-phase0-kiln` | `https://serendipity-phase0-kiln.vercel.app` | READY, production alias active |
| Nori | `serendipity-phase0-nori` | `https://serendipity-phase0-nori.vercel.app` | READY, production alias active |
| Loop | `serendipity-loop`        | `https://serendipity-loop.vercel.app`        | READY, production alias active |

Kiln and Nori were first deployed after explicit user approval on 2026-08-27.
Loop and the final product Hub were deployed on 2026-08-28. All four aliases
returned HTTP 200 over HTTPS with `Origin-Agent-Cluster: ?1`.

- The Hub `Permissions-Policy` and `frame-src` list only the fixed Kiln, Nori,
  and Loop origins.
- Each Provider `Permissions-Policy` and `frame-ancestors` list only the fixed
  Hub origin.
- No wildcard origin is present in the tool or iframe policies.

Production environment verification on 2026-08-28:

- Hub and all three Providers use the same server-only inter-service secret;
  each Provider has independent hold-token and scoped-access-token secrets.
- The Hub has an independent AES-256-GCM bundle-encryption key.
- Browser-exposed configuration contains only the four fixed origins, Provider
  slugs, and `json-string` execution encoding.
- Hub `DEMO_MODE=true` exposes only the operator-secret-protected reset route;
  Provider demo cancellation remains disabled.
- Dedicated Supabase project `serendipity-network-prod`
  (`gwluomrqzulnuhpdmucr`, `ap-northeast-1`) is active. Migrations 001–005 and
  the deterministic seed are applied.
- All three Providers have server-only `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` production variables. The values were passed directly
  from the provisioning process and were not printed or stored in evidence.
- The Hub has the same dedicated `SUPABASE_URL` and server-only
  `SUPABASE_SECRET_KEY`; current deployment
  `dpl_7i8KYoyjqzk8CYbKgMhYZjd3712U` is the active production alias.
- Configuration-time Provider failures now return the shared HTTP 500
  `INTERNAL_ERROR` JSON envelope instead of a framework HTML error page; the
  response contains no environment-variable names or secrets.

The first Kiln build failed before application build because Vercel framework
detection requires Next.js metadata in the monorepo root. Adding the same
Next/React versions as root development dependencies resolved detection; the
successful production deployment is the active alias.

Read-only fixed-origin UI verification (2026-08-28): the production Hub and its
three deployed Provider frames pass the accessibility/responsive suite 8/8 and
the runtime header/public-surface security suite 3/3. The mutation-bearing
Phase 0 production matrix was intentionally not run without separate approval;
its equivalent local four-origin matrix passes 15/15.

Post-provision production search verification (2026-08-28): from the fixed Hub
alias, one click on the default `Surprising` mood's `Plan my night` action
changed Kiln, Nori, and Loop from `Ready` to `Found` and rendered
`Tonight got interesting.` with the seeded three-stop ¥4,500 route. Runtime
logs recorded HTTP 200 for Hub `POST /api/manual/search` and all three Provider
`POST /api/slots` requests. The active Provider deployments were
`dpl_JBvVUE32CQ4nA6EXiiJQQfjSELZ1`,
`dpl_67kYfp2j1yh29HuQzmQyCtD9xEL2`, and
`dpl_9Ya8u2YeEyEbDDJa9PuY7pxLaL7Q`.

Authorized production mutation verification (2026-08-28): one fresh-page
manual workflow completed `search → hold → confirm` in approximately 76
seconds. Hub search/hold/confirm and all nine corresponding Provider POSTs
returned HTTP 200. The final receipt showed all three Providers as `Confirmed`
with safe display references, and the proof disclosure opened in approximately
0.8 seconds. This run consumed one unit from each capacity-two canonical slot;
no further production confirmation is authorized or advisable until a private
reset/reseed procedure is fixed.

Score-lift rollout (2026-08-28): the Hub now has protected demo reset enabled;
its generated operator secret is stored in macOS Keychain and as a sensitive
Vercel variable. Migrations 004–005 project inventory onto the current Tokyo
date and satisfy the production safe-delete guard. Two protected resets restored
nine slots; the second deleted zero holds. Every canonical selected slot showed
capacity 20. The final provenance-aware deployments are
`dpl_71gABZ3orxkj9tg17k6YRyE47YDB`,
`dpl_Cj2wP6QLdnpMBsdTCCatqtXwqmoj`,
`dpl_FHFUvshePo29n97yPsxc4bR35QkV`, and
`dpl_HLh3JX9CGVqBb6N98oXpLqVAjUjp`; the shared config keeps every lambda in
`hnd1`.
The fixed Hub read-only UI search completed in 2.721 seconds with three `Found`
Providers and no browser errors.

Fixed-production reliability closeout (2026-08-28): a freshly authorized
sequential harness completed 20/20 `reset → Plan → Hold → Confirm` receipts. All
three Providers independently proved `HELD → CONFIRMED` on every run; search,
hold, confirm, observer proof, and click-to-receipt p95 targets passed; 201/201
correlation IDs were unique. The mandatory final reset restored nine slots, and
a subsequent mutation-free 20-run search baseline passed at p95 374 ms with zero
invalid/non-2xx envelopes. See `production-mutation-reliability.md`.

T095 final production rollout (2026-08-29): the active deployment set is Hub
`dpl_C54FxdZuDCJyxF4gE4UU7ZWcFdFY`, Kiln
`dpl_AJe7iHgDXxoG6cPuX9xAQeoR2wEW`, Nori
`dpl_Fp4S19GMbWZtAbBuyFxZnPDX35GY`, and Loop
`dpl_BVMMRE3KmhiykYgg2kAnp95NtPpb`, all retained in `hnd1`. The Provider set
includes the listener-first exact-origin ready/bind handshake. The bounded UX
matrix passed 9/9 read-only preset cases, followed by a post-audit 20/20
reset/Plan/Hold/Confirm gate, final reset, and 20/20 read-only health check. See
`t095-ux-generalization.md`.

T101 UI-completeness rollout (2026-08-29): the active deployment set is Hub
`dpl_7i8KYoyjqzk8CYbKgMhYZjd3712U`, Kiln
`dpl_3YDeGAFgXTDQEUW36D8zb78BbKbu`, Nori
`dpl_J8ss1JZJgFbNL1uNESQiUUsWDzW6`, and Loop
`dpl_4EcvAeh4DDW5utd6YYWD3gTGTEJS`. Vercel inspection confirms every deployment
is READY with its lambdas in `hnd1`; all fixed aliases return HTTP 200. The Hub
contains deterministic narrow-screen focus/recovery and Release locking, while
all Providers contain the width-adaptive 20rem proof embed.

Commercial release update (2026-08-29): the current production deployments are
Hub `dpl_J1mVSFuwhxwVfam9gHyiucMMwwZU`, Kiln
`dpl_Ab3ghGoJGcs58Be3nwHioqAMd9Ez`, Nori
`dpl_35nwh5uiMXFEH8KLUueVa8MMnn58`, and Loop
`dpl_9h5DmnVhJA3G3pDV9FRWx7JVQpGR`. All four are READY, aliased, and `hnd1`.
The Hub now serves a static consumer landing at `/` and the judged five-tool
document at request-dynamic `/plan`; all four favicons return HTTP 200. See
`commercial-release-closure-2026-08-29.md`.

# No-result recovery production closure — 2026-09-01

## Trigger

The prior production no-result state was truthful but visually broken: a native
blue focus outline surrounded a near-empty full-width region, a 7rem headline
dominated the viewport, the failed intent was hidden, and the page offered no
direct recovery action.

## Bounded fix

- Removed the browser-default focus outline and reused the product's purple
  focus accent.
- Replaced the oversized empty state with a compact bordered recovery panel.
- Displayed the exact failed hub, party, per-person budget, time, meal mode, and
  interest as chips.
- Added a server-side `/api/v3/plans/recovery` boundary. It cumulatively tries
  `Surprise me`, 30-minute walks, a one-hour-later end, and meal removal in that
  order. It stops at the first route that the real composer verifies.
- The primary action is shown only after that verified response. It displays
  `Try the closest available plan` plus the exact changes, such as
  `Try again with Surprise me + 30-minute walks`.
- No recovered plan is projected before the user chooses the primary action.
- `Adjust plan` opens automatically; the selected area input receives focus
  without displacing the recovery panel. `Edit these choices` scrolls the open
  form into view while preserving that focus.
- Kept the engine, data packs, storage, and the exact five Site Tool names and
  inputs unchanged. The recovery route is read-only and is not a sixth Site Tool.

## Verification

- Focused no-result browser regression: PASS, including minimum 2.1s truthful
  presentation, compact panel, persistent purple accent, no native outline,
  intent chips, auto-open/focus, no pre-click projection, exact server-provided
  change label, Edit scroll, and successful one-click recovery.
- Desktop 1440×900: full recovery panel visible, overflow 0.
- Mobile 390×844: title, six chips, explanation, and both actions visible in the
  first viewport, overflow 0.
- Exact real fixture: Shibuya, 3 adults, 17:30–19:30, ¥2,000/person, meal on,
  Lively, 5-minute walks → `NO_VALID_PLAN`; the explicit broader action returned
  a truthful 2-stop Shibuya route.
- `pnpm check`: 389/389 tests, 8/8 typechecks, source audit 20/20.
- `pnpm build`: 8/8.
- `pnpm test:v3:browser`: 14/14.
- `pnpm test:security`: public asset scan 65 files and 5/5 browser cases.

## Deployment

Application commit `c94d57d` produced immutable Hub deployment
`dpl_F66xuSv6HMpdthhMqHrs3NDgJn8W`, READY in `hnd1`. Before promotion, the exact
strict Shibuya fixture returned `NO_VALID_PLAN`, then the recovery endpoint
returned `INTEREST_SURPRISE + WALK_30`, the exact revised intent, a verified
candidate set, plan ID, and two-stop count. Later relaxations were not applied.

The exact candidate was promoted to
<https://serendipity-phase0-hub.vercel.app>. Post-promotion evidence:

- fixed alias resolved to `dpl_F66xuSv6HMpdthhMqHrs3NDgJn8W`;
- production search 20/20, 20 unique correlations, p50 47ms, p95 432ms, max
  519ms;
- production browser suite 14/14;
- deployed strict no-result screen auto-opened Adjust, focused the area input,
  retained outline `none` and a purple focus accent, showed the failed intent,
  exposed the exact server-verified change label, projected zero stops before
  approval, and logged no warning/error;
- deployed broader action returned a two-stop Shibuya route with no browser
  warnings/errors.

Immediate v3 rollback is `dpl_D78wsbtVJqCnCxy1HxSXkKR3JLzH`. Google
Places remains off. No Provider, Supabase, booking, or payment mutation occurred.

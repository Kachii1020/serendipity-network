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
- Added `Try Surprise me + 30-minute walks`, which preserves area, party, date,
  time, budget, and meal while explicitly relaxing only preference, exclusions,
  and maximum walk.
- Added `Edit these choices`, which opens the existing form and returns focus to
  its summary.
- Kept REST schemas, engine, data packs, storage, and the exact five Site Tool
  names and inputs unchanged.

## Verification

- Focused no-result browser regression: PASS, including minimum 2.1s truthful
  presentation, compact panel, no native outline, intent chips, viewport
  intersection, and successful one-click recovery.
- Desktop 1440×900: full recovery panel visible, overflow 0.
- Mobile 390×844: title, six chips, explanation, and both actions visible in the
  first viewport, overflow 0.
- Exact real fixture: Shibuya, 3 adults, 17:30–19:30, ¥2,000/person, meal on,
  Lively, 5-minute walks → `NO_VALID_PLAN`; the explicit broader action returned
  a truthful 2-stop Shibuya route.
- `pnpm check`: 388/388 tests, 8/8 typechecks, source audit 20/20.
- `pnpm build`: 8/8.
- `pnpm test:v3:browser`: 14/14.
- `pnpm test:security`: public asset scan 65 files and 5/5 browser cases.

## Deployment

Application commit `eeb40bc` produced immutable Hub deployment
`dpl_D78wsbtVJqCnCxy1HxSXkKR3JLzH`, READY in `hnd1`. Before promotion, an
authenticated candidate request returned a valid three-stop Ikebukuro plan and
the exact strict Shibuya fixture returned `NO_VALID_PLAN`.

The exact candidate was promoted to
<https://serendipity-phase0-hub.vercel.app>. Post-promotion evidence:

- fixed alias resolved to `dpl_D78wsbtVJqCnCxy1HxSXkKR3JLzH`;
- production search 20/20, 20 unique correlations, p50 54ms, p95 90ms, max
  590ms;
- production browser suite 14/14;
- deployed strict no-result screen had outline `none`, purple focus accent,
  overflow 0, both recovery actions, and no warning/error logs;
- deployed broader action returned a two-stop Shibuya route with no browser
  warnings/errors.

Immediate v3 rollback remains `dpl_97KgepTTGC78xp14v6cQw97NeAfi`. Google
Places remains off. No Provider, Supabase, booking, or payment mutation occurred.

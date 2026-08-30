# Specification Quality Checklist: Tokyo three-hub meal planner

**Reviewed**: 2026-08-30
**Scope**: Pre-implementation v3 artifact and design audit

## Product clarity

- [x] The user problem is stated independently of WebMCP implementation.
- [x] Three supported hubs, one-to-three adults, per-person budget, meal choice,
      moods, time, walking, and the exact 2/3-stop output are explicit.
- [x] The plan explains why official menu prices, not Google/Tabelog averages,
      control budget feasibility.
- [x] Group totals are estimates and do not imply seating or reservation
      capacity.
- [x] Arbitrary areas, booking, payment, maps, transit, accounts, and live
      availability are explicit non-goals.
- [x] The required published-information/no-live-availability caveat is fixed.

## Requirement completeness

- [x] US1–US7 are independently valuable and have observable acceptance paths.
- [x] FR-301–FR-330 are testable and use one stable numbering range.
- [x] SC-301–SC-312 are measurable and distinguish product, data, UI, WebMCP,
      reliability, regression, and rollback success.
- [x] Meal-on/off grammar and honest fallback behavior are unambiguous.
- [x] Preset match, exclusion precedence, party arithmetic, and budget basis are
      unambiguous.
- [x] Empty, invalid, stale, closed, unavailable, corrupt, concurrent, late, and
      no-replacement behavior is specified.
- [x] Google feature-off/degraded behavior preserves a complete official-source
      product path.
- [x] All three hubs must be ACTIVE before public v3 promotion.

## Data, rights, and external policy

- [x] Activity/meal records, per-person price evidence, area packs, reviewed
      ledgers, transient Google signals, plans, evidence, and saved records are
      defined.
- [x] Every routable restaurant requires official menu price evidence and a
      reviewed Google place ID.
- [x] Google content is request-scoped and structurally excluded from persistent
      types except place IDs.
- [x] Fixed host, allowlisted IDs, exact field mask, three-call limit,
      two-second timeout, no retry, no cache/log, and attribution are specified.
- [x] Public Terms and Privacy are release gates before Google is enabled.
- [x] Google price values cannot affect hard budget, score, IDs, or saved
      official evidence.
- [x] Tabelog data and links are excluded from this release.
- [x] Source rights, strict dates, reviewed drift, and freshness remain at least
      as strict as v2.
- [ ] The four-hour source spike proves the minimum place/menu/right set for all
      three hubs. This is T302 and is not yet complete.
- [ ] All three exact packs and reviewed ledgers pass static/live audits. This is
      T305–T309 and is not yet complete.

## API, WebMCP, state, and storage

- [x] Exact search, swap, evidence, envelope, error, size, and HTTP behavior is
      documented.
- [x] Exactly five Site Tool names, annotations, inputs, outputs, controller
      parity, lifecycle, and `5 -> 0 -> 5` inventory are documented.
- [x] External navigation is user-initiated and deliberately not a sixth tool.
- [x] Operation locking and plan/epoch-scoped late-result rejection cover REST,
      Google, evidence, UI, and storage projection.
- [x] v3 storage key, limits, corruption behavior, v2 coexistence, and Google
      sanitization are exact.
- [ ] Contract, engine, handler, gateway, tool, race, and storage tests pass.
      This is T303–T322 and is not yet complete.

## UI and design readiness

- [x] The three generated design references are present and linked from the
      implementation plan.
- [x] The visual references are bounded as hierarchy/density direction rather
      than venue evidence or raster UI assets.
- [x] Full-width result, closed adjust disclosure, first-mobile-viewport facts,
      35/45-word caps, one primary CTA, and one change action are measurable.
- [x] Sticker/ticket styling is assigned to real area/party/price/time/stop-kind
      information and cannot reintroduce fake Providers.
- [x] Focus, reading order, reduced motion, forced colours, 320/390 widths,
      200% text, 400% zoom, dialogs, disclosures, and internal overflow are in
      the test matrix.
- [ ] Implemented screenshots match the approved hierarchy and pass browser,
      visual, and accessibility gates. This is T320/T324/T325.

## Delivery and rollback readiness

- [x] Tasks T301–T334 are dependency-ordered and map to requirements/tests.
- [x] Only T301 documentation/design baseline is marked complete; no code, data,
      Google, deployment, or production task is pre-closed.
- [x] v3 is parallel until verified; specifications 001/002 and Provider/
      Supabase history remain untouched.
- [x] Preview, feature-off fallback, exact-deployment promotion, production
      validation, failure stop, and rollback are explicit.
- [x] The known v2 deployment
      `dpl_CLfLvnMvXbSVtK1ciH4kc4DvnbS6` is the immediate rollback target.
- [x] Four-hour, 24-hour, Google-policy, 48-hour freeze, and D-0 stop-losses are
      explicit.
- [ ] Immutable preview and all local gates pass on one commit. This is
      T327–T328.
- [ ] Google-on policy/key/quota gate passes or the production flag remains off.
      This is T329.
- [ ] Rollback rehearsal, route promotion, production 20/20, exact-five 3/3,
      log watch, and submission packaging pass. This is T330–T334.

## Traceability audit

```text
User problem
  -> US1..US7 in spec.md
    -> FR-301..FR-330 in spec.md
      -> plan.md + data-model.md + contracts/planner-v3.md
        -> T301..T334 in tasks.md
          -> V3-* evidence in test-matrix.md
            -> SC-301..SC-312 release decision
```

- [x] Every FR appears in the requirement coverage index.
- [x] Every user scenario has at least one contract, engine/data, and/or browser
      verification path appropriate to its boundary.
- [x] Every implementation task points to a requirement or named matrix row.
- [x] No evidence row is marked passed before implementation.

## Pre-implementation decision

The artifacts are decision-complete enough to begin T302/T303. Shipping remains
blocked until every unchecked runtime/data/deployment item above is backed by
evidence from the exact candidate.

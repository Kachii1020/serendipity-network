# Synthetic participant QA — initial results

**Date**: 2026-08-28  
**Evidence class**: NON-HUMAN product QA and hypothesis generation  
**Human T093 counts**: consumers 0/5; Providers 0/2  
**Status**: Initial short synthetic matrix complete; no human gate or impact
score is claimed

## Environment and isolation

Consumer actors received only the frozen goal text and the local URL. They were
instructed not to inspect source, tests, specifications, prior conversations, or
tool inventories. Each valid run used a fresh browser session or tab. The local
four-origin stack used real local Supabase, current Tokyo service date
`2026-08-28`, capacity 20, and the same Hub/Provider product code as production.
The local fixture was reset between valid runs and after the cohort. Production
code, deployment, and data were not changed.

`SYN-C01` encountered an environment error: the initial local seed date was 2030
while the UI requested the current Tokyo date, so every mood returned no result.
The run is preserved as `infrastructure-invalid` and was not silently replaced.
The study launcher now applies an exact local-only current-date reset before a
session.

## Synthetic consumer outcomes

| Run     | Result                 | Route choice                | Dominant actions      | Backtrack/misclick | Runtime understanding |
| ------- | ---------------------- | --------------------------- | --------------------- | ------------------ | --------------------- |
| SYN-C01 | Infrastructure-invalid | No route on stale seed date | Four searches         | 0                  | Manual                |
| SYN-C02 | Receipt reached        | Hands-on/default route      | Plan → Hold → Confirm | 0                  | Manual                |
| SYN-C03 | Receipt reached        | Surprising/default route    | Plan → Hold → Confirm | 0                  | Manual                |
| SYN-C04 | Receipt reached        | Surprising/default route    | Plan → Hold → Confirm | 0                  | Manual                |
| SYN-C05 | Receipt reached        | Inspected Options 2 and 3   | Plan → Hold → Confirm | 0                  | Manual                |

Valid-run aggregate, reported separately from the invalid setup run:

- receipt completion: **4/4**;
- unaided dominant path: **4/4**;
- backtracks or misclicks: **0**;
- recognized Kiln, Nori, and Loop as three named sources: **4/4**;
- understood the 90-second hold as temporary and distinct from confirm: **4/4**;
- understood no payment and no real venue booking occurred: **4/4**;
- correctly identified `Manual fallback` from visible evidence: **4/4**;
- visible product errors in valid runs: **0**.

No human-like completion time or SEQ is reported. Model interaction latency and
self-reported ease are not valid substitutes for those measures.

## UX hypotheses from visible behavior

These are candidates for human observation, not implementation mandates.

1. **Live/manual language tension — 2/4 valid runs.** `Live Provider network` or
   `three live stops` appeared alongside `Manual connection` and `no live-tool
claim`, creating brief uncertainty about whether availability itself was
   live. Both actors ultimately classified the source correctly.
2. **Hold-versus-completion hesitation — 1/4.** One actor briefly checked
   whether the hold completed the task; the distinct confirm action and
   countdown resolved it.
3. **Alternative comparison cost — 1/4.** One actor had to activate an option to
   see its activities and observed that option numbering changed after
   selection. Cost/travel alone was insufficient for side-by-side comparison.
4. **Initial state wording — 1/4.** One actor noticed Provider copy that appeared
   to combine `Connecting` and `Ready`.
5. **Time/budget demand — 0/4.** No valid synthetic actor independently asked to
   change time or budget. This does not reject T095; it means the predeclared
   human trigger has not been met by synthetic QA.

The only repeated UX hypothesis is the live/manual language distinction. It
should be observed explicitly in T093 before copy or layout changes are made.

## Synthetic Provider contract reviews

`SYN-P01` and `SYN-P02` independently reviewed the Provider contract and
security/operations surfaces. They do not represent venues and establish no
operator preference, adoption, demand, or willingness to pay.

Both reviews converge on the following preconditions before any real-inventory
or real-Provider pilot:

- Provider-specific credentials, database isolation, rotation/revocation, and
  operation controls instead of one shared trust plane;
- authoritative hold expiry with worker health and overdue-hold visibility;
- cleanup/reconciliation work that survives caller cancellation;
- explicit mixed-confirmation reconciliation or reversible demo confirmation;
- durable Provider-scoped mutation audits and an operator reconciliation queue;
- rate/hold quotas, abuse controls, and body-bound replay-resistant service
  authentication;
- demo reset and Phase 0 tooling isolated from any real inventory namespace.

The smallest defensible external pilot hypothesis is one real Provider with
read-only shadow inventory in an isolated tenant, while the other two remain
synthetic. Real holds would follow only after expiry, audit, credential, and
reconciliation controls pass.

These findings do not block the current explicitly synthetic, no-payment
hackathon demo. They do block treating geographic or Provider generalization as
mere UI work.

## Historical decision and supersession

The bullets below record the pre-T095 recommendation from 2026-08-28. On
2026-08-29 the user explicitly authorized bounded time/budget implementation and
automated/non-human synthetic promotion. T095 has since been implemented and
verified. T093/T096 remain optional human research; region, party-size, and real
Provider expansion remain version 2.

- Do not mark T093 or T096 complete.
- Do not implement a region selector, party-size expansion, or real Provider
  onboarding from this evidence.
- Historical recommendation: do not implement time/budget controls yet; this was
  superseded by the 2026-08-29 authorization.
- Add `live/manual meaning`, `alternative comparison`, `initial Provider state`,
  and `hold completion` to the T093 observer attention list without changing the
  verbatim participant script.
- Proceed to real recruitment using `t093-study-launch.md`.

The source protocol and allowed/forbidden claim rules remain in
`synthetic-participant-eval-plan.md`.

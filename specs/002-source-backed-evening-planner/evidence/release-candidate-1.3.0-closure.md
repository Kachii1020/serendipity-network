# Pack 1.3.0 release-candidate closure

**Scope:** current local release candidate
**Evidence class:** implementation traceability and pending release gates
**Production claim:** none

This record separates implemented closure work from executed release evidence.
The prior production deployment remains useful regression evidence, but it does
not contain this batch and cannot be cited as proof that the candidate shipped.

## Candidate truth

- Data pack: `1.3.0`, ACTIVE in source, 9 routable places, 18 declared sources.
- Generated: `2026-08-30T01:20:00+09:00`.
- Audited horizon: through `2026-10-28T23:59:59+09:00`; later intents fail
  closed until a refreshed pack is reviewed.
- Schedule sources: Cabinet Office 2026 holidays and Shibuya City Libraries'
  official daily calendar, with all in-horizon exceptions materialized.
- Runtime fan-out: no Provider, Supabase, scraping, or external network call.
- Reviewed boundary: pack values, station, calendar sources, complete source
  metadata/usage, and root data-license record must exactly match the versioned
  reviewed-claim ledger before compose or swap.

## Closure work represented in the candidate

| Area              | Fail-closed behavior                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar validity | Impossible intent, pack, source, evidence, envelope, tool, and saved-snapshot dates are rejected rather than normalized.                                |
| Evidence UI       | Official holiday/daily-calendar sources appear as visible `Schedule calendar` evidence.                                                                 |
| Swap freshness    | The server returns replacement-plan warnings and the client replaces warnings from removed places.                                                      |
| Evidence race     | Evidence is scoped to its source plan ID; a late response cannot enter a changed plan or saved snapshot.                                                |
| Registration      | A partial five-tool registration disposes earlier handles and never claims agent connectivity.                                                          |
| API/tool output   | Search, evidence, and swap use exact action validators; malformed, unsafe, mismatched, cyclic, markup, or credential-bearing payloads normalize safely. |
| Storage recovery  | Unreadable bytes remain untouched; readable partial corruption retains valid records and is repaired only by explicit save/delete.                      |

## Gate status

| Gate                                                | Status                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Focused current-candidate tests and source audit    | PASS — `test:v2` 135/135; source regressions 11/11; standalone 9 routable/18 sources |
| Unit regression and build                           | PASS — 342/342 after performance optimization; build 8/8                             |
| Browser, accessibility, and security                | PASS — v2 12/12; accessibility 9/9; security 56 assets + 5/5                         |
| Final post-documentation `pnpm check`               | PASS; T208 complete                                                                  |
| Immutable preview and exact Site Tools path 3/3     | Pending                                                                              |
| Production promotion and read-only search 20/20     | Pending                                                                              |
| Supported-client production Site Tools verification | Pending                                                                              |
| Updated screenshots and narrated submission video   | Pending production gate                                                              |

No pending row may be converted to PASS using results from
`dpl_4LBiYvg2NP1KEq4WLT1Pry1u4C2b`. Each result must identify the exact commit,
pack version, deployment ID where applicable, clock/service date, and client.

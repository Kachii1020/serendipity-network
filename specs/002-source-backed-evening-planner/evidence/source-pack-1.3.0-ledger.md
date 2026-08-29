# Source pack 1.3.0 release ledger

**Reviewed:** 2026-08-30 JST
**Pack horizon:** 2026-08-30 through 2026-10-28 JST
**Pack behavior after the horizon:** fail closed; no route may be generated
until a refreshed pack is promoted.

## Why this horizon is defensible

- `generatedAt` is `2026-08-30T01:20:00+09:00`; `validThrough` is
  `2026-10-28T23:59:59+09:00`, 59 Tokyo calendar days later.
- The oldest routable hours/price check is `2026-08-30T00:31:00+09:00`.
  The pack therefore expires before that claim reaches the 60-day hard-stale
  boundary on October 29.
- Runtime freshness remains independent of the horizon: after 14 elapsed days
  the engine emits `SOURCE_RECHECK_RECOMMENDED`; after 60 days the place is
  excluded. `validThrough` is not presented as a promise that sources cannot
  change.
- Shibuya City Libraries' official daily calendar already publishes day-level
  open/closed status through March 2027. This release materializes only the
  dates inside the shorter audited horizon.
- The Cabinet Office lists 2026-09-21, 2026-09-22, 2026-09-23, and 2026-10-12
  as holidays/holidays-by-law inside the horizon. Facility holiday-shift rules
  are applied only to those official dates.

## Stable ninth place

`shoto-museum-current-exhibition` was removed because its cited exhibition and
price ended on 2026-09-06. It is replaced by `yoyogi-library`:

- [official facility page](https://www.lib.city.shibuya.tokyo.jp/library/yoyogi/):
  identity, address, public access, weekday/weekend hours, Tuesday closure,
  third-Sunday closure, and second-Thursday organization closure;
- [Tokyo Open Data CSV](https://www.opendata.metro.tokyo.lg.jp/shibuya/131130_shibuyaku_library.csv):
  `35.681969, 139.695981` and the same facility address;
- [Tokyo Metropolitan Government public-library document](https://www.soumu.metro.tokyo.lg.jp/documents/d/soumu/1000):
  on-site public-library use is free under the Library Act. Copying, borrowing,
  seat availability, and specific-title availability are excluded;
- [official daily opening calendar](https://www.lib.city.shibuya.tokyo.jp/open-schedule/open_schedule.json):
  daily status through this horizon.

The Yoyogi calendar entry for 2026-09-22 has a holiday marker but no open flag
or hours. Pack 1.3.0 treats that date as closed. This deliberate false negative
is safer than inventing an opening window.

## Full closure ledger

Weekly closures are represented by omission from `weeklyHours`; exceptional
closures and holiday windows are represented by `dateExceptions`.

| Place                                | Closed dates in the audited horizon                                                           | Holiday/special open windows                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Former Asakura Residence             | 08-31; 09-07, 09-14, 09-24, 09-28; 10-05, 10-13, 10-19, 10-26                                 | 09-21 and 10-12, 10:00–18:00                                                                |
| Kihachiro Kawamoto Puppet Gallery    | none                                                                                          | none; its next published exhibit-change closure is 11-16 through 11-21, outside the horizon |
| Shibuya City Botanical Garden Fureai | 08-31; 09-07, 09-14, 09-24, 09-28; 10-05, 10-13, 10-19, 10-26                                 | 09-21 and 10-12, 10:00–21:00                                                                |
| Children's Science Center Hachilabo  | 08-31; 09-07, 09-14, 09-24, 09-28; 10-05, 10-13, 10-19, 10-26                                 | 09-21 and 10-12, 10:00–17:00                                                                |
| Shibuya Central Library              | 09-07, 09-17; 10-05, 10-15                                                                    | 09-21, 09-22, 09-23, and 10-12, 09:00–18:00                                                 |
| Komorebi Owada Library               | 09-08, 09-10, 09-14, 09-24, 09-28; 10-06, 10-08, 10-13, 10-20, 10-26                          | 09-21, 09-22, 09-23, and 10-12, 09:00–17:00                                                 |
| Tomigaya Library                     | 09-07, 09-10, 09-15, 09-24, 09-29; 10-05, 10-08, 10-13, 10-19, 10-27                          | 09-21, 09-22, 09-23, and 10-12, 09:00–17:00                                                 |
| Rinsen Library                       | 09-08, 09-10, 09-14, 09-24, 09-28; 10-06, 10-08, 10-13, 10-20, 10-26                          | 09-21, 09-22, 09-23, and 10-12, 09:00–17:00                                                 |
| Yoyogi Library                       | 09-01, 09-08, 09-10, 09-15, 09-20, **09-22**, 09-29; 10-06, 10-08, 10-13, 10-18, 10-20, 10-27 | 09-21, 09-23, and 10-12, 09:00–17:00                                                        |

For Asakura, Botanical Fureai, and Hachilabo, September 24 is the first
non-holiday weekday following the September 21–23 holiday sequence. October 13
is the first weekday following the October 12 holiday. Those are the facilities'
published shifted Monday closures.

## Primary sources checked

- [Cabinet Office 2026 holiday table](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html)
- [Shibuya City Libraries daily calendar JSON](https://www.lib.city.shibuya.tokyo.jp/open-schedule/open_schedule.json)
- [Former Asakura Residence](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/asakura/asakura_00004.html)
- [Kihachiro Kawamoto Puppet Gallery](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/gallery.html)
- [Botanical Garden Fureai](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/fureai.html)
- [Hachilabo](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/hachirabo.html)
- [Central](https://www.lib.city.shibuya.tokyo.jp/library/central/),
  [Komorebi](https://www.lib.city.shibuya.tokyo.jp/library/komorebi/),
  [Tomigaya](https://www.lib.city.shibuya.tokyo.jp/library/tomigaya/),
  [Rinsen](https://www.lib.city.shibuya.tokyo.jp/library/rinsen/), and
  [Yoyogi](https://www.lib.city.shibuya.tokyo.jp/library/yoyogi/) library pages

No source is fetched at runtime. The JSON pack, reviewed-claims snapshot, and
closure regression test are release artifacts. The live source audit checks
URLs only during release validation.

## Release verification

- Contract/data/engine focused suite: 39/39 pass.
- Independent offline source-audit regressions: 10/10 pass.
- Live source/link audit: all 18 declared sources and official links returned
  HTTP 200–399.
- Official daily calendar reconciliation: all 299 published rows for Central,
  Komorebi, Tomigaya, Rinsen, and Yoyogi between 2026-08-30 and 2026-10-28
  exactly matched the pack's effective open/closed window. Central's absent
  2026-09-28 JSON row uses its facility page's ordinary Monday 09:00–18:00
  window; no contrary status was invented.

## Renewal runbook

1. Re-fetch every primary source and the official daily library calendar.
2. Move `generatedAt` to the review time and choose `validThrough` no later than
   the earliest required hours/price check plus 60 elapsed days.
3. Materialize every daily-calendar deviation, national-holiday window, shifted
   closure, announced exhibit change, and special closure in the new horizon.
4. Fail closed on a blank or contradictory daily-calendar row; never infer open.
5. Bump `packVersion`, regenerate the reviewed-claims snapshot only after human
   comparison, and update this ledger.
6. Run the contract, exact closure-ledger, engine, offline source-audit, and live
   URL-audit gates before promotion.

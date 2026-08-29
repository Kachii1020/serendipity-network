# Source pack 1.2.0 evidence ledger

**Audit time:** 2026-08-30 JST
**Active horizon:** 2026-08-30 through 2026-09-06 JST
**Pack behavior after the horizon:** fail closed; no route may be generated until a refreshed pack is promoted.

This ledger records the factual basis for the nine routable places in
`apps/hub/data/shibuya.places.v2.json`. Ordinary official pages are used only
as factual references. Their prose, images, logos, and page content are not
redistributed and are not described as open-licensed. Reusable coordinates
come only from the Tokyo Open Data Catalog (CC BY 4.0) or Wikidata (CC0).

## Shared sources

| Claim                           | Primary source                                                                                                                        | Use                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shibuya Station coordinate      | [Wikidata Q428811](https://www.wikidata.org/wiki/Q428811)                                                                             | CC0 coordinate anchor. The former Q200633 citation was wrong and was removed.                                                                                           |
| Four public-library coordinates | [Tokyo Open Data Catalog — Shibuya public libraries CSV](https://www.opendata.metro.tokyo.lg.jp/shibuya/131130_shibuyaku_library.csv) | CC BY 4.0 coordinates only.                                                                                                                                             |
| Free public-library use         | [Tokyo Metropolitan Government — scope of public library users](https://www.soumu.metro.tokyo.lg.jp/documents/d/soumu/1000)           | Official factual statement that public-library use is free under the Library Act. The planner excludes copying, borrowing eligibility, reservations, and paid services. |

## Place ledger

| Place ID                          | Official facts                                                                                                         | Coordinate source                                                                    | Horizon-specific schedule and price                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kyu-asakura-house`               | [Shibuya City facility page](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/asakura/asakura_00004.html)     | [Wikidata Q16944532](https://www.wikidata.org/wiki/Q16944532)                        | 10:00–18:00 in the active season; Monday 2026-08-31 closed; general adult ¥500. The engine's visit duration plus closing headroom is earlier than the published 17:30 last admission.    |
| `kawamoto-puppet-gallery`         | [Shibuya City facility page](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/gallery.html)    | [Shibuya Hikarie, Wikidata Q11561670](https://www.wikidata.org/wiki/Q11561670)       | 11:00–19:00; free admission. The next listed 2026 exhibit-change closure is outside the pack horizon. The official page, not Wikidata, supports the 8F address.                          |
| `shibuya-botanical-center`        | [Shibuya City facility page](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/fureai.html)     | [Wikidata Q110215017](https://www.wikidata.org/wiki/Q110215017)                      | 10:00–21:00; Monday 2026-08-31 closed; general admission ¥100. The engine's visit duration plus closing headroom is earlier than the published 20:30 last admission.                     |
| `hachilabo-science-center`        | [Shibuya City facility page](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/hachirabo.html)  | [Cultural Center Owada, Wikidata Q20044812](https://www.wikidata.org/wiki/Q20044812) | 10:00–17:00; Monday 2026-08-31 closed; free general admission with no general entry condition. Events, workshops, materials, and event-specific eligibility are excluded.                |
| `shibuya-central-library`         | [Official library page](https://www.lib.city.shibuya.tokyo.jp/library/central/)                                        | Tokyo public-libraries CSV                                                           | Tue–Sat 09:00–21:00; Sun/Mon 09:00–18:00. Its first-Monday and third-Thursday closures do not occur in this horizon. Free on-site public-library use only.                               |
| `komorebi-owada-library`          | [Official library page](https://www.lib.city.shibuya.tokyo.jp/library/komorebi/)                                       | Tokyo public-libraries CSV                                                           | Mon–Sat 09:00–21:00; Sun 09:00–17:00. Its published recurring closure dates do not occur in this horizon. Free on-site public-library use only.                                          |
| `tomigaya-library`                | [Official library page](https://www.lib.city.shibuya.tokyo.jp/library/tomigaya/)                                       | Tokyo public-libraries CSV                                                           | Tue–Sat 09:00–19:00; Sun/Mon 09:00–17:00. Its published recurring closure dates do not occur in this horizon. Free on-site public-library use only.                                      |
| `rinsen-minna-library`            | [Official Rinsen Library page](https://www.lib.city.shibuya.tokyo.jp/library/rinsen/)                                  | Tokyo public-libraries CSV                                                           | Tue–Sat 09:00–19:00; Sun/Mon 09:00–17:00. Its published recurring closure dates do not occur in this horizon. Free on-site public-library use only.                                      |
| `shoto-museum-current-exhibition` | [Shibuya City July 2026 culture notice](https://www.city.shibuya.tokyo.jp/contents/koho-news/1612/20260715_bunka.html) | [Wikidata Q11561694](https://www.wikidata.org/wiki/Q11561694)                        | Current exhibition through 2026-09-06; 10:00–18:00, Friday to 20:00; Monday 2026-08-31 closed; general admission ¥1,000. This place and the entire pack expire when the exhibition ends. |

## Remaining uncertainty and fail-closed boundaries

- No source proves live admission, seat availability, event capacity, or
  temporary same-day access. The product must keep its published-information
  disclaimer and link to the official page before a visit.
- Library browsing is free, but a seat, a particular book, borrowing, copying,
  and special services are not promised by this pack.
- Coordinates are point estimates. Walking remains a labelled coordinate
  estimate, not a mapped pedestrian route.
- The four library pages publish recurring and special-closure categories. The
  active horizon was selected because none of those published recurring dates
  falls inside it. Any new emergency notice requires a new pack version.
- Shoto Museum pricing is exhibition-specific. Reusing the ¥1,000 amount after
  2026-09-06 is forbidden.
- Source URL availability and source semantics are separate gates. An HTTP 200
  alone is not evidence that a field value is supported.

## Promotion result

- Places: 9
- Routable places: 9
- Source records: 17
- `OFFICIAL_FACT_REFERENCE` ordinary pages: factual citation only
- `OPEN_LICENSE` records: Tokyo Open Data Catalog or Wikidata only
- Inferred all-day hours: 0
- Planner-zero/unknown prices in routes: 0
- Restricted-access facilities in routes: 0
- Missing coordinate evidence in routes: 0

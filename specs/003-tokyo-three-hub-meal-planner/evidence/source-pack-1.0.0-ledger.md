# Tokyo three-hub source pack 1.0.0

Checked: 2026-08-30 JST
Pack horizon: 2026-08-30 through 2026-09-12 JST
Status: ACTIVE release candidate

## Release statement

The pack contains three independently reviewed area snapshots. Each area has four activities and three restaurants, enough for the first `Activity → Meal → Activity` integration path and the planned production supply floor.

- All identity, address, hours, price, public-access, menu and coordinate claims point to a source record.
- Restaurant budget decisions use official menu pages only.
- No Tabelog content, reviews, ratings, photos, logos or live-availability claims are stored.
- Six restaurant Place IDs begin with `ChIJ` and were read from structured data embedded by the restaurants' official store pages; none were inferred from names. ICHIRAN's official pages expose map coordinates but not Place IDs, so its three records deliberately use `null` and skip Google enrichment.
- Price ranges are per person. Ootoya uses the published metropolitan set-meal range. Torikizoku transparently models two to five items at the published ¥390 uniform item price.
- Google enrichment is optional and no Google response data is included in this pack.

## Shibuya

| Role     | Place                                | Hours/price source                                                                                    |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Activity | Former Asakura Residence             | [Shibuya City](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/asakura/asakura_00004.html)  |
| Activity | Kihachiro Kawamoto Puppet Gallery    | [Shibuya City](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/gallery.html) |
| Activity | Shibuya City Botanical Garden Fureai | [Shibuya City](https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/fureai.html)  |
| Activity | Shibuya Central Library              | [Shibuya City Library](https://www.lib.city.shibuya.tokyo.jp/library/central/)                        |
| Meal     | Ootoya Shibuya Dogenzaka             | [store](https://store.ootoya.com/detail/142928/) · [menu](https://www.ootoya.com/menu)                |
| Meal     | Torikizoku Shibuya Center-gai        | [store](https://map.torikizoku.co.jp/detail/390/) · [menu/price](https://map.torikizoku.co.jp/)       |
| Meal     | ICHIRAN Shibuya                      | [store and store-specific menu](https://en.ichiran.com/shop/tokyo/shibuya/)                           |

## Shinjuku

| Role     | Place                                           | Hours/price source                                                                                                 |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Activity | Tokyo Metropolitan Government South Observatory | [official Tokyo guide](https://www.gotokyo.org/en/spot/74/index.html)                                              |
| Activity | Shinjuku Gyoen National Garden                  | [Ministry of the Environment](https://policies.env.go.jp/national-garden/shinjukugyoen/english/guide/information/) |
| Activity | Tokyo Toy Museum                                | [official visitor guide](https://art-play.or.jp/ttm/en/)                                                           |
| Activity | Shinjuku Copabowl                               | [store/hours](https://copa-shinjuku.com/en/about/) · [three-game packs](https://copa-shinjuku.com/bowling/)        |
| Meal     | Ootoya Shinjuku East Exit Chuo-dori             | [store](https://store.ootoya.com/detail/27230/) · [menu](https://www.ootoya.com/menu)                              |
| Meal     | Torikizoku Shinjuku Otakibashi-dori             | [store](https://en.map.torikizoku.co.jp/store/734) · [menu/price](https://map.torikizoku.co.jp/)                   |
| Meal     | ICHIRAN Shinjuku Central East Exit              | [store and store-specific menu](https://en.ichiran.com/shop/tokyo/shinjuku/)                                       |

Tokyo Mystery Circus was deliberately excluded from this release. Free building entry is not equivalent to a meaningful game, and game schedules and prices could not be represented honestly as a generic always-available route activity.

## Ikebukuro

| Role     | Place                               | Hours/price source                                                                                                                              |
| -------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity | Sunshine 60 Observatory Tenbou-Park | [tickets/prices](https://sunshinecity.jp/en/observatory/ticket/) · [general hours](https://sunshinecity.jp/en/observatory/information/faq.html) |
| Activity | Sunshine Aquarium                   | [official calendar and prices](https://sunshinecity.jp/en/aquarium/ticket/)                                                                     |
| Activity | animate Ikebukuro Flagship Store    | [official store](https://www.animate.co.jp/en/shop/ikebukuro/)                                                                                  |
| Activity | Bandai Namco Cross Store Tokyo      | [official store](https://bandainamco-am.co.jp/crossstore/store/crossstore_tokyo/?first=all)                                                     |
| Meal     | Ootoya Ikebukuro East Exit          | [store](https://store.ootoya.com/detail/27186/) · [menu](https://www.ootoya.com/menu)                                                           |
| Meal     | Torikizoku Ikebukuro East Exit      | [store](https://en.map.torikizoku.co.jp/detail/226/) · [menu/price](https://map.torikizoku.co.jp/)                                              |
| Meal     | ICHIRAN Ikebukuro                   | [store and store-specific menu](https://en.ichiran.com/shop/tokyo/ikebukuro/)                                                                   |

The Aquarium uses a conservative 10:00–18:00 planning window rather than extending a same-day calendar value across the full pack horizon. The Observatory likewise uses its published general 11:00–21:00 hours. Both still require an official-site check before departure.

## Evidence and commands

- Runtime catalog: `apps/hub/data/planner-v3/area-packs.v3.json`
- Drift boundary: one `*.reviewed-claims.v3.json` snapshot per area
- Deterministic source audit: `node scripts/audit-v3-sources.mjs`
- Live source audit: `node scripts/audit-v3-sources.mjs --live`
- Audit regressions: `node --test scripts/audit-v3-sources.test.mjs`
- Typed data regressions: `pnpm exec vitest run apps/hub/data/planner-v3/planner-v3-data.test.ts`

Recorded result on 2026-08-30: 36/36 distinct official, license and open-data URLs returned HTTP 200–399; 9/9 audit regressions and 4/4 typed data regressions passed.

The contract/engine integration then passed the canonical three-hub smoke and the complete `3 areas × party 1/3 × meal on/off` fixture matrix, 12/12.

## Remaining promotion work

1. Refresh or withdraw the pack at `validThrough`; it is not a permanent venue database.

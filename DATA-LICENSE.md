# Serendipity data licensing and attribution

The repository's source code is licensed under the root [MIT License](LICENSE).
That license does not replace the terms attached to third-party data.

## Shibuya place data pack

`apps/hub/data/shibuya.places.v2.json` is a curated mixed-rights database. Its
root license identifier is `MIXED-SEE-SOURCES`; each source record governs the
facts attributed to that source. Actual Tokyo/Shibuya catalog data retains its
declared open-data license, Wikidata records retain CC0, and short factual
references to ordinary official portal pages are marked
`OFFICIAL_FACT_REFERENCE`. That marker authorizes only bounded factual
verification in this project; it is not a claim that the whole portal page is
open-licensed.

Station and coordinate facts imported from Wikidata remain available under the
[Creative Commons CC0 1.0 dedication](https://creativecommons.org/publicdomain/zero/1.0/).
Project-authored summaries are available under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
with attribution to `Serendipity Network contributors`.

Every pack source declares its own open-license, explicit-permission,
official-fact-reference, or link-only basis. Those source-specific terms
continue to apply. `OFFICIAL_FACT_REFERENCE` may support only the short factual
fields named in its `factScope`; no source prose or media is copied. A source
marked `OFFICIAL_LINK_ONLY` is used only as an outbound link and does not
authorize copying its text, images, prices, hours, logos, or other content.

If a later pack incorporates OpenStreetMap data, that derived database must
adopt the [Open Data Commons Open Database License 1.0
(ODbL)](https://opendatacommons.org/licenses/odbl/1-0/), display the credit
`© OpenStreetMap contributors`, and link to the [OpenStreetMap copyright
page](https://www.openstreetmap.org/copyright). The current v2 pack does not
claim to use OpenStreetMap.

## Excluded rights

No license is granted to third-party trademarks, service marks, logos, or
photographs. The v2 pack must not contain copied marketing descriptions or
unlicensed media. Place names may only be used as factual identifiers and do
not imply sponsorship, affiliation, live availability, or booking authority.

The build-time audit in `scripts/audit-v2-sources.mjs` verifies the mechanical
source and claim rules. It is not legal advice and does not replace review of
the underlying license or permission evidence.

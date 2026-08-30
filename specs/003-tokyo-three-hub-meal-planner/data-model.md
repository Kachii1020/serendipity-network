# Data Model: Tokyo three-hub meal planner

The v3 source of truth is three versioned, reviewed static area packs. Supabase,
Provider data, Google response content, and Tabelog are not part of those packs.
Every public and persisted object has an exact schema (`additionalProperties:
false`), bounded strings/arrays, strict Gregorian dates, allowlisted HTTPS URLs,
and semantic validation after JSON Schema validation.

## Intent and presets

```ts
const PLANNER_SCHEMA_VERSION_V3 = "3" as const;
const PLANNER_AREAS_V3 = ["shibuya", "shinjuku", "ikebukuro"] as const;
const PARTY_SIZES_V3 = [1, 2, 3] as const;
const INTEREST_PRESETS_V3 = [
  "SURPRISE",
  "ART_HERITAGE",
  "FOOD_DISCOVERY",
  "HANDS_ON",
  "CALM_QUIET",
  "LIVELY",
] as const;

type PlannerIntentV3 = {
  schemaVersion: "3";
  area: "shibuya" | "shinjuku" | "ikebukuro";
  partySize: 1 | 2 | 3;
  startAt: string;
  endAt: string;
  budgetPerPersonYen: number; // integer 0..30_000
  includeMeal: boolean;
  interestPreset: InterestPresetV3;
  maxWalkMinutesPerLeg: number; // integer 5..30
  excludedTags: PlannerTag[]; // unique, max 5
};
```

- Timestamps use `+09:00`, share one real Tokyo calendar date, span 2–10
  hours, start no earlier than 12:00 or more than five minutes before the
  injected clock, end no later than 23:30, and are within today through today +7.
- The API has no hidden defaults. UI defaults are defined in FR-302.
- `FOOD_DISCOVERY` requires `includeMeal: true`.
- Presets map to existing evidence-backed tags; they do not create new facts:

| Preset           | Match tags                       | Hard behavior                                |
| ---------------- | -------------------------------- | -------------------------------------------- |
| `SURPRISE`       | none                             | no matching-stop requirement                 |
| `ART_HERITAGE`   | `art`, `heritage`-category proxy | at least one matching activity               |
| `FOOD_DISCOVERY` | `food`, `coffee-tea`             | meal required and at least one matching stop |
| `HANDS_ON`       | `hands-on`                       | at least one matching activity               |
| `CALM_QUIET`     | `quiet`, `books`, `outdoors`     | at least one matching stop                   |
| `LIVELY`         | `lively`, `music`                | at least one matching stop                   |

The category proxy is a deterministic engine rule, not an added tag in source
data. Excluded tags remain hard constraints and take precedence over preset
matches.

## Sources, rights, and reviewed claims

Reuse the v2 source-usage union and strict evidence rules with schema version 3:

```ts
type SourceUsageV3 =
  | {
      mode: "OPEN_LICENSE";
      licenseId: string;
      licenseUrl: string;
      attribution: string;
    }
  | {
      mode: "EXPLICIT_PERMISSION";
      permissionEvidencePath: string;
      attribution: string;
    }
  | {
      mode: "OFFICIAL_FACT_REFERENCE";
      factScope: Array<
        | "IDENTITY"
        | "ADDRESS"
        | "COORDINATES"
        | "HOURS"
        | "PRICE"
        | "PUBLIC_ACCESS"
        | "MENU"
      >;
      attribution: string;
    }
  | { mode: "OFFICIAL_LINK_ONLY" };

type SourceRecordV3 = {
  sourceId: string;
  title: string;
  publisher: string;
  sourceKind: "OPEN_DATASET" | "OFFICIAL_SITE" | "LICENSE_TERMS";
  url: string;
  checkedAt: string;
  publishedAt?: string;
  usage: SourceUsageV3;
  notes?: string;
};

type EvidenceReferenceV3 = { sourceId: string; checkedAt: string };

type PlaceEvidenceRefsV3 = {
  identity: EvidenceReferenceV3;
  address: EvidenceReferenceV3;
  coordinates: EvidenceReferenceV3;
  hours: EvidenceReferenceV3;
  price: EvidenceReferenceV3;
  publicAccess: EvidenceReferenceV3;
  officialLink: EvidenceReferenceV3;
  menu: EvidenceReferenceV3 | null;
};
```

- `menu` is required and non-null for every `MEAL`; activities use `null` unless
  an official menu-like price page materially establishes their price.
- `OFFICIAL_LINK_ONLY` supports only a direct outbound official URL and never a
  value shown or used by the engine.
- Tabelog origins and source IDs are forbidden by schema-level semantic audit.
- At ACTIVE promotion, every required source was checked within seven days of
  pack generation. At runtime, 14 days produces a recheck warning and 60 days
  makes the affected place unroutable.
- Each pack has a version-matched `ReviewedAreaClaimsV3` that freezes pack
  status/horizon/license, station, supported presets/fixtures, every planning
  field, every evidence pointer, and complete source metadata/usage. Any drift
  fails as `STALE_DATA_PACK` before composition or Google calls.

## Places and official per-person price

```ts
type PlaceKindV3 = "ACTIVITY" | "MEAL";

type PlaceCategoryV3 =
  | "heritage"
  | "library"
  | "park"
  | "public-space"
  | "gallery"
  | "botanical"
  | "science-center"
  | "workshop"
  | "music-venue"
  | "restaurant";

type PriceEvidenceV3 =
  | {
      kind: "FREE";
      basis: "PER_PERSON";
      currency: "JPY";
      minYen: 0;
      maxYen: 0;
      label: string;
    }
  | {
      kind: "EXACT";
      basis: "PER_PERSON";
      currency: "JPY";
      minYen: number;
      maxYen: number; // equals minYen
      label: string;
    }
  | {
      kind: "RANGE";
      basis: "PER_PERSON";
      currency: "JPY";
      minYen: number;
      maxYen: number; // greater than minYen
      label: string;
    };

type PriceProvenanceV3 = {
  kind: "PUBLISHED_AMOUNT";
  sourceSummary: string;
  inclusionsNote: string;
};

type PlannerPlaceV3 = {
  placeId: string;
  kind: PlaceKindV3;
  name: string;
  summary: string; // self-authored, max 160 characters
  category: PlaceCategoryV3;
  address: string;
  coordinates: { latitude: number; longitude: number };
  tags: PlannerTag[];
  officialUrl: string;
  officialMenuUrl: string | null;
  googlePlaceId: string | null;
  recommendedVisitMinutes: number; // integer 20..180
  calendarSourceIds: string[];
  weeklyHours: WeeklyHoursV3[];
  dateExceptions: DateExceptionV3[];
  hoursProvenance: HoursProvenanceV3;
  price: PriceEvidenceV3;
  priceProvenance: PriceProvenanceV3;
  evidence: PlaceEvidenceRefsV3;
};
```

Invariants:

- Every routable place has complete published windows, published numeric price,
  coordinates, and separate evidence for address and coordinates.
- A `MEAL` has category `restaurant`, a non-null official menu URL, a non-null
  menu evidence reference scoped for `MENU` and `PRICE`, and a pre-reviewed
  Google place ID. An `ACTIVITY` has neither restaurant category nor a required
  Google place ID.
- Numeric values are non-negative integers at most 100,000. `EXACT` has equal
  bounds and `RANGE` has `minYen < maxYen`.
- Unknown mandatory spend is reference-only and cannot consume zero budget.
- Venue copy is self-authored. No Google/Tabelog description, review, rating,
  photo, or logo is stored.

## Area packs and registry

```ts
type AreaDataPackV3 = {
  schemaVersion: "3";
  packVersion: string;
  status: "CANDIDATE" | "ACTIVE";
  area: PlannerAreaV3;
  generatedAt: string;
  validThrough: string;
  supportedInterestPresets: InterestPresetV3[];
  promotionFixtures: PromotionFixtureV3[];
  calendarSourceIds: string[];
  dataLicense: {
    licenseId: string;
    licenseUrl: string;
    attribution: string;
  };
  station: {
    name: string;
    coordinates: { latitude: number; longitude: number };
    sourceIds: string[];
  };
  sources: SourceRecordV3[];
  places: PlannerPlaceV3[]; // 1..30
};

type AreaRegistryEntryV3 = {
  area: PlannerAreaV3;
  pack: AreaDataPackV3;
  reviewedClaims: ReviewedAreaClaimsV3;
  getEvidence(placeId: string): PlaceEvidenceV3 | null;
};
```

ACTIVE invariants per area:

- At least four routable activities, three routable meals, and two activity
  categories.
- `SURPRISE` plus at least four themed presets; each listed preset has one
  passing, version-bound promotion fixture.
- Station, place, source, calendar, and fixture IDs are unique and resolve.
- `validThrough` is within 60 Tokyo calendar days of generation and precedes
  the hard-stale instant of every source needed by a routable place or fixture.
- Pack-level calendar IDs equal the union of the material place calendar IDs.
- Registry key and pack `area` match exactly.

The travel estimate remains:

```text
route metres = haversine metres x 1.25
raw minutes  = route metres / 75 metres per minute
walk minutes = ceil(raw minutes / 5) x 5
```

## Transient Google data

Only the Google place ID crosses persistent boundaries. Raw Place Details data
is normalized immediately into a request-scoped object:

```ts
type GooglePlaceSignalV3 = {
  placeId: string;
  checkedAt: string;
  openingSignal:
    | "OPEN_AT_PLANNED_TIME"
    | "CLOSED_AT_PLANNED_TIME"
    | "NOT_OPERATIONAL"
    | "UNKNOWN"
    | "NOT_REQUESTED";
  priceLevel?:
    | "PRICE_LEVEL_FREE"
    | "PRICE_LEVEL_INEXPENSIVE"
    | "PRICE_LEVEL_MODERATE"
    | "PRICE_LEVEL_EXPENSIVE"
    | "PRICE_LEVEL_VERY_EXPENSIVE";
  priceRangeJpy?: { minYen?: number; maxYen?: number };
  googleMapsUri?: string;
  attributions: Array<{ provider: string; providerUri?: string }>;
};
```

- The adapter accepts only pre-registered restaurant IDs and uses the fixed
  Google host and fixed field mask.
- `CLOSED_AT_PLANNED_TIME` requires complete Google opening-period data that
  definitely excludes the whole planned visit. Missing/ambiguous hours become
  `UNKNOWN`, never closed by inference.
- Non-JPY price ranges are omitted. Google price level/range are display-only
  and never enter budget, score, group total, canonical IDs, reviewed claims, or
  saved records.
- An omitted response `attributions` field normalizes to `[]`; every returned
  provider attribution must validate and display. Separate Google Maps
  attribution remains mandatory whenever any signal content is shown.
- The normalized signal can appear only in an immediate no-store response and
  in volatile client state. It is dropped on reload and requested again when
  needed.

## Plan and totals

```ts
type EveningPlanStopV3 = {
  position: 0 | 1 | 2;
  kind: PlaceKindV3;
  place: PublicPlaceSnapshotV3;
  startsAt: string;
  endsAt: string;
  price: PriceEvidenceV3;
  priceProvenance: PriceProvenanceV3;
  travelFromPreviousMinutes: number;
  travelFromPreviousDistanceMeters: number;
  travelOriginLabel: string;
  travelMethod: "COORDINATE_ESTIMATE";
  openingFit: string;
  whyThisStop: string;
  sourcePublisher: string;
  sourceCheckedAt: string;
  googleSignal?: GooglePlaceSignalV3; // volatile response only
};

type EveningPlanV3 = {
  schemaVersion: "3";
  planId: string;
  candidateSetId: string;
  areaPackVersion: string;
  intent: PlannerIntentV3;
  stops: EveningPlanStopV3[]; // exact grammar; 2..3
  totals: {
    perPersonMinYen: number;
    perPersonMaxYen: number;
    estimatedGroupMinYen: number;
    estimatedGroupMaxYen: number;
    totalWalkMinutes: number;
    stopCount: 2 | 3;
    startsAt: string;
    endsAt: string;
  };
  scoring: {
    total: number;
    interestFit: number;
    walkingEfficiency: number;
    timeUse: number;
    categoryVariety: number;
  };
  generatedAt: string;
};
```

`perPersonMinYen` and `perPersonMaxYen` are exact sums of official source
bounds. Group bounds are their exact integer products with `partySize`.
Transport, optional orders, and source-unclear tax/service charges are excluded
and disclosed. A Google signal never changes these values.

## Evidence

`PlaceEvidenceV3` mirrors the reviewed official claims needed by one place. It
includes only referenced `SourceRecordV3` entries, calendar sources, official
menu URL where applicable, evidence freshness, and the coordinate-walk method.
Permission files, raw HTML, full packs, and Google raw data never cross the
evidence boundary.

The evidence REST response may include a newly requested normalized
`GooglePlaceSignalV3` for a registered restaurant. It remains a sibling of
official evidence so the UI and serializer cannot represent it as an official
claim.

## Saved plans

```ts
type SavedPlanRecordV3 = {
  schemaVersion: "3";
  savedPlanId: string;
  intent: PlannerIntentV3;
  plan: OfficialPlanSnapshotV3; // EveningPlanV3 with all googleSignal keys absent
  evidence: PlaceEvidenceV3[]; // official evidence only
  googlePlaceIds: string[];
  savedAt: string;
};
```

- Storage key: `serendipity.saved-itineraries.v3`.
- Maximum ten unique records and 256KiB total serialized size.
- Duplicate save returns `ALREADY_SAVED` without duplication or reordering.
- Delete is idempotent (`deleted: false` when absent).
- Storage rejects unknown keys, invalid cross-references, invalid dates/URLs,
  secrets, PII, raw markup, cycles, activity/correlation/session data, and every
  Google field other than a reviewed place ID.
- v2 records are neither read nor migrated. Invalid v3 records are ignored
  independently; explicit mutation may repair readable partial corruption but
  never overwrites unreadable original bytes silently.

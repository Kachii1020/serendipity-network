# Data Model: Source-backed evening planner

The runtime source of truth is a versioned JSON pack. Supabase is not part of
the v2 data path. Every JSON Schema uses `additionalProperties: false`, bounded
strings/arrays, HTTPS URLs, and semantic validation after Ajv validation.

## Intent

```ts
const PLANNER_SCHEMA_VERSION = "2" as const;
const PLANNER_TAGS = [
  "art",
  "books",
  "coffee-tea",
  "food",
  "music",
  "shopping",
  "viewpoint",
  "hands-on",
  "quiet",
  "lively",
  "alcohol",
  "smoking",
  "outdoors",
] as const;

type PlannerIntentV2 = {
  schemaVersion: "2";
  area: "shibuya";
  partySize: 1;
  startAt: string;
  endAt: string;
  totalBudgetYen: number; // integer 0..100_000
  stopCount: "AUTO";
  maxWalkMinutesPerLeg: number; // integer 5..30
  preferredTags: PlannerTag[];
  excludedTags: PlannerTag[];
};
```

- Timestamps are ISO 8601 with `+09:00`, share one local date, span 2–10 hours,
  start at 12:00 or later, and end at 23:30 or earlier. When a clock is supplied,
  the date is Tokyo today through today +7.
- Preferred and excluded arrays are unique, use the closed tag enum, contain at
  most five values each, and do not overlap. UI presets further limit interests
  to three.
- The API applies no hidden defaults. UI defaults are today, 17:00–22:00,
  ¥5,000, 20-minute legs, and art/food.

## Source records and rights

```ts
type SourceUsageV2 =
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
  | { mode: "OFFICIAL_LINK_ONLY" };

type SourceRecordV2 = {
  sourceId: string;
  title: string;
  publisher: string;
  sourceKind: "OPEN_DATASET" | "OFFICIAL_SITE" | "LICENSE_TERMS";
  url: string;
  checkedAt: string;
  publishedAt?: string;
  usage: SourceUsageV2;
  notes?: string;
};

type EvidenceReferenceV2 = { sourceId: string; checkedAt: string };

type PlaceEvidenceRefsV2 = {
  identity: EvidenceReferenceV2;
  location: EvidenceReferenceV2;
  hours: EvidenceReferenceV2;
  price: EvidenceReferenceV2;
  officialLink: EvidenceReferenceV2;
};
```

- Factual references may use only `OPEN_LICENSE` or
  `EXPLICIT_PERMISSION`. `OFFICIAL_LINK_ONLY` is used solely to validate an
  outbound `officialUrl`; `officialLink` must reference an `OFFICIAL_SITE` on
  the same origin.
- An explicit permission path must be one file directly under
  `specs/002-source-backed-evening-planner/evidence/permissions/`; the evidence
  file is never bundled or returned.
- ACTIVE promotion requires every source `checkedAt` to be no later than
  `generatedAt` and no more than seven days old at that moment.
- At runtime, hours/price use the newest referenced source check: older than 14
  days adds a warning; older than 60 days excludes the place. If this exclusion
  removes all routes, return `STALE_DATA_PACK`.

## Place and price

```ts
const PLACE_CATEGORIES_V2 = [
  "heritage",
  "library",
  "park",
  "fitness",
  "pool",
  "public-space",
] as const;

type PriceEvidenceV2 =
  | { kind: "FREE"; minYen: 0; maxYen: 0; label: string }
  | { kind: "EXACT"; minYen: number; maxYen: number; label: string }
  | { kind: "RANGE"; minYen: number; maxYen: number; label: string };

type PlannerPlaceV2 = {
  placeId: string;
  name: string;
  summary: string;
  category: PlaceCategoryV2;
  address: string;
  coordinates: { latitude: number; longitude: number };
  tags: PlannerTag[];
  officialUrl: string;
  recommendedVisitMinutes: number; // integer 20..180
  weeklyHours: Array<{
    days: number[]; // unique 0..6, Sunday=0
    opens: string; // HH:mm
    closes: string; // HH:mm; closes > opens, no overnight
  }>;
  dateExceptions: Array<
    | { date: string; closed: true; note: string }
    | {
        date: string;
        closed: false;
        opens: string;
        closes: string;
        note: string;
      }
  >;
  price: PriceEvidenceV2;
  evidence: PlaceEvidenceRefsV2;
};
```

- `EXACT` requires equal min/max; `RANGE` requires `min < max`; all amounts are
  non-negative integers at most 100,000.
- Budget feasibility uses the conservative sum of `maxYen`; output shows both
  summed minimum and maximum.
- Place IDs and source IDs are unique. ACTIVE requires at least nine places and
  three categories.
- `capacity`, `inventory`, `hold`, `reservation`, `discount`, live status, and
  any `UNKNOWN` value are forbidden.

## Pack

```ts
type PlaceDataPackV2 = {
  schemaVersion: "2";
  packVersion: string; // semantic x.y.z
  status: "CANDIDATE" | "ACTIVE";
  area: "shibuya";
  generatedAt: string;
  dataLicense: {
    licenseId: string;
    licenseUrl: string;
    attribution: string;
  };
  station: {
    name: "Shibuya Station";
    coordinates: { latitude: number; longitude: number };
    sourceIds: string[]; // reusable factual sources only
  };
  sources: SourceRecordV2[];
  places: PlannerPlaceV2[]; // 1..30; ACTIVE >=9
};
```

There is deliberately no travel matrix or `travelEdges`. Walking is a labelled
coordinate estimate computed for station→first and place→place legs:

```text
route metres = haversine metres × 1.25
raw minutes  = route metres / 75 metres per minute
walk minutes = ceil(raw minutes / 5) × 5
```

An estimated leg is rejected when it exceeds `maxWalkMinutesPerLeg`; it is not
clamped to 30. The UI/result always exposes
`travelMethod: "COORDINATE_ESTIMATE"` and never presents the estimate as a live
map route. A stop may wait at most 30 minutes for opening, and every plan must
contain at least two place categories.

## Plan

```ts
type EveningPlanStopV2 = {
  position: 0 | 1 | 2;
  place: {
    placeId: string;
    name: string;
    summary: string;
    category: PlaceCategoryV2;
    address: string;
    tags: PlannerTag[];
    officialUrl: string;
  };
  startsAt: string;
  endsAt: string;
  price: PriceEvidenceV2;
  travelFromPreviousMinutes: number;
  travelFromPreviousDistanceMeters: number;
  travelOriginLabel: string;
  travelMethod: "COORDINATE_ESTIMATE";
  travelLabel: string;
  openingFit: string;
  whyThisStop: string;
  sourcePublisher: string;
  sourceCheckedAt: string;
};

type EveningPlanV2 = {
  schemaVersion: "2";
  planId: string;
  candidateSetId: string;
  packVersion: string;
  intent: PlannerIntentV2;
  stops: EveningPlanStopV2[]; // 2..3, distinct, contiguous positions
  totals: {
    minPriceYen: number;
    maxPriceYen: number;
    totalWalkMinutes: number;
    stopCount: number;
    startsAt: string;
    endsAt: string;
  };
  score: number;
  scoreBreakdown: {
    preferenceFit: number;
    walkingEfficiency: number;
    timeUtilization: number;
    categoryDiversity: number;
  };
  reasonCodes: Array<
    | "MATCHES_INTERESTS"
    | "SHORT_WALKS"
    | "USES_TIME_WELL"
    | "VARIED_STOPS"
    | "WITHIN_BUDGET"
  >;
  travelMethod: "COORDINATE_ESTIMATE";
  disclaimer: "Built from published information, not live availability. Check each official site before you go.";
};
```

Search returns exactly one plan. The controller retains the candidate context
needed for one-stop swap but does not expose a marketplace list.

## Evidence projection

```ts
type PlaceEvidenceV2 = {
  schemaVersion: "2";
  packVersion: string;
  placeId: string;
  placeName: string;
  officialUrl: string;
  evidenceAsOf: string;
  claims: {
    identity: EvidenceClaimV2;
    address: EvidenceClaimV2;
    hours: EvidenceClaimV2;
    price: EvidenceClaimV2;
    officialLink: EvidenceClaimV2;
  };
  sources: SourceRecordV2[];
};

type EvidenceClaimV2 = {
  kind: "IDENTITY" | "ADDRESS" | "HOURS" | "PRICE" | "OFFICIAL_LINK";
  value: string;
  publisher: string;
  sourceTitle: string;
  sourceUrl: string;
  checkedAt: string;
};
```

Only sources referenced by the place's five evidence references are returned.
Permission documents and full pack content are never returned.

## Local saved plans

```ts
type SavedPlanRecordV2 = {
  evidence: Record<string, PlaceEvidenceV2>;
  intent: PlannerIntentV2;
  itinerary: EveningPlanV2;
  savedAt: string;
  savedPlanId: string; // planId
};

type SavedPlanDocumentV2 = {
  schemaVersion: "2";
  records: SavedPlanRecordV2[]; // newest first, max 10
};
```

- Key: `serendipity.saved-itineraries.v2`; serialized cap: 256 KiB.
- A duplicate is idempotent `ALREADY_SAVED`; it is not rewritten or reordered.
- The eleventh distinct plan returns `STORAGE_LIMIT_REACHED`; no silent eviction.
- Corrupt data is preserved and reported; failed writes keep previous bytes.
- Delete is idempotent and returns `NOT_FOUND` when already absent.
- No server migration exists because v1 has no equivalent saved-plan store.

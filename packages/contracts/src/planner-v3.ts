import {
  INTEREST_PRESET_TAGS_V3,
  PLANNER_V3_AREAS,
  PLANNER_V3_ERROR_CODES,
  PLANNER_V3_INTEREST_PRESETS,
  PLANNER_V3_SCHEMA_VERSION,
  PLANNER_V3_TAGS,
  SWAP_PREFERENCES_V3,
  isHttpsUrlV3,
  isStrictCalendarDateV3,
  isStrictTimestampV3,
  isValidPlannerIdV3,
} from "./planner-v3-shared";

export {
  INTEREST_PRESET_TAGS_V3,
  PLANNER_V3_AREAS,
  PLANNER_V3_ERROR_CODES,
  PLANNER_V3_INTEREST_PRESETS,
  PLANNER_V3_SCHEMA_VERSION,
  PLANNER_V3_TAGS,
  SWAP_PREFERENCES_V3,
  isStrictCalendarDateV3,
  isStrictTimestampV3,
} from "./planner-v3-shared";

export const PLACE_ROLES_V3 = ["ACTIVITY", "MEAL"] as const;
export const PLACE_CATEGORIES_V3 = [
  "heritage",
  "library",
  "park",
  "gallery",
  "botanical",
  "science-center",
  "museum",
  "experience",
  "restaurant",
  "cafe",
  "public-space",
] as const;
export const PRICE_KINDS_V3 = ["FREE", "PER_PERSON", "PER_GROUP"] as const;
export const PLANNER_V3_DISCLAIMER =
  "Built from published information, not live availability. Check each official site before you go." as const;

export type PlannerAreaV3 = (typeof PLANNER_V3_AREAS)[number];
export type InterestPresetV3 = (typeof PLANNER_V3_INTEREST_PRESETS)[number];
export type PlannerTagV3 = (typeof PLANNER_V3_TAGS)[number];
export type SwapPreferenceV3 = (typeof SWAP_PREFERENCES_V3)[number];
export type PlannerErrorCodeV3 = (typeof PLANNER_V3_ERROR_CODES)[number];
export type PlaceRoleV3 = (typeof PLACE_ROLES_V3)[number];
export type PlaceCategoryV3 = (typeof PLACE_CATEGORIES_V3)[number];

export type CoordinatesV3 = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type PlannerIntentV3 = Readonly<{
  schemaVersion: "3";
  area: PlannerAreaV3;
  partySize: 1 | 2 | 3;
  startAt: string;
  endAt: string;
  budgetPerPersonYen: number;
  includeMeal: boolean;
  interestPreset: InterestPresetV3;
  maxWalkMinutesPerLeg: number;
  excludedTags: PlannerTagV3[];
}>;

export type SourceUsageV3 =
  | Readonly<{
      mode: "OPEN_LICENSE";
      licenseId: string;
      licenseUrl: string;
      attribution: string;
    }>
  | Readonly<{
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
    }>
  | Readonly<{ mode: "OFFICIAL_LINK_ONLY" }>;

export type SourceRecordV3 = Readonly<{
  sourceId: string;
  title: string;
  publisher: string;
  sourceKind:
    "OPEN_DATASET" | "OFFICIAL_SITE" | "OFFICIAL_MENU" | "LICENSE_TERMS";
  url: string;
  checkedAt: string;
  publishedAt?: string;
  usage: SourceUsageV3;
  notes?: string;
}>;

export type EvidenceReferenceV3 = Readonly<{
  sourceId: string;
  checkedAt: string;
}>;

export type PriceEvidenceV3 = Readonly<{
  kind: "FREE" | "PER_PERSON" | "PER_GROUP";
  minYen: number;
  maxYen: number;
  label: string;
}>;

export type WeeklyHoursV3 = Readonly<{
  days: number[];
  opens: string;
  closes: string;
}>;

export type DateExceptionV3 =
  | Readonly<{ date: string; closed: true; note: string }>
  | Readonly<{
      date: string;
      closed: false;
      opens: string;
      closes: string;
      note: string;
    }>;

export type PlannerPlaceV3 = Readonly<{
  placeId: string;
  role: PlaceRoleV3;
  name: string;
  summary: string;
  category: PlaceCategoryV3;
  address: string;
  coordinates: CoordinatesV3;
  tags: PlannerTagV3[];
  officialUrl: string;
  googlePlaceId: string | null;
  recommendedVisitMinutes: number;
  weeklyHours: WeeklyHoursV3[];
  dateExceptions: DateExceptionV3[];
  price: PriceEvidenceV3;
  evidence: Readonly<{
    identity: EvidenceReferenceV3;
    address: EvidenceReferenceV3;
    coordinates: EvidenceReferenceV3;
    hours: EvidenceReferenceV3;
    price: EvidenceReferenceV3;
    publicAccess: EvidenceReferenceV3;
    officialLink: EvidenceReferenceV3;
    menu: EvidenceReferenceV3 | null;
  }>;
}>;

export type AreaDataPackV3 = Readonly<{
  schemaVersion: "3";
  packVersion: string;
  status: "CANDIDATE" | "ACTIVE";
  area: PlannerAreaV3;
  generatedAt: string;
  validThrough: string;
  dataLicense: Readonly<{
    licenseId: string;
    licenseUrl: string;
    attribution: string;
  }>;
  station: Readonly<{
    name: string;
    coordinates: CoordinatesV3;
    sourceIds: string[];
  }>;
  sources: SourceRecordV3[];
  places: PlannerPlaceV3[];
}>;

export type ReviewedPackClaimsV3 = Readonly<{
  schemaVersion: "3";
  packVersion: string;
  area: PlannerAreaV3;
  pack: AreaDataPackV3;
}>;
export type ReviewedPackClaimLedgerV3 = Readonly<
  Record<string, ReviewedPackClaimsV3>
>;

export type CompactPlannerPlaceV3 = Pick<
  PlannerPlaceV3,
  | "placeId"
  | "role"
  | "name"
  | "summary"
  | "category"
  | "address"
  | "tags"
  | "officialUrl"
  | "googlePlaceId"
>;

export type StopCostV3 = Readonly<{
  perPersonMinYen: number;
  perPersonMaxYen: number;
  estimatedGroupMinYen: number;
  estimatedGroupMaxYen: number;
}>;

export const projectPriceCostV3 = (
  price: PriceEvidenceV3,
  partySize: 1 | 2 | 3,
): StopCostV3 => {
  if (price.kind === "FREE") {
    return {
      perPersonMinYen: 0,
      perPersonMaxYen: 0,
      estimatedGroupMinYen: 0,
      estimatedGroupMaxYen: 0,
    };
  }
  if (price.kind === "PER_PERSON") {
    return {
      perPersonMinYen: price.minYen,
      perPersonMaxYen: price.maxYen,
      estimatedGroupMinYen: price.minYen * partySize,
      estimatedGroupMaxYen: price.maxYen * partySize,
    };
  }
  return {
    perPersonMinYen: Math.ceil(price.minYen / partySize),
    perPersonMaxYen: Math.ceil(price.maxYen / partySize),
    estimatedGroupMinYen: price.minYen,
    estimatedGroupMaxYen: price.maxYen,
  };
};

export type EveningPlanStopV3 = Readonly<{
  position: number;
  place: CompactPlannerPlaceV3;
  startsAt: string;
  endsAt: string;
  price: PriceEvidenceV3;
  cost: StopCostV3;
  travelFromPreviousMinutes: number;
  travelFromPreviousDistanceMeters: number;
  travelOriginLabel: string;
  travelMethod: "COORDINATE_ESTIMATE";
  openingFit: string;
  whyThisStop: string;
  sourcePublisher: string;
  sourceCheckedAt: string;
}>;

export type EveningPlanV3 = Readonly<{
  schemaVersion: "3";
  planId: string;
  candidateSetId: string;
  packVersion: string;
  intent: PlannerIntentV3;
  stops: EveningPlanStopV3[];
  totals: Readonly<{
    perPersonMinYen: number;
    perPersonMaxYen: number;
    estimatedGroupMinYen: number;
    estimatedGroupMaxYen: number;
    totalWalkMinutes: number;
    stopCount: number;
    startsAt: string;
    endsAt: string;
  }>;
  score: number;
  scoreBreakdown: Readonly<{
    preferenceFit: number;
    walkingEfficiency: number;
    timeUtilization: number;
    categoryDiversity: number;
  }>;
  reasonCodes: Array<
    | "MATCHES_INTEREST"
    | "SHORT_WALKS"
    | "USES_TIME_WELL"
    | "VARIED_STOPS"
    | "WITHIN_BUDGET"
  >;
  travelMethod: "COORDINATE_ESTIMATE";
  disclaimer: typeof PLANNER_V3_DISCLAIMER;
}>;

export type SearchPlanInputV3 = PlannerIntentV3;
export type GooglePlaceSignalV3 = Readonly<{
  placeId: string;
  googlePlaceId: string;
  businessStatus:
    "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "UNKNOWN";
  openNow: boolean | null;
  priceLevel: string | null;
  priceRangeLabel: string | null;
  googleMapsUri: string | null;
  attributions: Array<Readonly<{ provider: string; uri: string | null }>>;
}>;
export type SearchPlansDataV3 = Readonly<{
  candidateSetId: string;
  plan: EveningPlanV3;
  warnings: string[];
  googleSignals: GooglePlaceSignalV3[];
}>;
export type SwapPlanInputV3 = Readonly<{
  schemaVersion: "3";
  candidateSetId: string;
  planId: string;
  intent: PlannerIntentV3;
  plan: EveningPlanV3;
  stopIndex: number;
  preference: SwapPreferenceV3;
}>;
export type SwapPlanDataV3 = Readonly<{
  candidateSetId: string;
  plan: EveningPlanV3;
  replacedStopIndex: number;
  preference: SwapPreferenceV3;
  warnings: string[];
  googleSignals: GooglePlaceSignalV3[];
}>;
export type ShowPlaceEvidenceInputV3 = Readonly<{
  schemaVersion: "3";
  area: PlannerAreaV3;
  packVersion: string;
  placeId: string;
}>;
export type SavePlanInputV3 = Readonly<{
  schemaVersion: "3";
  candidateSetId: string;
  planId: string;
}>;
export type DeleteSavedPlanInputV3 = Readonly<{
  schemaVersion: "3";
  planId: string;
}>;

export type EvidenceClaimV3 = Readonly<{
  kind:
    | "IDENTITY"
    | "ADDRESS"
    | "COORDINATES"
    | "HOURS"
    | "PRICE"
    | "PUBLIC_ACCESS"
    | "OFFICIAL_LINK"
    | "MENU";
  value: string;
  publisher: string;
  sourceTitle: string;
  sourceUrl: string;
  checkedAt: string;
}>;
export type PlaceEvidenceV3 = Readonly<{
  schemaVersion: "3";
  packVersion: string;
  area: PlannerAreaV3;
  placeId: string;
  placeName: string;
  officialUrl: string;
  evidenceAsOf: string;
  claims: Readonly<{
    identity: EvidenceClaimV3;
    address: EvidenceClaimV3;
    coordinates: EvidenceClaimV3;
    hours: EvidenceClaimV3;
    price: EvidenceClaimV3;
    publicAccess: EvidenceClaimV3;
    officialLink: EvidenceClaimV3;
    menu: EvidenceClaimV3 | null;
  }>;
  sources: SourceRecordV3[];
}>;
export type PlaceEvidenceDataV3 = Readonly<{
  evidence: PlaceEvidenceV3;
  googleSignal: GooglePlaceSignalV3 | null;
}>;

export type PlannerMetaV3 = Readonly<{
  correlationId: string;
  origin: string;
  completedAt: string;
  packVersion: string | null;
  area: PlannerAreaV3 | null;
}>;
export type PlannerPublicErrorV3 = Readonly<{
  code: PlannerErrorCodeV3;
  message: string;
  retryable: boolean;
}>;
export type PlannerEnvelopeV3<T> =
  | Readonly<{
      schemaVersion: "3";
      ok: true;
      data: T;
      meta: PlannerMetaV3;
    }>
  | Readonly<{
      schemaVersion: "3";
      ok: false;
      error: PlannerPublicErrorV3;
      meta: PlannerMetaV3;
    }>;

export type PlannerValidationResultV3<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "VALIDATION_ERROR" | "UNSUPPORTED_SCHEMA_VERSION";
      issues: string[];
    };

const timestampSchema = {
  type: "string",
  pattern:
    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
} as const;
const opaqueIdSchema = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
} as const;
const packVersionSchema = {
  type: "string",
  minLength: 5,
  maxLength: 32,
  pattern: "^[1-9]\\d*\\.\\d+\\.\\d+$",
} as const;

export const plannerIntentV3Schema = {
  $comment: "serendipity.planner-intent.v3",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "area",
    "partySize",
    "startAt",
    "endAt",
    "budgetPerPersonYen",
    "includeMeal",
    "interestPreset",
    "maxWalkMinutesPerLeg",
    "excludedTags",
  ],
  properties: {
    schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
    area: { enum: PLANNER_V3_AREAS },
    partySize: { type: "integer", minimum: 1, maximum: 3 },
    startAt: timestampSchema,
    endAt: timestampSchema,
    budgetPerPersonYen: {
      type: "integer",
      minimum: 0,
      maximum: 30_000,
    },
    includeMeal: { type: "boolean" },
    interestPreset: { enum: PLANNER_V3_INTEREST_PRESETS },
    maxWalkMinutesPerLeg: { type: "integer", minimum: 5, maximum: 30 },
    excludedTags: {
      type: "array",
      maxItems: 5,
      uniqueItems: true,
      items: { enum: PLANNER_V3_TAGS },
    },
  },
} as const;

export const showPlaceEvidenceInputV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "area", "packVersion", "placeId"],
  properties: {
    schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
    area: { enum: PLANNER_V3_AREAS },
    packVersion: packVersionSchema,
    placeId: opaqueIdSchema,
  },
} as const;
export const savePlanInputV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "candidateSetId", "planId"],
  properties: {
    schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
    candidateSetId: opaqueIdSchema,
    planId: opaqueIdSchema,
  },
} as const;
export const deleteSavedPlanInputV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "planId"],
  properties: {
    schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
    planId: opaqueIdSchema,
  },
} as const;

export const swapPlanInputV3Schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "candidateSetId",
    "planId",
    "intent",
    "plan",
    "stopIndex",
    "preference",
  ],
  properties: {
    schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
    candidateSetId: opaqueIdSchema,
    planId: opaqueIdSchema,
    intent: plannerIntentV3Schema,
    plan: { type: "object" },
    stopIndex: { type: "integer", minimum: 0, maximum: 2 },
    preference: { enum: SWAP_PREFERENCES_V3 },
  },
} as const;

export const plannerErrorV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message", "retryable"],
  properties: {
    code: { enum: PLANNER_V3_ERROR_CODES },
    message: { type: "string", minLength: 1, maxLength: 240 },
    retryable: { type: "boolean" },
  },
} as const;
export const plannerMetaV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["correlationId", "origin", "completedAt", "packVersion", "area"],
  properties: {
    correlationId: opaqueIdSchema,
    origin: {
      type: "string",
      pattern:
        "^(?:https://[^/]+(?::\\d+)?|http://(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?)$",
    },
    completedAt: timestampSchema,
    packVersion: { oneOf: [packVersionSchema, { type: "null" }] },
    area: { oneOf: [{ enum: PLANNER_V3_AREAS }, { type: "null" }] },
  },
} as const;
export const plannerEnvelopeV3Schema = <const TData extends object>(
  dataSchema: TData,
) =>
  ({
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "ok", "data", "meta"],
        properties: {
          schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
          ok: { const: true },
          data: dataSchema,
          meta: plannerMetaV3Schema,
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "ok", "error", "meta"],
        properties: {
          schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
          ok: { const: false },
          error: plannerErrorV3Schema,
          meta: plannerMetaV3Schema,
        },
      },
    ],
  }) as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => key in value) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
};
const inList = <T extends string>(
  value: unknown,
  values: readonly T[],
): value is T => typeof value === "string" && values.includes(value as T);
const boundedString = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maximum;
const validInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is number =>
  Number.isInteger(value) &&
  (value as number) >= minimum &&
  (value as number) <= maximum;
const validCoordinate = (value: unknown): value is CoordinatesV3 =>
  isRecord(value) &&
  exactKeys(value, ["latitude", "longitude"]) &&
  typeof value.latitude === "number" &&
  Number.isFinite(value.latitude) &&
  value.latitude >= -90 &&
  value.latitude <= 90 &&
  typeof value.longitude === "number" &&
  Number.isFinite(value.longitude) &&
  value.longitude >= -180 &&
  value.longitude <= 180;
const validLocalTime = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const timeToMinutes = (value: string): number => {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const validTags = (value: unknown): value is PlannerTagV3[] =>
  Array.isArray(value) &&
  value.length <= 5 &&
  new Set(value).size === value.length &&
  value.every((tag) => inList(tag, PLANNER_V3_TAGS));
const validPrice = (value: unknown): value is PriceEvidenceV3 =>
  isRecord(value) &&
  exactKeys(value, ["kind", "minYen", "maxYen", "label"]) &&
  inList(value.kind, PRICE_KINDS_V3) &&
  validInteger(value.minYen, 0, 100_000) &&
  validInteger(value.maxYen, 0, 100_000) &&
  value.minYen <= value.maxYen &&
  boundedString(value.label, 160) &&
  (value.kind !== "FREE" || (value.minYen === 0 && value.maxYen === 0));
const validEvidenceReference = (value: unknown): value is EvidenceReferenceV3 =>
  isRecord(value) &&
  exactKeys(value, ["sourceId", "checkedAt"]) &&
  isValidPlannerIdV3(value.sourceId) &&
  isStrictTimestampV3(value.checkedAt);

const unsupportedVersion = (value: unknown): boolean =>
  isRecord(value) &&
  "schemaVersion" in value &&
  value.schemaVersion !== PLANNER_V3_SCHEMA_VERSION;
const failure = <T>(
  value: unknown,
  issues: string[],
): PlannerValidationResultV3<T> =>
  unsupportedVersion(value)
    ? {
        ok: false,
        code: "UNSUPPORTED_SCHEMA_VERSION",
        issues: ["/schemaVersion must equal 3"],
      }
    : { ok: false, code: "VALIDATION_ERROR", issues };

const dateInJst = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);

export const validatePlannerIntentV3 = (
  value: unknown,
  options: { now?: Date } = {},
): PlannerValidationResultV3<PlannerIntentV3> => {
  const required = [
    "schemaVersion",
    "area",
    "partySize",
    "startAt",
    "endAt",
    "budgetPerPersonYen",
    "includeMeal",
    "interestPreset",
    "maxWalkMinutesPerLeg",
    "excludedTags",
  ];
  if (
    !isRecord(value) ||
    !exactKeys(value, required) ||
    value.schemaVersion !== "3" ||
    !inList(value.area, PLANNER_V3_AREAS) ||
    !validInteger(value.partySize, 1, 3) ||
    !isStrictTimestampV3(value.startAt) ||
    !value.startAt.endsWith("+09:00") ||
    !isStrictTimestampV3(value.endAt) ||
    !value.endAt.endsWith("+09:00") ||
    !validInteger(value.budgetPerPersonYen, 0, 30_000) ||
    typeof value.includeMeal !== "boolean" ||
    !inList(value.interestPreset, PLANNER_V3_INTEREST_PRESETS) ||
    !validInteger(value.maxWalkMinutesPerLeg, 5, 30) ||
    !validTags(value.excludedTags)
  ) {
    return failure(value, ["/ must be a valid PlannerIntentV3"]);
  }
  const intent = value as PlannerIntentV3;
  const issues: string[] = [];
  const start = Date.parse(intent.startAt);
  const end = Date.parse(intent.endAt);
  const duration = (end - start) / 60_000;
  if (end <= start) issues.push("/endAt must be later than /startAt");
  if (intent.startAt.slice(0, 10) !== intent.endAt.slice(0, 10)) {
    issues.push("/startAt and /endAt must share one local date");
  }
  if (duration < 120 || duration > 600) {
    issues.push("/startAt to /endAt must span 2 to 10 hours");
  }
  if (timeToMinutes(intent.startAt.slice(11, 16)) < 12 * 60) {
    issues.push("/startAt local time must be 12:00 or later");
  }
  if (timeToMinutes(intent.endAt.slice(11, 16)) > 23 * 60 + 30) {
    issues.push("/endAt local time must be 23:30 or earlier");
  }
  if (!intent.includeMeal && intent.interestPreset === "FOOD_DISCOVERY") {
    issues.push("/interestPreset FOOD_DISCOVERY requires /includeMeal true");
  }
  if (options.now) {
    const requested = intent.startAt.slice(0, 10);
    const today = dateInJst(options.now);
    const days =
      (Date.parse(`${requested}T00:00:00+09:00`) -
        Date.parse(`${today}T00:00:00+09:00`)) /
      86_400_000;
    if (days < 0 || days > 7) {
      issues.push("/startAt date must be today through seven days from now");
    }
    if (start < options.now.getTime() - 5 * 60_000) {
      issues.push("/startAt must not be more than five minutes in the past");
    }
  }
  return issues.length > 0
    ? failure(value, issues)
    : { ok: true, value: intent };
};

const validSourceUsage = (value: unknown): value is SourceUsageV3 => {
  if (!isRecord(value) || typeof value.mode !== "string") return false;
  if (value.mode === "OFFICIAL_LINK_ONLY") {
    return exactKeys(value, ["mode"]);
  }
  if (value.mode === "OPEN_LICENSE") {
    return (
      exactKeys(value, ["mode", "licenseId", "licenseUrl", "attribution"]) &&
      boundedString(value.licenseId, 80) &&
      isHttpsUrlV3(value.licenseUrl) &&
      boundedString(value.attribution, 300)
    );
  }
  const scopes = [
    "IDENTITY",
    "ADDRESS",
    "COORDINATES",
    "HOURS",
    "PRICE",
    "PUBLIC_ACCESS",
    "MENU",
  ] as const;
  return (
    value.mode === "OFFICIAL_FACT_REFERENCE" &&
    exactKeys(value, ["mode", "factScope", "attribution"]) &&
    Array.isArray(value.factScope) &&
    value.factScope.length > 0 &&
    value.factScope.length <= 7 &&
    new Set(value.factScope).size === value.factScope.length &&
    value.factScope.every((scope) => inList(scope, scopes)) &&
    boundedString(value.attribution, 300)
  );
};

const validSource = (value: unknown): value is SourceRecordV3 =>
  isRecord(value) &&
  exactKeys(
    value,
    [
      "sourceId",
      "title",
      "publisher",
      "sourceKind",
      "url",
      "checkedAt",
      "usage",
    ],
    ["publishedAt", "notes"],
  ) &&
  isValidPlannerIdV3(value.sourceId) &&
  boundedString(value.title, 160) &&
  boundedString(value.publisher, 120) &&
  inList(value.sourceKind, [
    "OPEN_DATASET",
    "OFFICIAL_SITE",
    "OFFICIAL_MENU",
    "LICENSE_TERMS",
  ] as const) &&
  isHttpsUrlV3(value.url) &&
  isStrictTimestampV3(value.checkedAt) &&
  (value.publishedAt === undefined || isStrictTimestampV3(value.publishedAt)) &&
  validSourceUsage(value.usage) &&
  (value.notes === undefined || boundedString(value.notes, 500));

const validHours = (value: unknown): value is WeeklyHoursV3 =>
  isRecord(value) &&
  exactKeys(value, ["days", "opens", "closes"]) &&
  Array.isArray(value.days) &&
  value.days.length > 0 &&
  value.days.length <= 7 &&
  new Set(value.days).size === value.days.length &&
  value.days.every((day) => validInteger(day, 0, 6)) &&
  validLocalTime(value.opens) &&
  validLocalTime(value.closes) &&
  timeToMinutes(value.closes) > timeToMinutes(value.opens);

const validDateException = (value: unknown): value is DateExceptionV3 => {
  if (!isRecord(value) || !isStrictCalendarDateV3(value.date)) return false;
  if (value.closed === true) {
    return (
      exactKeys(value, ["date", "closed", "note"]) &&
      boundedString(value.note, 160)
    );
  }
  return (
    value.closed === false &&
    exactKeys(value, ["date", "closed", "opens", "closes", "note"]) &&
    validLocalTime(value.opens) &&
    validLocalTime(value.closes) &&
    timeToMinutes(value.closes) > timeToMinutes(value.opens) &&
    boundedString(value.note, 160)
  );
};

const validPlace = (value: unknown): value is PlannerPlaceV3 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "placeId",
      "role",
      "name",
      "summary",
      "category",
      "address",
      "coordinates",
      "tags",
      "officialUrl",
      "googlePlaceId",
      "recommendedVisitMinutes",
      "weeklyHours",
      "dateExceptions",
      "price",
      "evidence",
    ]) ||
    !isValidPlannerIdV3(value.placeId) ||
    !inList(value.role, PLACE_ROLES_V3) ||
    !boundedString(value.name, 120) ||
    !boundedString(value.summary, 240) ||
    !inList(value.category, PLACE_CATEGORIES_V3) ||
    !boundedString(value.address, 240) ||
    !validCoordinate(value.coordinates) ||
    !validTags(value.tags) ||
    !isHttpsUrlV3(value.officialUrl) ||
    !(
      value.googlePlaceId === null ||
      (boundedString(value.googlePlaceId, 180) &&
        /^[A-Za-z0-9_-]+$/.test(value.googlePlaceId))
    ) ||
    !validInteger(value.recommendedVisitMinutes, 20, 180) ||
    !Array.isArray(value.weeklyHours) ||
    value.weeklyHours.length < 1 ||
    value.weeklyHours.length > 14 ||
    !value.weeklyHours.every(validHours) ||
    !Array.isArray(value.dateExceptions) ||
    value.dateExceptions.length > 60 ||
    !value.dateExceptions.every(validDateException) ||
    !validPrice(value.price) ||
    !isRecord(value.evidence) ||
    !exactKeys(value.evidence, [
      "identity",
      "address",
      "coordinates",
      "hours",
      "price",
      "publicAccess",
      "officialLink",
      "menu",
    ]) ||
    !validEvidenceReference(value.evidence.identity) ||
    !validEvidenceReference(value.evidence.address) ||
    !validEvidenceReference(value.evidence.coordinates) ||
    !validEvidenceReference(value.evidence.hours) ||
    !validEvidenceReference(value.evidence.price) ||
    !validEvidenceReference(value.evidence.publicAccess) ||
    !validEvidenceReference(value.evidence.officialLink) ||
    !(
      value.evidence.menu === null ||
      validEvidenceReference(value.evidence.menu)
    )
  ) {
    return false;
  }
  return value.role === "MEAL"
    ? value.category === "restaurant" || value.category === "cafe"
      ? value.price.kind === "PER_PERSON" && value.evidence.menu !== null
      : false
    : value.category !== "restaurant" &&
        value.category !== "cafe" &&
        value.evidence.menu === null;
};

const sourceSupports = (
  source: SourceRecordV3,
  claim:
    | "IDENTITY"
    | "ADDRESS"
    | "COORDINATES"
    | "HOURS"
    | "PRICE"
    | "PUBLIC_ACCESS"
    | "MENU"
    | "OFFICIAL_LINK",
): boolean => {
  if (claim === "OFFICIAL_LINK") {
    return ["OFFICIAL_SITE", "OFFICIAL_MENU"].includes(source.sourceKind);
  }
  return (
    source.usage.mode === "OPEN_LICENSE" ||
    (source.usage.mode === "OFFICIAL_FACT_REFERENCE" &&
      source.usage.factScope.includes(claim))
  );
};

export const validateAreaDataPackV3 = (
  value: unknown,
): PlannerValidationResultV3<AreaDataPackV3> => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "packVersion",
      "status",
      "area",
      "generatedAt",
      "validThrough",
      "dataLicense",
      "station",
      "sources",
      "places",
    ]) ||
    value.schemaVersion !== "3" ||
    !boundedString(value.packVersion, 32) ||
    !/^[1-9]\d*\.\d+\.\d+$/.test(value.packVersion) ||
    !inList(value.status, ["CANDIDATE", "ACTIVE"] as const) ||
    !inList(value.area, PLANNER_V3_AREAS) ||
    !isStrictTimestampV3(value.generatedAt) ||
    !value.generatedAt.endsWith("+09:00") ||
    !isStrictTimestampV3(value.validThrough) ||
    !value.validThrough.endsWith("+09:00") ||
    !isRecord(value.dataLicense) ||
    !exactKeys(value.dataLicense, ["licenseId", "licenseUrl", "attribution"]) ||
    !boundedString(value.dataLicense.licenseId, 80) ||
    !isHttpsUrlV3(value.dataLicense.licenseUrl) ||
    !boundedString(value.dataLicense.attribution, 300) ||
    !isRecord(value.station) ||
    !exactKeys(value.station, ["name", "coordinates", "sourceIds"]) ||
    !boundedString(value.station.name, 120) ||
    !validCoordinate(value.station.coordinates) ||
    !Array.isArray(value.station.sourceIds) ||
    value.station.sourceIds.length < 1 ||
    value.station.sourceIds.length > 4 ||
    new Set(value.station.sourceIds).size !== value.station.sourceIds.length ||
    !value.station.sourceIds.every(isValidPlannerIdV3) ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    value.sources.length > 150 ||
    !value.sources.every(validSource) ||
    !Array.isArray(value.places) ||
    value.places.length < 1 ||
    value.places.length > 40 ||
    !value.places.every(validPlace)
  ) {
    return failure(value, ["/ must be a valid AreaDataPackV3"]);
  }
  const pack = value as unknown as AreaDataPackV3;
  const issues: string[] = [];
  const generated = Date.parse(pack.generatedAt);
  const validThrough = Date.parse(pack.validThrough);
  if (validThrough <= generated || validThrough - generated > 60 * 86_400_000) {
    issues.push("/validThrough must follow generatedAt by at most sixty days");
  }
  const sourceById = new Map<string, SourceRecordV3>();
  for (const [index, source] of pack.sources.entries()) {
    if (sourceById.has(source.sourceId)) {
      issues.push(`/sources/${index}/sourceId must be unique`);
    }
    sourceById.set(source.sourceId, source);
    if (Date.parse(source.checkedAt) > generated) {
      issues.push(`/sources/${index}/checkedAt must not follow generatedAt`);
    }
    if (
      pack.status === "ACTIVE" &&
      generated - Date.parse(source.checkedAt) > 7 * 86_400_000
    ) {
      issues.push(`/sources/${index}/checkedAt must be within seven days`);
    }
    if (
      source.usage.mode === "OFFICIAL_FACT_REFERENCE" &&
      !["OFFICIAL_SITE", "OFFICIAL_MENU"].includes(source.sourceKind)
    ) {
      issues.push(
        `/sources/${index} official facts require an official source`,
      );
    }
  }
  for (const sourceId of pack.station.sourceIds) {
    const source = sourceById.get(sourceId);
    if (!source || !sourceSupports(source, "COORDINATES")) {
      issues.push("/station/sourceIds must support station coordinates");
    }
  }
  const placeIds = new Set<string>();
  for (const [placeIndex, place] of pack.places.entries()) {
    if (placeIds.has(place.placeId)) {
      issues.push(`/places/${placeIndex}/placeId must be unique`);
    }
    placeIds.add(place.placeId);
    const dates = new Set<string>();
    for (const exception of place.dateExceptions) {
      if (dates.has(exception.date)) {
        issues.push(
          `/places/${placeIndex}/dateExceptions dates must be unique`,
        );
      }
      dates.add(exception.date);
      const instant = Date.parse(`${exception.date}T00:00:00+09:00`);
      if (instant < generated || instant > validThrough) {
        issues.push(
          `/places/${placeIndex}/dateExceptions must fit pack horizon`,
        );
      }
    }
    const claims = [
      ["identity", "IDENTITY"],
      ["address", "ADDRESS"],
      ["coordinates", "COORDINATES"],
      ["hours", "HOURS"],
      ["price", "PRICE"],
      ["publicAccess", "PUBLIC_ACCESS"],
      ["officialLink", "OFFICIAL_LINK"],
      ["menu", "MENU"],
    ] as const;
    for (const [key, claim] of claims) {
      const reference = place.evidence[key];
      if (reference === null) continue;
      const source = sourceById.get(reference.sourceId);
      if (
        !source ||
        source.checkedAt !== reference.checkedAt ||
        !sourceSupports(source, claim)
      ) {
        issues.push(`/places/${placeIndex}/evidence/${key} is unsupported`);
      }
      if (key === "menu" && source && source.sourceKind !== "OFFICIAL_MENU") {
        issues.push(
          `/places/${placeIndex}/evidence/menu must be official menu`,
        );
      }
    }
    const official = sourceById.get(place.evidence.officialLink.sourceId);
    if (official?.url !== place.officialUrl) {
      issues.push(`/places/${placeIndex}/officialUrl must match its source`);
    }
  }
  if (pack.status === "ACTIVE") {
    const activities = pack.places.filter(({ role }) => role === "ACTIVITY");
    const meals = pack.places.filter(({ role }) => role === "MEAL");
    if (activities.length < 4) issues.push("/places requires four activities");
    if (meals.length < 3) issues.push("/places requires three meals");
    if (new Set(activities.map(({ category }) => category)).size < 2) {
      issues.push("/places activities require two categories");
    }
  }
  return issues.length > 0 ? failure(value, issues) : { ok: true, value: pack };
};

export const createReviewedPackClaimsV3 = (
  pack: AreaDataPackV3,
): ReviewedPackClaimsV3 => ({
  schemaVersion: "3",
  packVersion: pack.packVersion,
  area: pack.area,
  pack: structuredClone(pack),
});

export const validateReviewedPackClaimsV3 = (
  pack: AreaDataPackV3,
  ledger: ReviewedPackClaimLedgerV3,
): { ok: true } | { ok: false; issue: string } => {
  const reviewed = ledger[pack.packVersion];
  if (!reviewed) return { ok: false, issue: "missing reviewed pack version" };
  const expected = createReviewedPackClaimsV3(pack);
  return JSON.stringify(reviewed) === JSON.stringify(expected)
    ? { ok: true }
    : { ok: false, issue: "runtime pack differs from reviewed claims" };
};

const validCompactPlace = (value: unknown): value is CompactPlannerPlaceV3 =>
  isRecord(value) &&
  exactKeys(value, [
    "placeId",
    "role",
    "name",
    "summary",
    "category",
    "address",
    "tags",
    "officialUrl",
    "googlePlaceId",
  ]) &&
  isValidPlannerIdV3(value.placeId) &&
  inList(value.role, PLACE_ROLES_V3) &&
  boundedString(value.name, 120) &&
  boundedString(value.summary, 240) &&
  inList(value.category, PLACE_CATEGORIES_V3) &&
  boundedString(value.address, 240) &&
  validTags(value.tags) &&
  isHttpsUrlV3(value.officialUrl) &&
  (value.googlePlaceId === null || boundedString(value.googlePlaceId, 180));

const validStopCost = (value: unknown): value is StopCostV3 =>
  isRecord(value) &&
  exactKeys(value, [
    "perPersonMinYen",
    "perPersonMaxYen",
    "estimatedGroupMinYen",
    "estimatedGroupMaxYen",
  ]) &&
  validInteger(value.perPersonMinYen, 0, 300_000) &&
  validInteger(value.perPersonMaxYen, 0, 300_000) &&
  validInteger(value.estimatedGroupMinYen, 0, 900_000) &&
  validInteger(value.estimatedGroupMaxYen, 0, 900_000) &&
  value.perPersonMinYen <= value.perPersonMaxYen &&
  value.estimatedGroupMinYen <= value.estimatedGroupMaxYen;

const validPlanStop = (value: unknown): value is EveningPlanStopV3 =>
  isRecord(value) &&
  exactKeys(value, [
    "position",
    "place",
    "startsAt",
    "endsAt",
    "price",
    "cost",
    "travelFromPreviousMinutes",
    "travelFromPreviousDistanceMeters",
    "travelOriginLabel",
    "travelMethod",
    "openingFit",
    "whyThisStop",
    "sourcePublisher",
    "sourceCheckedAt",
  ]) &&
  validInteger(value.position, 0, 2) &&
  validCompactPlace(value.place) &&
  isStrictTimestampV3(value.startsAt) &&
  isStrictTimestampV3(value.endsAt) &&
  Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
  validPrice(value.price) &&
  validStopCost(value.cost) &&
  validInteger(value.travelFromPreviousMinutes, 0, 30) &&
  validInteger(value.travelFromPreviousDistanceMeters, 0, 5_000) &&
  boundedString(value.travelOriginLabel, 120) &&
  value.travelMethod === "COORDINATE_ESTIMATE" &&
  boundedString(value.openingFit, 240) &&
  boundedString(value.whyThisStop, 240) &&
  boundedString(value.sourcePublisher, 120) &&
  isStrictTimestampV3(value.sourceCheckedAt);

export const validateEveningPlanV3 = (
  value: unknown,
): PlannerValidationResultV3<EveningPlanV3> => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "planId",
      "candidateSetId",
      "packVersion",
      "intent",
      "stops",
      "totals",
      "score",
      "scoreBreakdown",
      "reasonCodes",
      "travelMethod",
      "disclaimer",
    ]) ||
    value.schemaVersion !== "3" ||
    !isValidPlannerIdV3(value.planId) ||
    !isValidPlannerIdV3(value.candidateSetId) ||
    !boundedString(value.packVersion, 32) ||
    validatePlannerIntentV3(value.intent).ok === false ||
    !Array.isArray(value.stops) ||
    value.stops.length < 2 ||
    value.stops.length > 3 ||
    !value.stops.every(validPlanStop) ||
    !isRecord(value.totals) ||
    !exactKeys(value.totals, [
      "perPersonMinYen",
      "perPersonMaxYen",
      "estimatedGroupMinYen",
      "estimatedGroupMaxYen",
      "totalWalkMinutes",
      "stopCount",
      "startsAt",
      "endsAt",
    ]) ||
    !validInteger(value.totals.perPersonMinYen, 0, 300_000) ||
    !validInteger(value.totals.perPersonMaxYen, 0, 300_000) ||
    !validInteger(value.totals.estimatedGroupMinYen, 0, 900_000) ||
    !validInteger(value.totals.estimatedGroupMaxYen, 0, 900_000) ||
    !validInteger(value.totals.totalWalkMinutes, 0, 90) ||
    !validInteger(value.totals.stopCount, 2, 3) ||
    !isStrictTimestampV3(value.totals.startsAt) ||
    !isStrictTimestampV3(value.totals.endsAt) ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 100 ||
    !isRecord(value.scoreBreakdown) ||
    !exactKeys(value.scoreBreakdown, [
      "preferenceFit",
      "walkingEfficiency",
      "timeUtilization",
      "categoryDiversity",
    ]) ||
    !Object.values(value.scoreBreakdown).every(
      (score) => typeof score === "number" && score >= 0 && score <= 1,
    ) ||
    !Array.isArray(value.reasonCodes) ||
    value.reasonCodes.length < 1 ||
    value.reasonCodes.length > 5 ||
    new Set(value.reasonCodes).size !== value.reasonCodes.length ||
    !value.reasonCodes.every((code) =>
      inList(code, [
        "MATCHES_INTEREST",
        "SHORT_WALKS",
        "USES_TIME_WELL",
        "VARIED_STOPS",
        "WITHIN_BUDGET",
      ] as const),
    ) ||
    value.travelMethod !== "COORDINATE_ESTIMATE" ||
    value.disclaimer !== PLANNER_V3_DISCLAIMER
  ) {
    return failure(value, ["/ must be a valid EveningPlanV3"]);
  }
  const plan = value as unknown as EveningPlanV3;
  const issues: string[] = [];
  const roles = plan.stops.map(({ place }) => place.role).join("-");
  const allowed = plan.intent.includeMeal
    ? new Set(["ACTIVITY-MEAL-ACTIVITY", "ACTIVITY-MEAL"])
    : new Set(["ACTIVITY-ACTIVITY-ACTIVITY", "ACTIVITY-ACTIVITY"]);
  if (!allowed.has(roles))
    issues.push("/stops must follow the intent role grammar");
  if (
    new Set(plan.stops.map(({ place }) => place.placeId)).size !==
    plan.stops.length
  ) {
    issues.push("/stops placeId values must be unique");
  }
  for (const [index, stop] of plan.stops.entries()) {
    if (stop.position !== index)
      issues.push(`/stops/${index}/position is invalid`);
    if (
      index > 0 &&
      Date.parse(stop.startsAt) < Date.parse(plan.stops[index - 1]!.endsAt)
    ) {
      issues.push(`/stops/${index} overlaps the previous stop`);
    }
    const expectedCost = projectPriceCostV3(stop.price, plan.intent.partySize);
    if (JSON.stringify(stop.cost) !== JSON.stringify(expectedCost)) {
      issues.push(`/stops/${index}/cost must match price and party size`);
    }
    if (stop.place.role === "MEAL" && stop.price.kind !== "PER_PERSON") {
      issues.push(`/stops/${index}/price meal stops require PER_PERSON`);
    }
    if (
      stop.travelFromPreviousMinutes > plan.intent.maxWalkMinutesPerLeg ||
      stop.place.tags.some((tag) => plan.intent.excludedTags.includes(tag))
    ) {
      issues.push(`/stops/${index} violates intent constraints`);
    }
  }
  const sum = <K extends keyof StopCostV3>(key: K) =>
    plan.stops.reduce((total, stop) => total + stop.cost[key], 0);
  const totalWalk = plan.stops.reduce(
    (total, stop) => total + stop.travelFromPreviousMinutes,
    0,
  );
  const first = plan.stops[0]!;
  const last = plan.stops[plan.stops.length - 1]!;
  if (
    plan.totals.perPersonMinYen !== sum("perPersonMinYen") ||
    plan.totals.perPersonMaxYen !== sum("perPersonMaxYen") ||
    plan.totals.estimatedGroupMinYen !== sum("estimatedGroupMinYen") ||
    plan.totals.estimatedGroupMaxYen !== sum("estimatedGroupMaxYen") ||
    plan.totals.totalWalkMinutes !== totalWalk ||
    plan.totals.stopCount !== plan.stops.length ||
    plan.totals.startsAt !== first.startsAt ||
    plan.totals.endsAt !== last.endsAt
  ) {
    issues.push("/totals must equal the stop projection");
  }
  if (plan.totals.perPersonMaxYen > plan.intent.budgetPerPersonYen) {
    issues.push("/totals exceeds the per-person budget");
  }
  if (
    Date.parse(first.startsAt) < Date.parse(plan.intent.startAt) ||
    Date.parse(last.endsAt) > Date.parse(plan.intent.endAt)
  ) {
    issues.push("/stops must fit the requested time window");
  }
  const preferenceTags = INTEREST_PRESET_TAGS_V3[plan.intent.interestPreset];
  const preferenceTagSet = new Set<PlannerTagV3>(preferenceTags);
  if (
    plan.intent.interestPreset !== "SURPRISE" &&
    !plan.stops.some(({ place }) =>
      place.tags.some((tag) => preferenceTagSet.has(tag)),
    )
  ) {
    issues.push("/stops must include one interest match");
  }
  return issues.length > 0 ? failure(value, issues) : { ok: true, value: plan };
};

export const validateSwapPlanInputV3 = (
  value: unknown,
): PlannerValidationResultV3<SwapPlanInputV3> => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "candidateSetId",
      "planId",
      "intent",
      "plan",
      "stopIndex",
      "preference",
    ]) ||
    value.schemaVersion !== "3" ||
    !isValidPlannerIdV3(value.candidateSetId) ||
    !isValidPlannerIdV3(value.planId) ||
    validatePlannerIntentV3(value.intent).ok === false ||
    validateEveningPlanV3(value.plan).ok === false ||
    !validInteger(value.stopIndex, 0, 2) ||
    !inList(value.preference, SWAP_PREFERENCES_V3)
  ) {
    return failure(value, ["/ must be a valid SwapPlanInputV3"]);
  }
  const input = value as unknown as SwapPlanInputV3;
  const issues: string[] = [];
  if (
    input.candidateSetId !== input.plan.candidateSetId ||
    input.planId !== input.plan.planId ||
    JSON.stringify(input.intent) !== JSON.stringify(input.plan.intent) ||
    input.stopIndex >= input.plan.stops.length
  ) {
    issues.push("/ must reference the supplied plan and an existing stop");
  }
  return issues.length > 0
    ? failure(value, issues)
    : { ok: true, value: input };
};

export const validateShowPlaceEvidenceInputV3 = (
  value: unknown,
): PlannerValidationResultV3<ShowPlaceEvidenceInputV3> =>
  isRecord(value) &&
  exactKeys(value, ["schemaVersion", "area", "packVersion", "placeId"]) &&
  value.schemaVersion === "3" &&
  inList(value.area, PLANNER_V3_AREAS) &&
  boundedString(value.packVersion, 32) &&
  /^\d+\.\d+\.\d+$/.test(value.packVersion) &&
  isValidPlannerIdV3(value.placeId)
    ? { ok: true, value: value as unknown as ShowPlaceEvidenceInputV3 }
    : failure(value, ["/ must be a valid ShowPlaceEvidenceInputV3"]);

export const validateSavePlanInputV3 = (
  value: unknown,
): PlannerValidationResultV3<SavePlanInputV3> =>
  isRecord(value) &&
  exactKeys(value, ["schemaVersion", "candidateSetId", "planId"]) &&
  value.schemaVersion === "3" &&
  isValidPlannerIdV3(value.candidateSetId) &&
  isValidPlannerIdV3(value.planId)
    ? { ok: true, value: value as unknown as SavePlanInputV3 }
    : failure(value, ["/ must be a valid SavePlanInputV3"]);

export const validateDeleteSavedPlanInputV3 = (
  value: unknown,
): PlannerValidationResultV3<DeleteSavedPlanInputV3> =>
  isRecord(value) &&
  exactKeys(value, ["schemaVersion", "planId"]) &&
  value.schemaVersion === "3" &&
  isValidPlannerIdV3(value.planId)
    ? { ok: true, value: value as unknown as DeleteSavedPlanInputV3 }
    : failure(value, ["/ must be a valid DeleteSavedPlanInputV3"]);

export const plannerV3Validators = {
  intent: validatePlannerIntentV3,
  areaDataPack: validateAreaDataPackV3,
  eveningPlan: validateEveningPlanV3,
  swapInput: validateSwapPlanInputV3,
  evidenceInput: validateShowPlaceEvidenceInputV3,
  saveInput: validateSavePlanInputV3,
  deleteInput: validateDeleteSavedPlanInputV3,
} as const;

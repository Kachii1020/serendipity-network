import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { FromSchema } from "json-schema-to-ts";

import {
  PLACE_CATEGORIES_V2,
  PLANNER_ERROR_CODES,
  PLANNER_SCHEMA_VERSION,
  PLANNER_TAGS,
  SWAP_PREFERENCES,
  isStrictCalendarDateV2,
  isStrictTimestampV2,
} from "./planner-v2-shared";

export {
  PLACE_CATEGORIES_V2,
  PLANNER_AREAS,
  PLANNER_ERROR_CODES,
  PLANNER_SCHEMA_VERSION,
  PLANNER_TAGS,
  SWAP_PREFERENCES,
  isStrictCalendarDateV2,
  isStrictTimestampV2,
} from "./planner-v2-shared";

const timestampV2Schema = {
  type: "string",
  pattern:
    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
} as const;
const dateV2Schema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
} as const;
const localTimeV2Schema = {
  type: "string",
  pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$",
} as const;
const opaqueIdV2Schema = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
} as const;
const httpsUrlV2Schema = {
  type: "string",
  minLength: 9,
  maxLength: 500,
  pattern: "^https://[^\\s]+$",
} as const;
const plannerTagArrayV2Schema = {
  type: "array",
  items: { enum: PLANNER_TAGS },
  maxItems: 5,
  uniqueItems: true,
} as const;

export const plannerIntentV2Schema = {
  $comment: "serendipity.planner-intent.v2",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "area",
    "partySize",
    "startAt",
    "endAt",
    "totalBudgetYen",
    "stopCount",
    "maxWalkMinutesPerLeg",
    "preferredTags",
    "excludedTags",
  ],
  properties: {
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    area: { const: "shibuya" },
    partySize: { const: 1 },
    startAt: timestampV2Schema,
    endAt: timestampV2Schema,
    totalBudgetYen: { type: "integer", minimum: 0, maximum: 30_000 },
    stopCount: { const: "AUTO" },
    maxWalkMinutesPerLeg: { type: "integer", minimum: 5, maximum: 30 },
    preferredTags: plannerTagArrayV2Schema,
    excludedTags: plannerTagArrayV2Schema,
  },
} as const;

export const sourceUsageV2Schema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["mode", "licenseId", "licenseUrl", "attribution"],
      properties: {
        mode: { const: "OPEN_LICENSE" },
        licenseId: { type: "string", minLength: 1, maxLength: 80 },
        licenseUrl: httpsUrlV2Schema,
        attribution: { type: "string", minLength: 1, maxLength: 300 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["mode", "permissionEvidencePath", "attribution"],
      properties: {
        mode: { const: "EXPLICIT_PERMISSION" },
        permissionEvidencePath: {
          type: "string",
          minLength: 1,
          maxLength: 300,
          pattern:
            "^specs/002-source-backed-evening-planner/evidence/permissions/[^/]+$",
        },
        attribution: { type: "string", minLength: 1, maxLength: 300 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["mode", "factScope", "attribution"],
      properties: {
        mode: { const: "OFFICIAL_FACT_REFERENCE" },
        factScope: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          uniqueItems: true,
          items: {
            enum: [
              "IDENTITY",
              "ADDRESS",
              "COORDINATES",
              "HOURS",
              "PRICE",
              "PUBLIC_ACCESS",
            ],
          },
        },
        attribution: { type: "string", minLength: 1, maxLength: 300 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["mode"],
      properties: { mode: { const: "OFFICIAL_LINK_ONLY" } },
    },
  ],
} as const;

export const sourceRecordV2Schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "sourceId",
    "title",
    "publisher",
    "sourceKind",
    "url",
    "checkedAt",
    "usage",
  ],
  properties: {
    sourceId: opaqueIdV2Schema,
    title: { type: "string", minLength: 1, maxLength: 160 },
    publisher: { type: "string", minLength: 1, maxLength: 120 },
    sourceKind: {
      enum: ["OPEN_DATASET", "OFFICIAL_SITE", "LICENSE_TERMS"],
    },
    url: httpsUrlV2Schema,
    checkedAt: timestampV2Schema,
    publishedAt: timestampV2Schema,
    usage: sourceUsageV2Schema,
    notes: { type: "string", minLength: 1, maxLength: 500 },
  },
} as const;

export const priceEvidenceV2Schema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "minYen", "maxYen", "label"],
      properties: {
        kind: { const: "FREE" },
        minYen: { const: 0 },
        maxYen: { const: 0 },
        label: { type: "string", minLength: 1, maxLength: 160 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "minYen", "maxYen", "label"],
      properties: {
        kind: { const: "EXACT" },
        minYen: { type: "integer", minimum: 0, maximum: 100_000 },
        maxYen: { type: "integer", minimum: 0, maximum: 100_000 },
        label: { type: "string", minLength: 1, maxLength: 160 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "minYen", "maxYen", "label"],
      properties: {
        kind: { const: "RANGE" },
        minYen: { type: "integer", minimum: 0, maximum: 100_000 },
        maxYen: { type: "integer", minimum: 0, maximum: 100_000 },
        label: { type: "string", minLength: 1, maxLength: 160 },
      },
    },
  ],
} as const;

export const hoursProvenanceV2Schema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sourceSummary", "publishedAllDay"],
      properties: {
        kind: { const: "PUBLISHED_WINDOWS" },
        sourceSummary: { type: "string", minLength: 1, maxLength: 240 },
        publishedAllDay: { type: "boolean" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sourceSummary"],
      properties: {
        kind: { const: "PUBLISHED_INCOMPLETE" },
        sourceSummary: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sourceSummary"],
      properties: {
        kind: { const: "NO_SET_HOURS" },
        sourceSummary: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
  ],
} as const;

export const priceProvenanceV2Schema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sourceSummary"],
      properties: {
        kind: { const: "PUBLISHED_AMOUNT" },
        sourceSummary: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sourceSummary"],
      properties: {
        kind: { const: "PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED" },
        sourceSummary: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
  ],
} as const;

export const routeEligibilityV2Schema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: { kind: { const: "ROUTABLE" } },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "reasons", "note"],
      properties: {
        kind: { const: "REFERENCE_ONLY" },
        reasons: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          uniqueItems: true,
          items: {
            enum: [
              "RESTRICTED_ACCESS",
              "UNSUPPORTED_COORDINATES",
              "INCOMPLETE_HOURS",
              "NO_SET_HOURS",
              "UNSOURCED_PRICE",
            ],
          },
        },
        note: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
  ],
} as const;

export const evidenceReferenceV2Schema = {
  type: "object",
  additionalProperties: false,
  required: ["sourceId", "checkedAt"],
  properties: {
    sourceId: opaqueIdV2Schema,
    checkedAt: timestampV2Schema,
  },
} as const;

const evidenceReferencesV2Schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "identity",
    "address",
    "coordinates",
    "hours",
    "price",
    "publicAccess",
    "officialLink",
  ],
  properties: {
    identity: evidenceReferenceV2Schema,
    address: evidenceReferenceV2Schema,
    coordinates: {
      oneOf: [evidenceReferenceV2Schema, { type: "null" }],
    },
    hours: evidenceReferenceV2Schema,
    price: evidenceReferenceV2Schema,
    publicAccess: evidenceReferenceV2Schema,
    officialLink: evidenceReferenceV2Schema,
  },
} as const;

export const plannerPlaceV2Schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "placeId",
    "name",
    "summary",
    "category",
    "address",
    "coordinates",
    "tags",
    "officialUrl",
    "recommendedVisitMinutes",
    "routeEligibility",
    "calendarSourceIds",
    "hoursProvenance",
    "weeklyHours",
    "dateExceptions",
    "price",
    "priceProvenance",
    "evidence",
  ],
  properties: {
    placeId: opaqueIdV2Schema,
    name: { type: "string", minLength: 1, maxLength: 120 },
    summary: { type: "string", minLength: 1, maxLength: 320 },
    category: { enum: PLACE_CATEGORIES_V2 },
    address: { type: "string", minLength: 1, maxLength: 240 },
    coordinates: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["latitude", "longitude"],
          properties: {
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
          },
        },
        { type: "null" },
      ],
    },
    tags: plannerTagArrayV2Schema,
    officialUrl: httpsUrlV2Schema,
    recommendedVisitMinutes: {
      type: "integer",
      minimum: 20,
      maximum: 180,
    },
    routeEligibility: routeEligibilityV2Schema,
    calendarSourceIds: {
      type: "array",
      maxItems: 4,
      uniqueItems: true,
      items: opaqueIdV2Schema,
    },
    hoursProvenance: hoursProvenanceV2Schema,
    weeklyHours: {
      type: "array",
      maxItems: 14,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["days", "opens", "closes"],
        properties: {
          days: {
            type: "array",
            minItems: 1,
            maxItems: 7,
            uniqueItems: true,
            items: { type: "integer", minimum: 0, maximum: 6 },
          },
          opens: localTimeV2Schema,
          closes: localTimeV2Schema,
        },
      },
    },
    dateExceptions: {
      type: "array",
      maxItems: 40,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["date", "closed", "note"],
            properties: {
              date: dateV2Schema,
              closed: { const: true },
              note: { type: "string", minLength: 1, maxLength: 160 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["date", "closed", "opens", "closes", "note"],
            properties: {
              date: dateV2Schema,
              closed: { const: false },
              opens: localTimeV2Schema,
              closes: localTimeV2Schema,
              note: { type: "string", minLength: 1, maxLength: 160 },
            },
          },
        ],
      },
    },
    price: priceEvidenceV2Schema,
    priceProvenance: priceProvenanceV2Schema,
    evidence: evidenceReferencesV2Schema,
  },
} as const;

export const placeDataPackV2Schema = {
  $comment: "serendipity.place-data-pack.v2",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "packVersion",
    "status",
    "area",
    "generatedAt",
    "validThrough",
    "dataLicense",
    "station",
    "calendarSourceIds",
    "sources",
    "places",
  ],
  properties: {
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    packVersion: {
      type: "string",
      pattern: "^[1-9]\\d*\\.\\d+\\.\\d+$",
      maxLength: 32,
    },
    status: { enum: ["CANDIDATE", "ACTIVE"] },
    area: { const: "shibuya" },
    generatedAt: timestampV2Schema,
    validThrough: timestampV2Schema,
    dataLicense: {
      type: "object",
      additionalProperties: false,
      required: ["licenseId", "licenseUrl", "attribution"],
      properties: {
        licenseId: { type: "string", minLength: 1, maxLength: 80 },
        licenseUrl: httpsUrlV2Schema,
        attribution: { type: "string", minLength: 1, maxLength: 300 },
      },
    },
    station: {
      type: "object",
      additionalProperties: false,
      required: ["name", "coordinates", "sourceIds"],
      properties: {
        name: { const: "Shibuya Station" },
        coordinates: {
          type: "object",
          additionalProperties: false,
          required: ["latitude", "longitude"],
          properties: {
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
          },
        },
        sourceIds: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          uniqueItems: true,
          items: opaqueIdV2Schema,
        },
      },
    },
    calendarSourceIds: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
      items: opaqueIdV2Schema,
    },
    sources: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: sourceRecordV2Schema,
    },
    places: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: plannerPlaceV2Schema,
    },
  },
} as const;

const compactPlaceV2Schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "placeId",
    "name",
    "summary",
    "category",
    "address",
    "tags",
    "officialUrl",
  ],
  properties: {
    placeId: opaqueIdV2Schema,
    name: { type: "string", minLength: 1, maxLength: 120 },
    summary: { type: "string", minLength: 1, maxLength: 320 },
    category: { enum: PLACE_CATEGORIES_V2 },
    address: { type: "string", minLength: 1, maxLength: 240 },
    tags: plannerTagArrayV2Schema,
    officialUrl: httpsUrlV2Schema,
  },
} as const;

export const eveningPlanStopV2Schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "position",
    "place",
    "startsAt",
    "endsAt",
    "price",
    "priceProvenance",
    "travelFromPreviousMinutes",
    "travelFromPreviousDistanceMeters",
    "travelOriginLabel",
    "travelMethod",
    "travelLabel",
    "openingFit",
    "whyThisStop",
    "sourcePublisher",
    "sourceCheckedAt",
  ],
  properties: {
    position: { type: "integer", minimum: 0, maximum: 2 },
    place: compactPlaceV2Schema,
    startsAt: timestampV2Schema,
    endsAt: timestampV2Schema,
    price: priceEvidenceV2Schema,
    priceProvenance: priceProvenanceV2Schema,
    travelFromPreviousMinutes: {
      type: "integer",
      minimum: 0,
      maximum: 30,
    },
    travelFromPreviousDistanceMeters: {
      type: "integer",
      minimum: 0,
      maximum: 5000,
    },
    travelOriginLabel: { type: "string", minLength: 1, maxLength: 120 },
    travelMethod: { const: "COORDINATE_ESTIMATE" },
    travelLabel: { type: "string", minLength: 1, maxLength: 200 },
    openingFit: { type: "string", minLength: 1, maxLength: 240 },
    whyThisStop: { type: "string", minLength: 1, maxLength: 240 },
    sourcePublisher: { type: "string", minLength: 1, maxLength: 120 },
    sourceCheckedAt: timestampV2Schema,
  },
} as const;

export const eveningPlanV2Schema = {
  $comment: "serendipity.evening-plan.v2",
  type: "object",
  additionalProperties: false,
  required: [
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
  ],
  properties: {
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    planId: opaqueIdV2Schema,
    candidateSetId: opaqueIdV2Schema,
    packVersion: {
      type: "string",
      pattern: "^[1-9]\\d*\\.\\d+\\.\\d+$",
      maxLength: 32,
    },
    intent: plannerIntentV2Schema,
    stops: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: eveningPlanStopV2Schema,
    },
    totals: {
      type: "object",
      additionalProperties: false,
      required: [
        "minPriceYen",
        "maxPriceYen",
        "totalWalkMinutes",
        "stopCount",
        "startsAt",
        "endsAt",
      ],
      properties: {
        minPriceYen: { type: "integer", minimum: 0, maximum: 300_000 },
        maxPriceYen: { type: "integer", minimum: 0, maximum: 300_000 },
        totalWalkMinutes: { type: "integer", minimum: 0, maximum: 90 },
        stopCount: { type: "integer", minimum: 2, maximum: 3 },
        startsAt: timestampV2Schema,
        endsAt: timestampV2Schema,
      },
    },
    score: { type: "number", minimum: 0, maximum: 100 },
    scoreBreakdown: {
      type: "object",
      additionalProperties: false,
      required: [
        "preferenceFit",
        "walkingEfficiency",
        "timeUtilization",
        "categoryDiversity",
      ],
      properties: {
        preferenceFit: { type: "number", minimum: 0, maximum: 1 },
        walkingEfficiency: { type: "number", minimum: 0, maximum: 1 },
        timeUtilization: { type: "number", minimum: 0, maximum: 1 },
        categoryDiversity: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    reasonCodes: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      uniqueItems: true,
      items: {
        enum: [
          "MATCHES_INTERESTS",
          "SHORT_WALKS",
          "USES_TIME_WELL",
          "VARIED_STOPS",
          "WITHIN_BUDGET",
        ],
      },
    },
    travelMethod: { const: "COORDINATE_ESTIMATE" },
    disclaimer: {
      const:
        "Built from published information, not live availability. Check each official site before you go.",
    },
  },
} as const;

export const showPlaceEvidenceInputV2Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "packVersion", "placeId"],
  properties: {
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    packVersion: {
      type: "string",
      pattern: "^[1-9]\\d*\\.\\d+\\.\\d+$",
      maxLength: 32,
    },
    placeId: opaqueIdV2Schema,
  },
} as const;

export const swapPlanInputV2Schema = {
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
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    candidateSetId: opaqueIdV2Schema,
    planId: opaqueIdV2Schema,
    intent: plannerIntentV2Schema,
    plan: eveningPlanV2Schema,
    stopIndex: { type: "integer", minimum: 0, maximum: 2 },
    preference: { enum: SWAP_PREFERENCES },
  },
} as const;

export const savePlanInputV2Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "candidateSetId", "planId"],
  properties: {
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    candidateSetId: opaqueIdV2Schema,
    planId: opaqueIdV2Schema,
  },
} as const;

export const deleteSavedPlanInputV2Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "planId"],
  properties: {
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    planId: opaqueIdV2Schema,
  },
} as const;

export const plannerErrorV2Schema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message", "retryable"],
  properties: {
    code: { enum: PLANNER_ERROR_CODES },
    message: { type: "string", minLength: 1, maxLength: 240 },
    retryable: { type: "boolean" },
    safeReference: opaqueIdV2Schema,
  },
} as const;

export const plannerMetaV2Schema = {
  type: "object",
  additionalProperties: false,
  required: ["correlationId", "origin", "completedAt", "packVersion"],
  properties: {
    correlationId: opaqueIdV2Schema,
    origin: {
      type: "string",
      pattern:
        "^(?:https://[^/]+(?::\\d+)?|http://(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?)$",
    },
    completedAt: timestampV2Schema,
    packVersion: {
      type: "string",
      pattern: "^[1-9]\\d*\\.\\d+\\.\\d+$",
      maxLength: 32,
    },
  },
} as const;

export const plannerEnvelopeV2Schema = <const TData extends object>(
  dataSchema: TData,
) =>
  ({
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "ok", "data", "meta"],
        properties: {
          schemaVersion: { const: PLANNER_SCHEMA_VERSION },
          ok: { const: true },
          data: dataSchema,
          meta: plannerMetaV2Schema,
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "ok", "error", "meta"],
        properties: {
          schemaVersion: { const: PLANNER_SCHEMA_VERSION },
          ok: { const: false },
          error: plannerErrorV2Schema,
          meta: plannerMetaV2Schema,
        },
      },
    ],
  }) as const;

export type PlannerTag = (typeof PLANNER_TAGS)[number];
export type PlaceCategoryV2 = (typeof PLACE_CATEGORIES_V2)[number];
export type SwapPreferenceV2 = (typeof SWAP_PREFERENCES)[number];
export type PlannerErrorCodeV2 = (typeof PLANNER_ERROR_CODES)[number];
export type PlannerIntentV2 = FromSchema<typeof plannerIntentV2Schema>;
export type SourceUsageV2 = FromSchema<typeof sourceUsageV2Schema>;
export type SourceRecordV2 = FromSchema<typeof sourceRecordV2Schema>;
export type EvidenceReferenceV2 = FromSchema<typeof evidenceReferenceV2Schema>;
export type HoursProvenanceV2 = FromSchema<typeof hoursProvenanceV2Schema>;
export type PriceEvidenceV2 = FromSchema<typeof priceEvidenceV2Schema>;
export type PriceProvenanceV2 = FromSchema<typeof priceProvenanceV2Schema>;
export type RouteEligibilityV2 = FromSchema<typeof routeEligibilityV2Schema>;
export type PlannerPlaceV2 = FromSchema<typeof plannerPlaceV2Schema>;
export type PlaceDataPackV2 = FromSchema<typeof placeDataPackV2Schema>;
export type ReviewedClaimSourceV2 = Readonly<{
  sourceId: string;
  sourceUrl: string;
  checkedAt: string;
  title: string;
  publisher: string;
  sourceKind: SourceRecordV2["sourceKind"];
  usage: SourceUsageV2;
  publishedAt?: string;
  notes?: string;
}>;
export type ReviewedClaimV2<T> = Readonly<{
  value: T;
  source: ReviewedClaimSourceV2;
}>;
export type ReviewedPlaceClaimsV2 = Readonly<{
  placeId: string;
  calendarSources: readonly ReviewedClaimSourceV2[];
  identity: ReviewedClaimV2<string>;
  address: ReviewedClaimV2<string>;
  coordinates: ReviewedClaimV2<PlannerPlaceV2["coordinates"]>;
  hours: ReviewedClaimV2<
    Readonly<{
      hoursProvenance: PlannerPlaceV2["hoursProvenance"];
      weeklyHours: PlannerPlaceV2["weeklyHours"];
      dateExceptions: PlannerPlaceV2["dateExceptions"];
    }>
  >;
  price: ReviewedClaimV2<
    Readonly<{
      price: PlannerPlaceV2["price"];
      priceProvenance: PlannerPlaceV2["priceProvenance"];
    }>
  >;
  publicAccess: ReviewedClaimV2<PlannerPlaceV2["routeEligibility"]>;
  officialLink: ReviewedClaimV2<string>;
}>;
export type ReviewedPackClaimsV2 = Readonly<{
  schemaVersion: "2";
  packVersion: string;
  status: PlaceDataPackV2["status"];
  generatedAt: string;
  validThrough: string;
  dataLicense: PlaceDataPackV2["dataLicense"];
  station: Readonly<{
    name: string;
    coordinates: PlaceDataPackV2["station"]["coordinates"];
    sources: readonly ReviewedClaimSourceV2[];
  }>;
  calendarSources: readonly ReviewedClaimSourceV2[];
  places: readonly ReviewedPlaceClaimsV2[];
}>;
export type ReviewedPackClaimLedgerV2 = Readonly<
  Record<string, ReviewedPackClaimsV2>
>;
export type EveningPlanStopV2 = FromSchema<typeof eveningPlanStopV2Schema>;
export type EveningPlanV2 = FromSchema<typeof eveningPlanV2Schema>;
export type SearchPlanInputV2 = PlannerIntentV2;
export type SearchPlansDataV2 = Readonly<{
  candidateSetId: string;
  plan: EveningPlanV2;
  warnings: readonly string[];
}>;
export type SwapPlanInputV2 = FromSchema<typeof swapPlanInputV2Schema>;
export type SwapPlanDataV2 = Readonly<{
  candidateSetId: string;
  plan: EveningPlanV2;
  replacedStopIndex: number;
  preference: SwapPreferenceV2;
  warnings: readonly string[];
}>;
export type ShowPlaceEvidenceInputV2 = FromSchema<
  typeof showPlaceEvidenceInputV2Schema
>;
export type SavePlanInputV2 = FromSchema<typeof savePlanInputV2Schema>;
export type DeleteSavedPlanInputV2 = FromSchema<
  typeof deleteSavedPlanInputV2Schema
>;
export type PlaceEvidenceV2 = Readonly<{
  schemaVersion: "2";
  packVersion: string;
  placeId: string;
  placeName: string;
  officialUrl: string;
  evidenceAsOf: string;
  claims: Readonly<{
    identity: EvidenceClaimV2;
    address: EvidenceClaimV2;
    coordinates: EvidenceClaimV2 | null;
    hours: EvidenceClaimV2;
    price: EvidenceClaimV2;
    publicAccess: EvidenceClaimV2;
    officialLink: EvidenceClaimV2;
  }>;
  sources: readonly SourceRecordV2[];
}>;
export type EvidenceClaimV2 = Readonly<{
  kind:
    | "IDENTITY"
    | "ADDRESS"
    | "COORDINATES"
    | "HOURS"
    | "PRICE"
    | "PUBLIC_ACCESS"
    | "OFFICIAL_LINK";
  value: string;
  publisher: string;
  sourceTitle: string;
  sourceUrl: string;
  checkedAt: string;
}>;
export type PlaceEvidenceDataV2 = Readonly<{ evidence: PlaceEvidenceV2 }>;
export type PlannerMetaV2 = FromSchema<typeof plannerMetaV2Schema>;
export type PlannerPublicErrorV2 = FromSchema<typeof plannerErrorV2Schema>;
export type PlannerEnvelopeV2<T> =
  | Readonly<{
      schemaVersion: "2";
      ok: true;
      data: T;
      meta: PlannerMetaV2;
    }>
  | Readonly<{
      schemaVersion: "2";
      ok: false;
      error: PlannerPublicErrorV2;
      meta: PlannerMetaV2;
    }>;

export type PlannerValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "VALIDATION_ERROR" | "UNSUPPORTED_SCHEMA_VERSION";
      issues: string[];
    };

const ajv = new Ajv({ allErrors: true, strict: true });
const formatIssues = (errors: ErrorObject[] | null | undefined): string[] =>
  errors?.map(
    (error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
  ) ?? ["/ is invalid"];
const hasUnsupportedVersion = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "schemaVersion" in value &&
  (value as { schemaVersion?: unknown }).schemaVersion !==
    PLANNER_SCHEMA_VERSION;
const validateWith = <T>(
  validator: ValidateFunction,
  value: unknown,
  semanticIssues: (candidate: T) => string[] = () => [],
): PlannerValidationResult<T> => {
  if (hasUnsupportedVersion(value)) {
    return {
      ok: false,
      code: "UNSUPPORTED_SCHEMA_VERSION",
      issues: [`/schemaVersion must equal ${PLANNER_SCHEMA_VERSION}`],
    };
  }
  if (!validator(value)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      issues: formatIssues(validator.errors),
    };
  }
  const candidate = value as T;
  const issues = semanticIssues(candidate);
  return issues.length > 0
    ? { ok: false, code: "VALIDATION_ERROR", issues }
    : { ok: true, value: candidate };
};

const plannerIntentValidator = ajv.compile(plannerIntentV2Schema);
const placeDataPackValidator = ajv.compile(placeDataPackV2Schema);
const eveningPlanValidator = ajv.compile(eveningPlanV2Schema);
const evidenceInputValidator = ajv.compile(showPlaceEvidenceInputV2Schema);
const swapInputValidator = ajv.compile(swapPlanInputV2Schema);
const saveInputValidator = ajv.compile(savePlanInputV2Schema);
const deleteInputValidator = ajv.compile(deleteSavedPlanInputV2Schema);
const unknownEnvelopeValidator = ajv.compile(
  plannerEnvelopeV2Schema({} as const),
);

const offsetMinutes = (value: string): number | null => {
  const match = /([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value.endsWith("Z") ? 0 : null;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

const dateInJst = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);

const plannerIntentIssues = (intent: PlannerIntentV2, now?: Date): string[] => {
  const issues: string[] = [];
  const start = Date.parse(intent.startAt);
  const end = Date.parse(intent.endAt);
  const durationMinutes = (end - start) / 60_000;
  if (
    !isStrictTimestampV2(intent.startAt) ||
    !isStrictTimestampV2(intent.endAt)
  ) {
    issues.push("/startAt and /endAt must contain real calendar dates");
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    issues.push("/endAt must be later than /startAt");
  }
  if (
    offsetMinutes(intent.startAt) !== 540 ||
    offsetMinutes(intent.endAt) !== 540
  ) {
    issues.push("/startAt and /endAt must use the Asia/Tokyo +09:00 offset");
  }
  if (intent.startAt.slice(0, 10) !== intent.endAt.slice(0, 10)) {
    issues.push("/startAt and /endAt must share one local date");
  }
  if (durationMinutes < 120 || durationMinutes > 600) {
    issues.push("/startAt to /endAt must span 2 to 10 hours");
  }
  const startLocalMinutes = timeToMinutes(intent.startAt.slice(11, 16));
  const endLocalMinutes = timeToMinutes(intent.endAt.slice(11, 16));
  if (startLocalMinutes < 12 * 60) {
    issues.push("/startAt local time must be 12:00 or later");
  }
  if (endLocalMinutes > 23 * 60 + 30) {
    issues.push("/endAt local time must be 23:30 or earlier");
  }
  const overlap = intent.preferredTags.filter((tag) =>
    intent.excludedTags.includes(tag),
  );
  if (overlap.length > 0) {
    issues.push("/preferredTags and /excludedTags must not overlap");
  }
  if (now) {
    const today = dateInJst(now);
    const requested = intent.startAt.slice(0, 10);
    const days =
      (Date.parse(`${requested}T00:00:00+09:00`) -
        Date.parse(`${today}T00:00:00+09:00`)) /
      86_400_000;
    if (days < 0 || days > 7) {
      issues.push("/startAt date must be today through seven days from now");
    }
    const fiveMinuteGrace = 5 * 60_000;
    if (start < now.getTime() - fiveMinuteGrace) {
      issues.push("/startAt must not be more than five minutes in the past");
    }
  }
  return issues;
};

const timeToMinutes = (value: string): number => {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const placeDataPackIssues = (pack: PlaceDataPackV2): string[] => {
  const issues: string[] = [];
  if (!isStrictTimestampV2(pack.generatedAt)) {
    issues.push("/generatedAt must contain a real calendar timestamp");
  }
  if (!isStrictTimestampV2(pack.validThrough)) {
    issues.push("/validThrough must contain a real calendar timestamp");
  }
  if (
    offsetMinutes(pack.generatedAt) !== 540 ||
    offsetMinutes(pack.validThrough) !== 540
  ) {
    issues.push("/generatedAt and /validThrough must use +09:00");
  }
  if (Date.parse(pack.validThrough) <= Date.parse(pack.generatedAt)) {
    issues.push("/validThrough must follow /generatedAt");
  }
  const validityDays =
    (Date.parse(`${pack.validThrough.slice(0, 10)}T00:00:00+09:00`) -
      Date.parse(`${pack.generatedAt.slice(0, 10)}T00:00:00+09:00`)) /
    86_400_000;
  if (validityDays < 0 || validityDays > 60) {
    issues.push("/validThrough local date must be within sixty days");
  }
  const sourceById = new Map<string, SourceRecordV2>();
  for (const [index, source] of pack.sources.entries()) {
    if (sourceById.has(source.sourceId)) {
      issues.push(`/sources/${index}/sourceId must be unique`);
    }
    sourceById.set(source.sourceId, source);
    if (!isStrictTimestampV2(source.checkedAt)) {
      issues.push(
        `/sources/${index}/checkedAt must contain a real calendar timestamp`,
      );
    }
    if (
      source.publishedAt !== undefined &&
      !isStrictTimestampV2(source.publishedAt)
    ) {
      issues.push(
        `/sources/${index}/publishedAt must contain a real calendar timestamp`,
      );
    }
    if (Date.parse(source.checkedAt) > Date.parse(pack.generatedAt)) {
      issues.push(`/sources/${index}/checkedAt must not follow /generatedAt`);
    }
    const age =
      (Date.parse(pack.generatedAt) - Date.parse(source.checkedAt)) /
      86_400_000;
    if (pack.status === "ACTIVE" && age > 7) {
      issues.push(`/sources/${index}/checkedAt must be within seven days`);
    }
    if (
      source.usage.mode === "OFFICIAL_FACT_REFERENCE" &&
      source.sourceKind !== "OFFICIAL_SITE"
    ) {
      issues.push(
        `/sources/${index} OFFICIAL_FACT_REFERENCE requires OFFICIAL_SITE`,
      );
    }
  }
  const openLicenseIds = new Set(
    pack.sources.flatMap(({ usage }) =>
      usage.mode === "OPEN_LICENSE" ? [usage.licenseId] : [],
    ),
  );
  const requiresMixedLicense =
    openLicenseIds.size > 1 ||
    pack.sources.some(({ usage }) =>
      ["EXPLICIT_PERMISSION", "OFFICIAL_FACT_REFERENCE"].includes(usage.mode),
    );
  if (
    requiresMixedLicense &&
    pack.dataLicense.licenseId !== "MIXED-SEE-SOURCES"
  ) {
    issues.push(
      "/dataLicense/licenseId must be MIXED-SEE-SOURCES for mixed rights bases",
    );
  }
  const sourceSupportsClaim = (
    source: SourceRecordV2,
    claim:
      | "IDENTITY"
      | "ADDRESS"
      | "COORDINATES"
      | "HOURS"
      | "PRICE"
      | "PUBLIC_ACCESS",
  ): boolean => {
    if (claim === "PUBLIC_ACCESS") {
      return (
        source.sourceKind === "OFFICIAL_SITE" &&
        source.usage.mode === "OFFICIAL_FACT_REFERENCE" &&
        source.usage.factScope.includes("PUBLIC_ACCESS")
      );
    }
    return source.usage.mode === "OFFICIAL_LINK_ONLY"
      ? false
      : source.usage.mode !== "OFFICIAL_FACT_REFERENCE" ||
          source.usage.factScope.includes(claim);
  };
  for (const [calendarIndex, sourceId] of pack.calendarSourceIds.entries()) {
    const source = sourceById.get(sourceId);
    if (!source) {
      issues.push(
        `/calendarSourceIds/${calendarIndex} references an unknown source`,
      );
    } else if (
      source.sourceKind !== "OFFICIAL_SITE" ||
      !sourceSupportsClaim(source, "HOURS")
    ) {
      issues.push(
        `/calendarSourceIds/${calendarIndex} must reference an official HOURS source`,
      );
    }
    if (
      source &&
      Date.parse(pack.validThrough) - Date.parse(source.checkedAt) >
        60 * 86_400_000
    ) {
      issues.push(
        `/calendarSourceIds/${calendarIndex} becomes hard-stale before validThrough`,
      );
    }
  }
  if (pack.status === "ACTIVE") {
    if (pack.places.length < 9) issues.push("/places must contain at least 9");
    if (
      pack.places.filter(
        ({ routeEligibility }) => routeEligibility.kind === "ROUTABLE",
      ).length < 9
    ) {
      issues.push("/places must contain at least 9 routable places");
    }
    if (new Set(pack.places.map(({ category }) => category)).size < 3) {
      issues.push("/places must contain at least three categories");
    }
  }
  const placeIds = new Set<string>();
  const usedCalendarSourceIds = new Set<string>();
  for (const [placeIndex, place] of pack.places.entries()) {
    if (placeIds.has(place.placeId)) {
      issues.push(`/places/${placeIndex}/placeId must be unique`);
    }
    placeIds.add(place.placeId);
    for (const [calendarIndex, sourceId] of place.calendarSourceIds.entries()) {
      const source = sourceById.get(sourceId);
      usedCalendarSourceIds.add(sourceId);
      if (!source) {
        issues.push(
          `/places/${placeIndex}/calendarSourceIds/${calendarIndex} references an unknown source`,
        );
      } else if (
        source.sourceKind !== "OFFICIAL_SITE" ||
        !sourceSupportsClaim(source, "HOURS")
      ) {
        issues.push(
          `/places/${placeIndex}/calendarSourceIds/${calendarIndex} must reference an official HOURS source`,
        );
      } else if (
        Date.parse(pack.validThrough) - Date.parse(source.checkedAt) >
        60 * 86_400_000
      ) {
        issues.push(
          `/places/${placeIndex}/calendarSourceIds/${calendarIndex} becomes hard-stale before validThrough`,
        );
      }
    }
    if (place.price.minYen > place.price.maxYen) {
      issues.push(`/places/${placeIndex}/price minYen must not exceed maxYen`);
    }
    if (
      place.price.kind === "EXACT" &&
      place.price.minYen !== place.price.maxYen
    ) {
      issues.push(`/places/${placeIndex}/price EXACT values must be equal`);
    }
    if (
      place.price.kind === "RANGE" &&
      place.price.minYen === place.price.maxYen
    ) {
      issues.push(`/places/${placeIndex}/price RANGE values must differ`);
    }
    if (
      (place.price.kind === "EXACT" || place.price.kind === "RANGE") &&
      place.priceProvenance.kind !== "PUBLISHED_AMOUNT"
    ) {
      issues.push(
        `/places/${placeIndex}/priceProvenance EXACT and RANGE require PUBLISHED_AMOUNT`,
      );
    }
    if (
      place.priceProvenance.kind === "PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED"
    ) {
      if (
        place.price.kind !== "FREE" ||
        place.price.minYen !== 0 ||
        place.price.maxYen !== 0
      ) {
        issues.push(
          `/places/${placeIndex}/price planner-zero provenance requires a zero reference`,
        );
      }
      if (
        !/\b(?:no mandatory|does not publish a mandatory|no published admission)\b/i.test(
          place.priceProvenance.sourceSummary,
        )
      ) {
        issues.push(
          `/places/${placeIndex}/priceProvenance must state that no mandatory amount is published`,
        );
      }
      if (
        place.routeEligibility.kind !== "REFERENCE_ONLY" ||
        !place.routeEligibility.reasons.includes("UNSOURCED_PRICE")
      ) {
        issues.push(
          `/places/${placeIndex} planner-zero price provenance must be REFERENCE_ONLY`,
        );
      }
    }
    const allDayWindows = place.weeklyHours.filter(
      ({ opens, closes }) => opens === "00:00" && closes === "23:59",
    );
    if (place.hoursProvenance.kind === "NO_SET_HOURS") {
      if (place.weeklyHours.length > 0 || place.dateExceptions.length > 0) {
        issues.push(
          `/places/${placeIndex} NO_SET_HOURS must not contain schedulable windows`,
        );
      }
      if (
        place.routeEligibility.kind !== "REFERENCE_ONLY" ||
        !place.routeEligibility.reasons.includes("NO_SET_HOURS")
      ) {
        issues.push(
          `/places/${placeIndex} NO_SET_HOURS must be REFERENCE_ONLY`,
        );
      }
    } else if (place.hoursProvenance.kind === "PUBLISHED_INCOMPLETE") {
      if (place.weeklyHours.length === 0) {
        issues.push(
          `/places/${placeIndex} PUBLISHED_INCOMPLETE must preserve its published windows`,
        );
      }
      if (
        !/\b(?:incomplete|not fully modeled|recurring closure|holiday)\b/i.test(
          place.hoursProvenance.sourceSummary,
        )
      ) {
        issues.push(
          `/places/${placeIndex}/hoursProvenance must identify the incomplete schedule`,
        );
      }
      if (
        place.routeEligibility.kind !== "REFERENCE_ONLY" ||
        !place.routeEligibility.reasons.includes("INCOMPLETE_HOURS")
      ) {
        issues.push(
          `/places/${placeIndex} PUBLISHED_INCOMPLETE must be REFERENCE_ONLY`,
        );
      }
    } else {
      if (place.weeklyHours.length === 0) {
        issues.push(
          `/places/${placeIndex} PUBLISHED_WINDOWS must contain weeklyHours`,
        );
      }
      if (
        /\b(?:blank|inferred|assumed|editorial|no set|no published)\b/i.test(
          place.hoursProvenance.sourceSummary,
        )
      ) {
        issues.push(
          `/places/${placeIndex}/hoursProvenance cannot label inferred hours as published`,
        );
      }
      if (allDayWindows.length > 0 && !place.hoursProvenance.publishedAllDay) {
        issues.push(
          `/places/${placeIndex} 00:00-23:59 requires publishedAllDay evidence`,
        );
      }
      if (allDayWindows.length === 0 && place.hoursProvenance.publishedAllDay) {
        issues.push(
          `/places/${placeIndex}/hoursProvenance publishedAllDay must describe an all-day window`,
        );
      }
    }
    if (
      place.routeEligibility.kind === "ROUTABLE" &&
      place.hoursProvenance.kind !== "PUBLISHED_WINDOWS"
    ) {
      issues.push(
        `/places/${placeIndex} ROUTABLE requires complete PUBLISHED_WINDOWS`,
      );
    }
    for (const [hoursIndex, hours] of place.weeklyHours.entries()) {
      if (timeToMinutes(hours.closes) <= timeToMinutes(hours.opens)) {
        issues.push(
          `/places/${placeIndex}/weeklyHours/${hoursIndex}/closes must follow opens`,
        );
      }
    }
    const exceptionDates = new Set<string>();
    const generatedDate = pack.generatedAt.slice(0, 10);
    const validThroughDate = pack.validThrough.slice(0, 10);
    for (const [exceptionIndex, exception] of place.dateExceptions.entries()) {
      if (!isStrictCalendarDateV2(exception.date)) {
        issues.push(
          `/places/${placeIndex}/dateExceptions/${exceptionIndex}/date must be a real calendar date`,
        );
      }
      if (exceptionDates.has(exception.date)) {
        issues.push(
          `/places/${placeIndex}/dateExceptions/${exceptionIndex}/date must be unique`,
        );
      }
      exceptionDates.add(exception.date);
      if (exception.date < generatedDate || exception.date > validThroughDate) {
        issues.push(
          `/places/${placeIndex}/dateExceptions/${exceptionIndex}/date must stay inside the pack horizon`,
        );
      }
      if (
        !exception.closed &&
        timeToMinutes(exception.closes) <= timeToMinutes(exception.opens)
      ) {
        issues.push(
          `/places/${placeIndex}/dateExceptions/${exceptionIndex}/closes must follow opens`,
        );
      }
    }
    for (const claim of [
      "identity",
      "address",
      "hours",
      "price",
      "publicAccess",
    ] as const) {
      const reference = place.evidence[claim];
      if (!isStrictTimestampV2(reference.checkedAt)) {
        issues.push(
          `/places/${placeIndex}/evidence/${claim}/checkedAt must contain a real calendar timestamp`,
        );
      }
      const source = sourceById.get(reference.sourceId);
      const fact = {
        identity: "IDENTITY",
        address: "ADDRESS",
        hours: "HOURS",
        price: "PRICE",
        publicAccess: "PUBLIC_ACCESS",
      }[claim] as "IDENTITY" | "ADDRESS" | "HOURS" | "PRICE" | "PUBLIC_ACCESS";
      if (!source) {
        issues.push(
          `/places/${placeIndex}/evidence/${claim} references an unknown source`,
        );
      } else if (!sourceSupportsClaim(source, fact)) {
        issues.push(
          `/places/${placeIndex}/evidence/${claim} source does not authorize that fact scope`,
        );
      } else if (reference.checkedAt !== source.checkedAt) {
        issues.push(
          `/places/${placeIndex}/evidence/${claim}/checkedAt must match its source`,
        );
      }
      if (
        (claim === "hours" || claim === "price") &&
        Date.parse(pack.validThrough) - Date.parse(reference.checkedAt) >
          60 * 86_400_000
      ) {
        issues.push(
          `/places/${placeIndex}/evidence/${claim}/checkedAt becomes hard-stale before validThrough`,
        );
      }
    }
    const coordinatesReference = place.evidence.coordinates;
    if (coordinatesReference) {
      if (!isStrictTimestampV2(coordinatesReference.checkedAt)) {
        issues.push(
          `/places/${placeIndex}/evidence/coordinates/checkedAt must contain a real calendar timestamp`,
        );
      }
      const coordinatesSource = sourceById.get(coordinatesReference.sourceId);
      if (!coordinatesSource) {
        issues.push(
          `/places/${placeIndex}/evidence/coordinates references an unknown source`,
        );
      } else if (!sourceSupportsClaim(coordinatesSource, "COORDINATES")) {
        issues.push(
          `/places/${placeIndex}/evidence/coordinates source does not authorize coordinates`,
        );
      } else if (
        coordinatesReference.checkedAt !== coordinatesSource.checkedAt
      ) {
        issues.push(
          `/places/${placeIndex}/evidence/coordinates/checkedAt must match its source`,
        );
      }
    }
    if (
      place.routeEligibility.kind === "ROUTABLE" &&
      (!place.coordinates || !coordinatesReference)
    ) {
      issues.push(
        `/places/${placeIndex} ROUTABLE requires source-backed coordinates`,
      );
    }
    if (
      place.routeEligibility.kind === "REFERENCE_ONLY" &&
      place.routeEligibility.reasons.includes("UNSUPPORTED_COORDINATES") &&
      (place.coordinates !== null || coordinatesReference !== null)
    ) {
      issues.push(
        `/places/${placeIndex} UNSUPPORTED_COORDINATES must not retain coordinates or a coordinate source`,
      );
    }
    const officialSource = sourceById.get(place.evidence.officialLink.sourceId);
    if (!isStrictTimestampV2(place.evidence.officialLink.checkedAt)) {
      issues.push(
        `/places/${placeIndex}/evidence/officialLink/checkedAt must contain a real calendar timestamp`,
      );
    }
    if (!officialSource || officialSource.sourceKind !== "OFFICIAL_SITE") {
      issues.push(
        `/places/${placeIndex}/evidence/officialLink must reference an official site`,
      );
    } else {
      if (place.evidence.officialLink.checkedAt !== officialSource.checkedAt) {
        issues.push(
          `/places/${placeIndex}/evidence/officialLink/checkedAt must match its source`,
        );
      }
      try {
        if (
          new URL(place.officialUrl).origin !==
          new URL(officialSource.url).origin
        ) {
          issues.push(
            `/places/${placeIndex}/officialUrl must share its official evidence origin`,
          );
        }
      } catch {
        issues.push(`/places/${placeIndex}/officialUrl must be a valid URL`);
      }
    }
  }
  if (
    [...usedCalendarSourceIds].sort().join("\u0000") !==
    [...pack.calendarSourceIds].sort().join("\u0000")
  ) {
    issues.push(
      "/calendarSourceIds must exactly equal the calendar sources referenced by places",
    );
  }
  for (const sourceId of pack.station.sourceIds) {
    const source = sourceById.get(sourceId);
    if (!source || source.usage.mode === "OFFICIAL_LINK_ONLY") {
      issues.push("/station/sourceIds must reference reusable evidence");
    }
  }
  return issues;
};

export const validatePlannerIntentV2 = (
  value: unknown,
  options: Readonly<{ now?: Date }> = {},
): PlannerValidationResult<PlannerIntentV2> =>
  validateWith<PlannerIntentV2>(plannerIntentValidator, value, (intent) =>
    plannerIntentIssues(intent, options.now),
  );

export const validateSearchPlanInputV2 = validatePlannerIntentV2;

export const validatePlaceDataPackV2 = (
  value: unknown,
): PlannerValidationResult<PlaceDataPackV2> =>
  validateWith<PlaceDataPackV2>(
    placeDataPackValidator,
    value,
    placeDataPackIssues,
  );

const canonicalizeReviewedValueV2 = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeReviewedValueV2);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeReviewedValueV2(child)]),
    );
  }
  return value;
};

const canonicalReviewedJsonV2 = (value: unknown): string =>
  JSON.stringify(canonicalizeReviewedValueV2(value));

/**
 * Projects every scheduling-relevant published claim into a reviewable,
 * deterministic snapshot. The snapshot deliberately duplicates source values:
 * changing the pack is not enough to change what the release audit accepts.
 */
export const createReviewedPackClaimsV2 = (
  pack: PlaceDataPackV2,
): ReviewedPackClaimsV2 => {
  const sourceById = new Map(
    pack.sources.map((source) => [source.sourceId, source]),
  );
  const sourcePointer = (
    sourceId: string,
    checkedAt: string,
  ): ReviewedClaimSourceV2 => {
    const source = sourceById.get(sourceId);
    return {
      sourceId,
      sourceUrl: source?.url ?? `missing:${sourceId}`,
      checkedAt,
      title: source?.title ?? "Missing source",
      publisher: source?.publisher ?? "Missing publisher",
      sourceKind: source?.sourceKind ?? "OFFICIAL_SITE",
      usage: source?.usage ?? { mode: "OFFICIAL_LINK_ONLY" },
      ...(source?.publishedAt ? { publishedAt: source.publishedAt } : {}),
      ...(source?.notes ? { notes: source.notes } : {}),
    };
  };
  const claim = <T>(
    value: T,
    reference: EvidenceReferenceV2,
  ): ReviewedClaimV2<T> => ({
    value,
    source: sourcePointer(reference.sourceId, reference.checkedAt),
  });

  return {
    schemaVersion: "2",
    packVersion: pack.packVersion,
    status: pack.status,
    generatedAt: pack.generatedAt,
    validThrough: pack.validThrough,
    dataLicense: pack.dataLicense,
    station: {
      name: pack.station.name,
      coordinates: pack.station.coordinates,
      sources: pack.station.sourceIds.map((sourceId) => {
        const source = sourceById.get(sourceId);
        return sourcePointer(sourceId, source?.checkedAt ?? "missing");
      }),
    },
    calendarSources: pack.calendarSourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      return sourcePointer(sourceId, source?.checkedAt ?? "missing");
    }),
    places: pack.places.map((place) => ({
      placeId: place.placeId,
      calendarSources: place.calendarSourceIds.map((sourceId) => {
        const source = sourceById.get(sourceId);
        return sourcePointer(sourceId, source?.checkedAt ?? "missing");
      }),
      identity: claim(place.name, place.evidence.identity),
      address: claim(place.address, place.evidence.address),
      coordinates: claim(
        place.coordinates,
        place.evidence.coordinates ?? {
          sourceId: "missing-coordinate-evidence",
          checkedAt: "missing",
        },
      ),
      hours: claim(
        {
          hoursProvenance: place.hoursProvenance,
          weeklyHours: place.weeklyHours,
          dateExceptions: place.dateExceptions,
        },
        place.evidence.hours,
      ),
      price: claim(
        {
          price: place.price,
          priceProvenance: place.priceProvenance,
        },
        place.evidence.price,
      ),
      publicAccess: claim(place.routeEligibility, place.evidence.publicAccess),
      officialLink: claim(place.officialUrl, place.evidence.officialLink),
    })),
  };
};

/**
 * Validates the pack contract and then binds its facts to the separately
 * reviewed ledger entry for this exact pack version.
 */
export const validateReviewedPlaceDataPackV2 = (
  value: unknown,
  ledger: unknown,
): PlannerValidationResult<PlaceDataPackV2> => {
  const validation = validatePlaceDataPackV2(value);
  if (!validation.ok) return validation;
  const pack = validation.value;
  if (
    ledger === null ||
    typeof ledger !== "object" ||
    Array.isArray(ledger) ||
    !Object.prototype.hasOwnProperty.call(ledger, pack.packVersion)
  ) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      issues: [
        `/reviewedClaims/${pack.packVersion} must contain a reviewed claim snapshot`,
      ],
    };
  }
  const reviewed = (ledger as Record<string, unknown>)[pack.packVersion];
  const expected = createReviewedPackClaimsV2(pack);
  if (canonicalReviewedJsonV2(reviewed) !== canonicalReviewedJsonV2(expected)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      issues: [
        `/reviewedClaims/${pack.packVersion} must exactly match the pack's canonical published claims`,
      ],
    };
  }
  return validation;
};

export const validateEveningPlanV2 = (
  value: unknown,
): PlannerValidationResult<EveningPlanV2> =>
  validateWith<EveningPlanV2>(eveningPlanValidator, value, (plan) => {
    const issues = plannerIntentIssues(plan.intent).map(
      (issue) => `/intent${issue}`,
    );
    for (const [index, stop] of plan.stops.entries()) {
      for (const [field, timestamp] of [
        ["startsAt", stop.startsAt],
        ["endsAt", stop.endsAt],
        ["sourceCheckedAt", stop.sourceCheckedAt],
      ] as const) {
        if (!isStrictTimestampV2(timestamp)) {
          issues.push(
            `/stops/${index}/${field} must contain a real calendar timestamp`,
          );
        }
      }
    }
    if (!isStrictTimestampV2(plan.totals.startsAt)) {
      issues.push("/totals/startsAt must contain a real calendar timestamp");
    }
    if (!isStrictTimestampV2(plan.totals.endsAt)) {
      issues.push("/totals/endsAt must contain a real calendar timestamp");
    }
    if (plan.stops.some(({ position }, index) => position !== index)) {
      issues.push("/stops positions must be contiguous from zero");
    }
    if (new Set(plan.stops.map(({ place }) => place.placeId)).size < 2) {
      issues.push("/stops places must be unique");
    }
    if (plan.totals.stopCount !== plan.stops.length) {
      issues.push("/totals/stopCount must equal /stops length");
    }
    if (plan.totals.minPriceYen > plan.totals.maxPriceYen) {
      issues.push("/totals/minPriceYen must not exceed maxPriceYen");
    }
    return issues;
  });

export const validateShowPlaceEvidenceInputV2 = (
  value: unknown,
): PlannerValidationResult<ShowPlaceEvidenceInputV2> =>
  validateWith<ShowPlaceEvidenceInputV2>(evidenceInputValidator, value);

export const validateSwapPlanInputV2 = (
  value: unknown,
): PlannerValidationResult<SwapPlanInputV2> =>
  validateWith<SwapPlanInputV2>(swapInputValidator, value, (input) => {
    const issues = plannerIntentIssues(input.intent);
    const planValidation = validateEveningPlanV2(input.plan);
    if (!planValidation.ok) {
      issues.push(...planValidation.issues.map((issue) => `/plan${issue}`));
    }
    if (input.planId !== input.plan.planId) {
      issues.push("/planId must equal /plan/planId");
    }
    if (input.candidateSetId !== input.plan.candidateSetId) {
      issues.push("/candidateSetId must equal /plan/candidateSetId");
    }
    if (JSON.stringify(input.intent) !== JSON.stringify(input.plan.intent)) {
      issues.push("/intent must equal /plan/intent");
    }
    if (input.stopIndex >= input.plan.stops.length) {
      issues.push("/stopIndex must identify an existing stop");
    }
    return issues;
  });

export const validateSavePlanInputV2 = (
  value: unknown,
): PlannerValidationResult<SavePlanInputV2> =>
  validateWith<SavePlanInputV2>(saveInputValidator, value);

export const validateDeleteSavedPlanInputV2 = (
  value: unknown,
): PlannerValidationResult<DeleteSavedPlanInputV2> =>
  validateWith<DeleteSavedPlanInputV2>(deleteInputValidator, value);

export const validatePlannerEnvelopeV2 = <T = unknown>(
  value: unknown,
  dataValidator?: (data: unknown) => data is T,
): PlannerValidationResult<PlannerEnvelopeV2<T>> =>
  validateWith<PlannerEnvelopeV2<T>>(
    unknownEnvelopeValidator,
    value,
    (envelope) => {
      const issues = isStrictTimestampV2(envelope.meta.completedAt)
        ? []
        : ["/meta/completedAt must contain a real calendar timestamp"];
      if (envelope.ok && dataValidator && !dataValidator(envelope.data)) {
        issues.push("/data is invalid");
      }
      return issues;
    },
  );

export const plannerV2Validators = {
  intent: plannerIntentValidator,
  dataPack: placeDataPackValidator,
  eveningPlan: eveningPlanValidator,
  showPlaceEvidenceInput: evidenceInputValidator,
  swapPlanInput: swapInputValidator,
  savePlanInput: saveInputValidator,
  deleteSavedPlanInput: deleteInputValidator,
  envelope: unknownEnvelopeValidator,
} as const satisfies Record<string, ValidateFunction>;

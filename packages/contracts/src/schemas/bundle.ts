import { opaqueIdSchema, timestampSchema } from "./common";
import { slotSchema } from "./slot";

export const REASON_CODES = [
  "MATCHES_PREFERENCES",
  "HIGH_NOVELTY",
  "LOW_TRAVEL",
  "GOOD_VALUE",
  "USES_TIME_WELL",
] as const;

export const scoreBreakdownSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "preferenceFit",
    "novelty",
    "timeUtilization",
    "discount",
    "travelBurden",
  ],
  properties: {
    preferenceFit: { type: "number", minimum: 0, maximum: 1 },
    novelty: { type: "number", minimum: 0, maximum: 1 },
    timeUtilization: { type: "number", minimum: 0, maximum: 1 },
    discount: { type: "number", minimum: 0, maximum: 1 },
    travelBurden: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

export const bundleItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "position",
    "slot",
    "travelFromPreviousMinutes",
    "spareGapFromPreviousMinutes",
  ],
  properties: {
    position: { enum: [0, 1, 2] },
    slot: slotSchema,
    travelFromPreviousMinutes: {
      anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
    },
    spareGapFromPreviousMinutes: {
      anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
    },
  },
} as const;

export const bundleSummarySchema = {
  $comment: "serendipity.bundle-summary.v1",
  type: "object",
  additionalProperties: false,
  required: [
    "bundleId",
    "bundleVersion",
    "items",
    "totalPriceYen",
    "totalTravelMinutes",
    "startsAt",
    "endsAt",
    "score",
    "scoreBreakdown",
    "reasonCodes",
  ],
  properties: {
    bundleId: opaqueIdSchema,
    bundleVersion: { type: "integer", minimum: 1 },
    items: {
      type: "array",
      items: bundleItemSchema,
      minItems: 3,
      maxItems: 3,
    },
    totalPriceYen: { type: "integer", minimum: 0 },
    totalTravelMinutes: { type: "integer", minimum: 0 },
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    score: { type: "number", minimum: 0, maximum: 100 },
    scoreBreakdown: scoreBreakdownSchema,
    reasonCodes: {
      type: "array",
      items: { enum: REASON_CODES },
      maxItems: 3,
      uniqueItems: true,
    },
  },
} as const;

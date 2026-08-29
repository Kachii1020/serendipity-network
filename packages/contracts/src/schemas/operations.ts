import { bundleSummarySchema } from "./bundle";
import {
  opaqueIdSchema,
  providerSchema,
  SCHEMA_VERSION,
  tagArraySchema,
  timestampSchema,
} from "./common";
import { slotSchema } from "./slot";

const versionProperty = { schemaVersion: { const: SCHEMA_VERSION } } as const;
const versionRequired = ["schemaVersion"] as const;
const bundleSelectionProperties = {
  bundleSessionId: opaqueIdSchema,
  bundleId: opaqueIdSchema,
  bundleVersion: { type: "integer", minimum: 1 },
} as const;

export const providerSearchInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "startAt",
    "endAt",
    "maxPriceYen",
    "partySize",
    "preferredTags",
    "excludedTags",
  ],
  properties: {
    ...versionProperty,
    startAt: timestampSchema,
    endAt: timestampSchema,
    maxPriceYen: { type: "integer", minimum: 0, maximum: 100_000 },
    partySize: { const: 1 },
    preferredTags: tagArraySchema,
    excludedTags: tagArraySchema,
  },
} as const;

export const providerSearchDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provider", "slots", "inventoryAsOf"],
  properties: {
    provider: providerSchema,
    slots: {
      type: "array",
      items: slotSchema,
      maxItems: 10,
    },
    inventoryAsOf: timestampSchema,
  },
} as const;

export const providerHoldInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "slotId",
    "inventoryVersion",
    "quantity",
    "browserSessionId",
    "clientRequestId",
    "idempotencyKey",
  ],
  properties: {
    ...versionProperty,
    slotId: opaqueIdSchema,
    inventoryVersion: opaqueIdSchema,
    quantity: { const: 1 },
    browserSessionId: opaqueIdSchema,
    clientRequestId: opaqueIdSchema,
    idempotencyKey: { type: "string", minLength: 22, maxLength: 128 },
  },
} as const;

export const providerHoldDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provider", "holdSafeReference", "slotId", "status", "expiresAt"],
  properties: {
    provider: providerSchema,
    holdSafeReference: opaqueIdSchema,
    slotId: opaqueIdSchema,
    status: { const: "HELD" },
    expiresAt: timestampSchema,
  },
} as const;

export const providerHoldStatusInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [...versionRequired, "browserSessionId"],
  properties: {
    ...versionProperty,
    holdSafeReference: opaqueIdSchema,
    clientRequestId: opaqueIdSchema,
    browserSessionId: opaqueIdSchema,
  },
  oneOf: [
    {
      required: ["holdSafeReference"],
      properties: {
        holdSafeReference: opaqueIdSchema,
        clientRequestId: false,
      },
    },
    {
      required: ["clientRequestId"],
      properties: {
        holdSafeReference: false,
        clientRequestId: opaqueIdSchema,
      },
    },
  ],
} as const;

export const providerHoldStatusDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provider", "holdSafeReference", "slotId", "status", "expiresAt"],
  properties: {
    provider: providerSchema,
    holdSafeReference: opaqueIdSchema,
    slotId: opaqueIdSchema,
    status: { enum: ["HELD", "CONFIRMED", "RELEASED", "EXPIRED"] },
    expiresAt: timestampSchema,
    reservationRef: opaqueIdSchema,
  },
} as const;

export const providerConfirmInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "holdSafeReference",
    "browserSessionId",
    "idempotencyKey",
  ],
  properties: {
    ...versionProperty,
    holdSafeReference: opaqueIdSchema,
    browserSessionId: opaqueIdSchema,
    idempotencyKey: { type: "string", minLength: 22, maxLength: 128 },
  },
} as const;

export const providerConfirmDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "provider",
    "holdSafeReference",
    "status",
    "reservationRef",
    "confirmedAt",
  ],
  properties: {
    provider: providerSchema,
    holdSafeReference: opaqueIdSchema,
    status: { const: "CONFIRMED" },
    reservationRef: opaqueIdSchema,
    confirmedAt: timestampSchema,
  },
} as const;

export const providerReleaseInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "holdSafeReference",
    "browserSessionId",
    "idempotencyKey",
    "reason",
  ],
  properties: {
    ...versionProperty,
    holdSafeReference: opaqueIdSchema,
    browserSessionId: opaqueIdSchema,
    idempotencyKey: { type: "string", minLength: 22, maxLength: 128 },
    reason: {
      enum: [
        "USER_CANCELLED",
        "BUNDLE_COMPENSATION",
        "HOLD_EXPIRED_UI",
        "DEMO_RESET",
      ],
    },
  },
} as const;

export const providerReleaseDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "provider",
    "holdSafeReference",
    "slotId",
    "status",
    "capacityRestored",
  ],
  properties: {
    provider: providerSchema,
    holdSafeReference: opaqueIdSchema,
    slotId: opaqueIdSchema,
    status: { enum: ["RELEASED", "EXPIRED"] },
    capacityRestored: { type: "boolean" },
  },
} as const;

export const findOptionsInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "area",
    "startAt",
    "endAt",
    "totalBudgetYen",
    "partySize",
    "preferredTags",
    "excludedTags",
  ],
  properties: {
    ...versionProperty,
    area: { const: "shibuya" },
    startAt: timestampSchema,
    endAt: timestampSchema,
    totalBudgetYen: { type: "integer", minimum: 1, maximum: 100_000 },
    partySize: { const: 1 },
    preferredTags: tagArraySchema,
    excludedTags: tagArraySchema,
  },
} as const;

export const findOptionsDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "bundleSessionId",
    "bundleVersion",
    "selectedBundle",
    "alternatives",
    "providerStatuses",
  ],
  properties: {
    bundleSessionId: opaqueIdSchema,
    bundleVersion: { type: "integer", minimum: 1 },
    selectedBundle: bundleSummarySchema,
    alternatives: {
      type: "array",
      items: bundleSummarySchema,
      maxItems: 2,
    },
    providerStatuses: {
      type: "object",
      additionalProperties: false,
      required: ["kiln", "nori", "loop"],
      properties: {
        kiln: { enum: ["ONLINE", "INVALID", "OFFLINE"] },
        nori: { enum: ["ONLINE", "INVALID", "OFFLINE"] },
        loop: { enum: ["ONLINE", "INVALID", "OFFLINE"] },
      },
    },
  },
} as const;

export const showBundleInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "bundleSessionId",
    "bundleId",
    "bundleVersion",
  ],
  properties: { ...versionProperty, ...bundleSelectionProperties },
} as const;

export const showBundleDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["selectedBundle", "explanation"],
  properties: {
    selectedBundle: bundleSummarySchema,
    explanation: { type: "string", minLength: 1, maxLength: 400 },
  },
} as const;

export const holdBundleInputSchema = showBundleInputSchema;

export const holdBundleDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "bundleHoldId",
    "bundleId",
    "status",
    "expiresAt",
    "providerHolds",
  ],
  properties: {
    bundleHoldId: opaqueIdSchema,
    bundleId: opaqueIdSchema,
    status: { const: "HELD" },
    expiresAt: timestampSchema,
    providerHolds: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "holdSafeReference", "status"],
        properties: {
          provider: providerSchema,
          holdSafeReference: opaqueIdSchema,
          status: { const: "HELD" },
        },
      },
    },
  },
} as const;

export const confirmBundleInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [...versionRequired, "bundleSessionId", "bundleHoldId"],
  properties: {
    ...versionProperty,
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
  },
} as const;

export const confirmBundleDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "bundleId",
    "status",
    "confirmedAt",
    "totalPriceYen",
    "reservations",
  ],
  properties: {
    bundleId: opaqueIdSchema,
    status: { const: "CONFIRMED" },
    confirmedAt: timestampSchema,
    totalPriceYen: { type: "integer", minimum: 0 },
    reservations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "reservationRef"],
        properties: {
          provider: providerSchema,
          reservationRef: opaqueIdSchema,
        },
      },
    },
  },
} as const;

export const releaseBundleInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [...versionRequired, "bundleSessionId", "bundleHoldId", "reason"],
  properties: {
    ...versionProperty,
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    reason: { enum: ["USER_CANCELLED", "HOLD_EXPIRED_UI"] },
  },
} as const;

export const releaseBundleDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bundleId", "status", "providerStatuses"],
  properties: {
    bundleId: opaqueIdSchema,
    status: { const: "RELEASED" },
    providerStatuses: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "status"],
        properties: {
          provider: providerSchema,
          status: { enum: ["RELEASED", "EXPIRED"] },
        },
      },
    },
  },
} as const;

export const bundleReloadDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "bundle",
    "bundleHoldId",
    "bundleSessionId",
    "expiresAt",
    "ok",
    "phase",
    "providerStates",
    "requiresFreshSearch",
  ],
  properties: {
    bundle: bundleSummarySchema,
    bundleHoldId: opaqueIdSchema,
    bundleSessionId: opaqueIdSchema,
    expiresAt: {
      oneOf: [timestampSchema, { type: "null" }],
    },
    ok: { const: true },
    phase: { enum: ["confirmed", "held", "released"] },
    providerStates: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["holdSafeReference", "provider", "status"],
        properties: {
          holdSafeReference: opaqueIdSchema,
          provider: providerSchema,
          reservationRef: opaqueIdSchema,
          status: { enum: ["CONFIRMED", "EXPIRED", "HELD", "RELEASED"] },
        },
      },
    },
    requiresFreshSearch: { type: "boolean" },
  },
} as const;

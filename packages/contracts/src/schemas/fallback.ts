import { bundleSummarySchema } from "./bundle";
import {
  errorSchema,
  opaqueIdSchema,
  providerSchema,
  resultMetaSchema,
  SCHEMA_VERSION,
} from "./common";
import { failureEnvelopeSchema } from "./envelope";
import { intentSchema } from "./intent";
import {
  confirmBundleDataSchema,
  confirmBundleInputSchema,
  findOptionsDataSchema,
  holdBundleDataSchema,
  holdBundleInputSchema,
  providerConfirmDataSchema,
  providerHoldDataSchema,
  providerHoldStatusDataSchema,
  providerHoldStatusInputSchema,
  providerReleaseDataSchema,
  providerSearchDataSchema,
  releaseBundleDataSchema,
  releaseBundleInputSchema,
} from "./operations";

const versionProperty = { schemaVersion: { const: SCHEMA_VERSION } } as const;
const versionRequired = ["schemaVersion"] as const;

const successEnvelopeSchema = <const TData extends object>(data: TData) =>
  ({
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "ok", "data", "meta"],
    properties: {
      schemaVersion: { const: SCHEMA_VERSION },
      ok: { const: true },
      data,
      meta: resultMetaSchema,
    },
  }) as const;

const operationSchema = <const TInput extends object>(
  input: TInput,
  toolNames: readonly string[],
) =>
  ({
    type: "object",
    additionalProperties: false,
    required: ["provider", "toolName", "input"],
    properties: {
      provider: providerSchema,
      toolName: { enum: toolNames },
      input,
    },
  }) as const;

const providerResultSchema = <const TResult extends object>(result: TResult) =>
  ({
    type: "object",
    additionalProperties: false,
    required: ["provider", "result"],
    properties: {
      provider: providerSchema,
      result,
    },
  }) as const;

/** Public Provider tool inputs. Stable references replace private idempotency keys. */
export const providerToolHoldInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "slotId",
    "inventoryVersion",
    "quantity",
    "browserSessionId",
    "clientRequestId",
  ],
  properties: {
    ...versionProperty,
    slotId: opaqueIdSchema,
    inventoryVersion: opaqueIdSchema,
    quantity: { const: 1 },
    browserSessionId: opaqueIdSchema,
    clientRequestId: opaqueIdSchema,
  },
} as const;

export const providerToolConfirmInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [...versionRequired, "holdSafeReference", "browserSessionId"],
  properties: {
    ...versionProperty,
    holdSafeReference: opaqueIdSchema,
    browserSessionId: opaqueIdSchema,
  },
} as const;

export const providerToolReleaseInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "holdSafeReference",
    "browserSessionId",
    "reason",
  ],
  properties: {
    ...versionProperty,
    holdSafeReference: opaqueIdSchema,
    browserSessionId: opaqueIdSchema,
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

const providerSearchSuccessSchema = successEnvelopeSchema(
  providerSearchDataSchema,
);
const providerHoldResultEnvelopeSchema = {
  oneOf: [successEnvelopeSchema(providerHoldDataSchema), failureEnvelopeSchema],
} as const;
const providerReleaseResultEnvelopeSchema = {
  oneOf: [
    successEnvelopeSchema(providerReleaseDataSchema),
    failureEnvelopeSchema,
  ],
} as const;
const providerConfirmationResultEnvelopeSchema = {
  oneOf: [
    successEnvelopeSchema(providerConfirmDataSchema),
    successEnvelopeSchema(providerHoldStatusDataSchema),
    failureEnvelopeSchema,
  ],
} as const;

export const directComposeInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [...versionRequired, "intent", "providerResults"],
  properties: {
    ...versionProperty,
    intent: intentSchema,
    providerResults: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: providerResultSchema(providerSearchSuccessSchema),
    },
  },
} as const;

export const directComposeDataSchema = findOptionsDataSchema;
export const directPrepareHoldInputSchema = holdBundleInputSchema;

export const directPrepareHoldDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bundleSessionId", "bundleHoldId", "operations"],
  properties: {
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    operations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: operationSchema(providerToolHoldInputSchema, [
        "kiln_hold_slot",
        "nori_hold_slot",
        "loop_hold_slot",
      ]),
    },
  },
} as const;

export const directRecordHoldInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "bundleSessionId",
    "bundleHoldId",
    "providerResults",
  ],
  properties: {
    ...versionProperty,
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    providerResults: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: providerResultSchema(providerHoldResultEnvelopeSchema),
    },
  },
} as const;

const recoveryRequiredDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "bundleSessionId",
    "bundleHoldId",
    "failedProviders",
    "releaseOperations",
    "replacementBundle",
    "error",
  ],
  properties: {
    status: { const: "RECOVERY_REQUIRED" },
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    failedProviders: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      uniqueItems: true,
      items: providerSchema,
    },
    releaseOperations: {
      type: "array",
      maxItems: 2,
      items: operationSchema(providerToolReleaseInputSchema, [
        "kiln_release_hold",
        "nori_release_hold",
        "loop_release_hold",
      ]),
    },
    replacementBundle: {
      oneOf: [bundleSummarySchema, { type: "null" }],
    },
    error: errorSchema,
  },
} as const;

export const directRecordHoldDataSchema = {
  oneOf: [holdBundleDataSchema, recoveryRequiredDataSchema],
} as const;

export const directPrepareReleaseInputSchema = releaseBundleInputSchema;
export const directPrepareReleaseDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bundleSessionId", "bundleHoldId", "operations"],
  properties: {
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    operations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: operationSchema(providerToolReleaseInputSchema, [
        "kiln_release_hold",
        "nori_release_hold",
        "loop_release_hold",
      ]),
    },
  },
} as const;

export const directRecordReleaseInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "bundleSessionId",
    "bundleHoldId",
    "providerResults",
  ],
  properties: {
    ...versionProperty,
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    providerResults: {
      type: "array",
      maxItems: 3,
      items: providerResultSchema(providerReleaseResultEnvelopeSchema),
    },
  },
} as const;

const compensationCompleteDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "bundleSessionId", "bundleHoldId", "replacementBundle"],
  properties: {
    status: { const: "COMPENSATED" },
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    replacementBundle: {
      oneOf: [bundleSummarySchema, { type: "null" }],
    },
  },
} as const;

export const directRecordReleaseDataSchema = {
  oneOf: [releaseBundleDataSchema, compensationCompleteDataSchema],
} as const;

export const directPrepareConfirmationInputSchema = confirmBundleInputSchema;
export const directPrepareConfirmationDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bundleSessionId", "bundleHoldId", "operations"],
  properties: {
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    operations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: operationSchema(providerToolConfirmInputSchema, [
        "kiln_confirm_hold",
        "nori_confirm_hold",
        "loop_confirm_hold",
      ]),
    },
  },
} as const;

export const directRecordConfirmationInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...versionRequired,
    "bundleSessionId",
    "bundleHoldId",
    "providerResults",
  ],
  properties: {
    ...versionProperty,
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    providerResults: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: providerResultSchema(providerConfirmationResultEnvelopeSchema),
    },
  },
} as const;

const reconciliationRequiredDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "bundleSessionId", "bundleHoldId", "statusOperations"],
  properties: {
    status: { const: "RECONCILIATION_REQUIRED" },
    bundleSessionId: opaqueIdSchema,
    bundleHoldId: opaqueIdSchema,
    statusOperations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: operationSchema(providerHoldStatusInputSchema, [
        "kiln_get_hold_status",
        "nori_get_hold_status",
        "loop_get_hold_status",
      ]),
    },
  },
} as const;

export const directRecordConfirmationDataSchema = {
  oneOf: [confirmBundleDataSchema, reconciliationRequiredDataSchema],
} as const;

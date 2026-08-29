export const SCHEMA_VERSION = "1" as const;

export const PROVIDERS = ["kiln", "nori", "loop"] as const;

export const TAGS = [
  "creative",
  "seasonal",
  "experimental",
  "hands-on",
  "beginner",
  "food",
  "solo-friendly",
  "music",
  "intimate",
  "craft",
  "tea",
  "analog",
  "cozy",
] as const;

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNSUPPORTED_SCHEMA_VERSION",
  "WEBMCP_UNAVAILABLE",
  "WEBMCP_PERMISSION_DENIED",
  "ORIGIN_MISMATCH",
  "TOOL_NOT_FOUND",
  "PROVIDER_OFFLINE",
  "PROVIDER_TIMEOUT",
  "CANCELLED",
  "NO_VALID_BUNDLE",
  "BUNDLE_NOT_FOUND",
  "STALE_BUNDLE",
  "SLOT_NOT_FOUND",
  "SLOT_UNAVAILABLE",
  "HOLD_NOT_FOUND",
  "HOLD_EXPIRED",
  "HOLD_RELEASED",
  "ALREADY_CONFIRMED",
  "IDEMPOTENCY_CONFLICT",
  "COMPENSATION_INCOMPLETE",
  "RECONCILIATION_REQUIRED",
  "CONFIRMATION_INCONSISTENT",
  "INTERNAL_ERROR",
] as const;

export const timestampSchema = {
  type: "string",
  pattern:
    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
} as const;

export const opaqueIdSchema = {
  type: "string",
  minLength: 1,
  maxLength: 128,
} as const;

export const providerSchema = { enum: PROVIDERS } as const;

export const tagArraySchema = {
  type: "array",
  items: { enum: TAGS },
  maxItems: 5,
  uniqueItems: true,
} as const;

export const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message", "retryable"],
  properties: {
    code: { enum: ERROR_CODES },
    message: { type: "string", minLength: 1, maxLength: 240 },
    retryable: { type: "boolean" },
    provider: providerSchema,
    safeReference: opaqueIdSchema,
  },
} as const;

export const resultMetaSchema = {
  type: "object",
  additionalProperties: false,
  required: ["correlationId", "origin", "completedAt"],
  properties: {
    correlationId: opaqueIdSchema,
    origin: {
      type: "string",
      pattern:
        "^(?:https://[^/]+(?::\\d+)?|http://(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?)$",
    },
    completedAt: timestampSchema,
  },
} as const;

export const PLANNER_SCHEMA_VERSION = "2" as const;
export const PLANNER_AREAS = ["shibuya"] as const;
export const PLANNER_TAGS = [
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
export const PLACE_CATEGORIES_V2 = [
  "heritage",
  "library",
  "park",
  "fitness",
  "pool",
  "public-space",
  "gallery",
  "botanical",
] as const;
export const SWAP_PREFERENCES = [
  "CHEAPER",
  "LESS_WALKING",
  "DIFFERENT_INTEREST",
] as const;
export const PLANNER_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNSUPPORTED_SCHEMA_VERSION",
  "CANCELLED",
  "NO_VALID_PLAN",
  "NO_REPLACEMENT",
  "PLACE_NOT_FOUND",
  "STALE_DATA_PACK",
  "STALE_PLAN",
  "ALREADY_SAVED",
  "STORAGE_LIMIT_REACHED",
  "STORAGE_UNAVAILABLE",
  "STORAGE_CORRUPT",
  "INTERNAL_ERROR",
] as const;

const plannerTimestampSchema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?\\+09:00$",
} as const;

const plannerTagArraySchema = {
  type: "array",
  items: { enum: PLANNER_TAGS },
  maxItems: 5,
  uniqueItems: true,
} as const;

export const plannerIntentV2ClientSchema = {
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
    startAt: plannerTimestampSchema,
    endAt: plannerTimestampSchema,
    totalBudgetYen: { type: "integer", minimum: 0, maximum: 30_000 },
    stopCount: { const: "AUTO" },
    maxWalkMinutesPerLeg: { type: "integer", minimum: 5, maximum: 30 },
    preferredTags: plannerTagArraySchema,
    excludedTags: plannerTagArraySchema,
  },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
): boolean =>
  Object.keys(value).length === required.length &&
  required.every((key) => key in value);

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+09:00$/.test(value) &&
  Number.isFinite(Date.parse(value));

const validTags = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 5 &&
  new Set(value).size === value.length &&
  value.every(
    (tag) =>
      typeof tag === "string" &&
      PLANNER_TAGS.some((candidate) => candidate === tag),
  );

const tokyoDate = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const validatePlannerIntentV2Client = (
  value: unknown,
  now = new Date(),
): { ok: true } | { ok: false } => {
  const keys = [
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
  ] as const;
  if (
    !isRecord(value) ||
    !exactKeys(value, keys) ||
    value.schemaVersion !== PLANNER_SCHEMA_VERSION ||
    value.area !== "shibuya" ||
    value.partySize !== 1 ||
    value.stopCount !== "AUTO" ||
    !validTimestamp(value.startAt) ||
    !validTimestamp(value.endAt) ||
    !Number.isInteger(value.totalBudgetYen) ||
    (value.totalBudgetYen as number) < 0 ||
    (value.totalBudgetYen as number) > 30_000 ||
    !Number.isInteger(value.maxWalkMinutesPerLeg) ||
    (value.maxWalkMinutesPerLeg as number) < 5 ||
    (value.maxWalkMinutesPerLeg as number) > 30 ||
    !validTags(value.preferredTags) ||
    !validTags(value.excludedTags)
  ) {
    return { ok: false };
  }
  const startAt = value.startAt;
  const endAt = value.endAt;
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  const durationMinutes = (end - start) / 60_000;
  const startMinutes =
    Number(startAt.slice(11, 13)) * 60 + Number(startAt.slice(14, 16));
  const endMinutes =
    Number(endAt.slice(11, 13)) * 60 + Number(endAt.slice(14, 16));
  const requestedDate = startAt.slice(0, 10);
  const today = tokyoDate(now);
  const days =
    (Date.parse(`${requestedDate}T00:00:00+09:00`) -
      Date.parse(`${today}T00:00:00+09:00`)) /
    86_400_000;
  const preferredTags = value.preferredTags;
  const excludedTags = value.excludedTags;
  const overlap = preferredTags.some((tag) => excludedTags.includes(tag));
  return end > start &&
    durationMinutes >= 120 &&
    durationMinutes <= 600 &&
    startAt.slice(0, 10) === endAt.slice(0, 10) &&
    startMinutes >= 12 * 60 &&
    endMinutes <= 23 * 60 + 30 &&
    days >= 0 &&
    days <= 7 &&
    !overlap
    ? { ok: true }
    : { ok: false };
};

const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);

export const validatePlannerEnvelopeV2Client = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== PLANNER_SCHEMA_VERSION ||
    typeof value.ok !== "boolean" ||
    !isRecord(value.meta) ||
    !validId(value.meta.correlationId) ||
    typeof value.meta.origin !== "string" ||
    !Number.isFinite(Date.parse(String(value.meta.completedAt))) ||
    typeof value.meta.packVersion !== "string"
  ) {
    return false;
  }
  try {
    if (new URL(value.meta.origin).origin !== value.meta.origin) return false;
  } catch {
    return false;
  }
  if (value.ok) return "data" in value && !("error" in value);
  if (!isRecord(value.error)) return false;
  const publicError = value.error;
  return (
    PLANNER_ERROR_CODES.some((code) => code === publicError.code) &&
    typeof publicError.message === "string" &&
    publicError.message.length > 0 &&
    publicError.message.length <= 240 &&
    typeof publicError.retryable === "boolean" &&
    !("data" in value)
  );
};

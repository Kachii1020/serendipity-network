export const PLANNER_V3_SCHEMA_VERSION = "3" as const;
export const PLANNER_V3_AREAS = ["shibuya", "shinjuku", "ikebukuro"] as const;
export const PLANNER_V3_INTEREST_PRESETS = [
  "SURPRISE",
  "ART_HERITAGE",
  "FOOD_DISCOVERY",
  "HANDS_ON",
  "CALM_QUIET",
  "LIVELY",
] as const;
export const PLANNER_V3_TAGS = [
  "art",
  "heritage",
  "food",
  "drinks",
  "hands-on",
  "quiet",
  "lively",
  "books",
  "outdoors",
  "music",
  "coffee-tea",
  "science",
] as const;
export const SWAP_PREFERENCES_V3 = [
  "CHEAPER",
  "LESS_WALKING",
  "DIFFERENT_INTEREST",
] as const;
export const PLANNER_V3_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNSUPPORTED_SCHEMA_VERSION",
  "CANCELLED",
  "NO_VALID_PLAN",
  "NO_REPLACEMENT",
  "AREA_NOT_ACTIVE",
  "PLACE_NOT_FOUND",
  "STALE_DATA_PACK",
  "STALE_PLAN",
  "ALREADY_SAVED",
  "STORAGE_LIMIT_REACHED",
  "STORAGE_UNAVAILABLE",
  "STORAGE_CORRUPT",
  "INTERNAL_ERROR",
] as const;

export const INTEREST_PRESET_TAGS_V3 = {
  SURPRISE: [],
  ART_HERITAGE: ["art", "heritage"],
  FOOD_DISCOVERY: ["food", "drinks", "coffee-tea"],
  HANDS_ON: ["hands-on", "science"],
  CALM_QUIET: ["quiet", "books", "outdoors"],
  LIVELY: ["lively", "music", "drinks"],
} as const satisfies Record<
  (typeof PLANNER_V3_INTEREST_PRESETS)[number],
  readonly (typeof PLANNER_V3_TAGS)[number][]
>;

const plannerTimestampV3ClientSchema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?\\+09:00$",
} as const;

const plannerTagArrayV3ClientSchema = {
  type: "array",
  items: { enum: PLANNER_V3_TAGS },
  maxItems: 5,
  uniqueItems: true,
} as const;

export const plannerIntentV3ClientSchema = {
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
    startAt: plannerTimestampV3ClientSchema,
    endAt: plannerTimestampV3ClientSchema,
    budgetPerPersonYen: {
      type: "integer",
      minimum: 0,
      maximum: 30_000,
    },
    includeMeal: { type: "boolean" },
    interestPreset: { enum: PLANNER_V3_INTEREST_PRESETS },
    maxWalkMinutesPerLeg: { type: "integer", minimum: 5, maximum: 30 },
    excludedTags: plannerTagArrayV3ClientSchema,
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

export const isStrictCalendarDateV3 = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
};

export const isStrictTimestampV3 = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      value,
    );
  return Boolean(
    match &&
    isStrictCalendarDateV3(match[1]) &&
    Number.isFinite(Date.parse(value)),
  );
};

export const isValidPlannerIdV3 = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);

export const isHttpsUrlV3 = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

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

const validTags = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 5 &&
  new Set(value).size === value.length &&
  value.every(
    (tag) =>
      typeof tag === "string" &&
      PLANNER_V3_TAGS.some((candidate) => candidate === tag),
  );

export const validatePlannerIntentV3Client = (
  value: unknown,
  now = new Date(),
): { ok: true } | { ok: false } => {
  const keys = [
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
  ] as const;
  if (
    !isRecord(value) ||
    !exactKeys(value, keys) ||
    value.schemaVersion !== PLANNER_V3_SCHEMA_VERSION ||
    !PLANNER_V3_AREAS.some((area) => area === value.area) ||
    !Number.isInteger(value.partySize) ||
    (value.partySize as number) < 1 ||
    (value.partySize as number) > 3 ||
    !isStrictTimestampV3(value.startAt) ||
    !value.startAt.endsWith("+09:00") ||
    !isStrictTimestampV3(value.endAt) ||
    !value.endAt.endsWith("+09:00") ||
    !Number.isInteger(value.budgetPerPersonYen) ||
    (value.budgetPerPersonYen as number) < 0 ||
    (value.budgetPerPersonYen as number) > 30_000 ||
    typeof value.includeMeal !== "boolean" ||
    !PLANNER_V3_INTEREST_PRESETS.some(
      (preset) => preset === value.interestPreset,
    ) ||
    !Number.isInteger(value.maxWalkMinutesPerLeg) ||
    (value.maxWalkMinutesPerLeg as number) < 5 ||
    (value.maxWalkMinutesPerLeg as number) > 30 ||
    !validTags(value.excludedTags)
  ) {
    return { ok: false };
  }

  if (!value.includeMeal && value.interestPreset === "FOOD_DISCOVERY") {
    return { ok: false };
  }
  const start = Date.parse(value.startAt);
  const end = Date.parse(value.endAt);
  const durationMinutes = (end - start) / 60_000;
  const startMinutes =
    Number(value.startAt.slice(11, 13)) * 60 +
    Number(value.startAt.slice(14, 16));
  const endMinutes =
    Number(value.endAt.slice(11, 13)) * 60 + Number(value.endAt.slice(14, 16));
  const requestedDate = value.startAt.slice(0, 10);
  const today = tokyoDate(now);
  const days =
    (Date.parse(`${requestedDate}T00:00:00+09:00`) -
      Date.parse(`${today}T00:00:00+09:00`)) /
    86_400_000;
  return end > start &&
    durationMinutes >= 120 &&
    durationMinutes <= 600 &&
    value.startAt.slice(0, 10) === value.endAt.slice(0, 10) &&
    startMinutes >= 12 * 60 &&
    endMinutes <= 23 * 60 + 30 &&
    days >= 0 &&
    days <= 7 &&
    start >= now.getTime() - 5 * 60_000
    ? { ok: true }
    : { ok: false };
};

const validMeta = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "correlationId",
      "origin",
      "completedAt",
      "packVersion",
      "area",
    ]) ||
    !isValidPlannerIdV3(value.correlationId) ||
    typeof value.origin !== "string" ||
    !isStrictTimestampV3(value.completedAt) ||
    !(
      value.packVersion === null ||
      (typeof value.packVersion === "string" &&
        /^\d+\.\d+\.\d+$/.test(value.packVersion))
    ) ||
    !(
      value.area === null ||
      PLANNER_V3_AREAS.some((area) => area === value.area)
    )
  ) {
    return false;
  }
  try {
    const url = new URL(value.origin);
    return (
      url.origin === value.origin &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
};

export const validatePlannerEnvelopeV3Client = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== PLANNER_V3_SCHEMA_VERSION ||
    typeof value.ok !== "boolean" ||
    !validMeta(value.meta)
  ) {
    return false;
  }
  if (value.ok) {
    return exactKeys(value, ["schemaVersion", "ok", "data", "meta"]);
  }
  const error = value.error;
  if (
    !exactKeys(value, ["schemaVersion", "ok", "error", "meta"]) ||
    !isRecord(error)
  ) {
    return false;
  }
  return (
    exactKeys(error, ["code", "message", "retryable"]) &&
    PLANNER_V3_ERROR_CODES.some((code) => code === error.code) &&
    typeof error.message === "string" &&
    error.message.length >= 1 &&
    error.message.length <= 240 &&
    typeof error.retryable === "boolean"
  );
};

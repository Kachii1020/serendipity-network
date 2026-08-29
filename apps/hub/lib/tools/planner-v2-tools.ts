import {
  type PlaceEvidenceDataV2,
  type PlannerEnvelopeV2,
  type PlannerIntentV2,
  type PlannerPublicErrorV2,
  type SearchPlansDataV2,
  type SwapPlanDataV2,
} from "@serendipity/contracts/planner-v2";
import {
  PLACE_CATEGORIES_V2,
  PLANNER_SCHEMA_VERSION,
  PLANNER_TAGS,
  SWAP_PREFERENCES,
  isStrictTimestampV2,
  plannerIntentV2ClientSchema,
  validatePlannerEnvelopeV2Client,
  validatePlannerIntentV2Client,
} from "@serendipity/contracts/planner-v2-shared";
import { assertPublicPayloadSafe } from "@serendipity/contracts/public-safety";
import {
  registerTool,
  type RegistrationHandle,
  type ToolDefinition,
} from "@serendipity/webmcp";

export const PLANNER_V2_TOOL_NAMES = [
  "find_evening_plan",
  "show_place_evidence",
  "swap_plan_stop",
  "save_plan",
  "delete_saved_plan",
] as const;

export type PlannerV2ToolName = (typeof PLANNER_V2_TOOL_NAMES)[number];
export type PlannerV2ToolTransport = "site-tool";
export type SwapPreferenceV2 = (typeof SWAP_PREFERENCES)[number];

type PlannerV2ReferenceInput = {
  schemaVersion: typeof PLANNER_SCHEMA_VERSION;
  candidateSetId: string;
  planId: string;
};

export type ShowPlaceEvidenceToolInputV2 = PlannerV2ReferenceInput & {
  placeId: string;
};

export type SwapPlanStopToolInputV2 = PlannerV2ReferenceInput & {
  targetPlaceId: string;
  preference: SwapPreferenceV2;
};

export type SavePlanToolInputV2 = PlannerV2ReferenceInput;

export type DeleteSavedPlanToolInputV2 = {
  schemaVersion: typeof PLANNER_SCHEMA_VERSION;
  planId: string;
};

export type PlannerV2ToolInput =
  | DeleteSavedPlanToolInputV2
  | PlannerIntentV2
  | SavePlanToolInputV2
  | ShowPlaceEvidenceToolInputV2
  | SwapPlanStopToolInputV2;

export type PlannerV2ToolPublicError = PlannerPublicErrorV2;

export type PlannerV2ToolStateCheck =
  { ok: true } | { error: PlannerV2ToolPublicError; ok: false };

type PlannerV2ToolAction<TInput extends PlannerV2ToolInput> = (
  input: TInput,
  transport: PlannerV2ToolTransport,
  signal?: AbortSignal,
) =>
  | PlannerEnvelopeV2<unknown>
  | Promise<PlannerEnvelopeV2<unknown> | string>
  | string;

export type PlannerV2ToolDependencies = {
  checkState: (
    name: PlannerV2ToolName,
    input: PlannerV2ToolInput,
  ) => PlannerV2ToolStateCheck;
  clock?: () => Date;
  correlationId?: () => string;
  deleteSaved: PlannerV2ToolAction<DeleteSavedPlanToolInputV2>;
  find: PlannerV2ToolAction<PlannerIntentV2>;
  hubOrigin: string;
  packVersion: string;
  save: PlannerV2ToolAction<SavePlanToolInputV2>;
  showEvidence: PlannerV2ToolAction<ShowPlaceEvidenceToolInputV2>;
  swap: PlannerV2ToolAction<SwapPlanStopToolInputV2>;
};

const idSchema = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
} as const;

export const findEveningPlanToolInputSchema = plannerIntentV2ClientSchema;

const referenceProperties = {
  schemaVersion: { const: PLANNER_SCHEMA_VERSION },
  candidateSetId: idSchema,
  planId: idSchema,
} as const;

export const showPlaceEvidenceToolInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "candidateSetId", "planId", "placeId"],
  properties: { ...referenceProperties, placeId: idSchema },
} as const;

export const swapPlanStopToolInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "candidateSetId",
    "planId",
    "targetPlaceId",
    "preference",
  ],
  properties: {
    ...referenceProperties,
    targetPlaceId: idSchema,
    preference: { enum: SWAP_PREFERENCES },
  },
} as const;

export const savePlanToolInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "candidateSetId", "planId"],
  properties: referenceProperties,
} as const;

export const deleteSavedPlanToolInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "planId"],
  properties: {
    schemaVersion: { const: PLANNER_SCHEMA_VERSION },
    planId: idSchema,
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

const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);

const validateReference = (
  value: unknown,
  extraKeys: readonly string[] = [],
): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  const keys = ["schemaVersion", "candidateSetId", "planId", ...extraKeys];
  return (
    exactKeys(value, keys) &&
    value.schemaVersion === PLANNER_SCHEMA_VERSION &&
    validId(value.candidateSetId) &&
    validId(value.planId)
  );
};

const inputValidators: Record<PlannerV2ToolName, (value: unknown) => boolean> =
  {
    find_evening_plan: (value) => validatePlannerIntentV2Client(value).ok,
    show_place_evidence: (value) =>
      validateReference(value, ["placeId"]) && validId(value.placeId),
    swap_plan_stop: (value) =>
      validateReference(value, ["targetPlaceId", "preference"]) &&
      validId(value.targetPlaceId) &&
      typeof value.preference === "string" &&
      SWAP_PREFERENCES.some((preference) => preference === value.preference),
    save_plan: (value) => validateReference(value),
    delete_saved_plan: (value) =>
      isRecord(value) &&
      exactKeys(value, ["schemaVersion", "planId"]) &&
      value.schemaVersion === PLANNER_SCHEMA_VERSION &&
      validId(value.planId),
  };

const error = (
  code: PlannerPublicErrorV2["code"],
  message: string,
  retryable = false,
): PlannerV2ToolPublicError => ({ code, message, retryable });

const exactOrigin = (value: string): string => {
  const parsed = new URL(value);
  const localHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error("Planner tools require a secure Hub origin");
  }
  return parsed.origin;
};

const envelopeContext = (dependencies: PlannerV2ToolDependencies) => ({
  completedAt: (dependencies.clock ?? (() => new Date()))().toISOString(),
  correlationId:
    dependencies.correlationId?.() ?? globalThis.crypto.randomUUID(),
  origin: exactOrigin(dependencies.hubOrigin),
  packVersion: dependencies.packVersion,
});

const failureEnvelope = (
  publicError: PlannerV2ToolPublicError,
  dependencies: PlannerV2ToolDependencies,
) => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  ok: false as const,
  error: publicError,
  meta: envelopeContext(dependencies),
});

const validEnvelope = (value: unknown): boolean =>
  validatePlannerEnvelopeV2Client(value);

const validTimestamp = (value: unknown): value is string =>
  isStrictTimestampV2(value);

const validText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;

const validHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
};

const hasAllowedKeys = (
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

const validPrice = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["kind", "minYen", "maxYen", "label"]) ||
    !["FREE", "EXACT", "RANGE"].includes(String(value.kind)) ||
    !Number.isInteger(value.minYen) ||
    !Number.isInteger(value.maxYen) ||
    (value.minYen as number) < 0 ||
    (value.maxYen as number) > 100_000 ||
    (value.minYen as number) > (value.maxYen as number) ||
    !validText(value.label, 160)
  ) {
    return false;
  }
  return value.kind === "FREE"
    ? value.minYen === 0 && value.maxYen === 0
    : value.kind === "EXACT"
      ? value.minYen === value.maxYen
      : value.minYen !== value.maxYen;
};

const validPriceProvenance = (value: unknown): boolean =>
  isRecord(value) &&
  exactKeys(value, ["kind", "sourceSummary"]) &&
  ["PUBLISHED_AMOUNT", "PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED"].includes(
    String(value.kind),
  ) &&
  validText(value.sourceSummary, 240);

const validCompactPlace = (value: unknown): boolean =>
  isRecord(value) &&
  exactKeys(value, [
    "placeId",
    "name",
    "summary",
    "category",
    "address",
    "tags",
    "officialUrl",
  ]) &&
  validId(value.placeId) &&
  validText(value.name, 120) &&
  validText(value.summary, 320) &&
  PLACE_CATEGORIES_V2.some((category) => category === value.category) &&
  validText(value.address, 240) &&
  Array.isArray(value.tags) &&
  value.tags.length <= 5 &&
  new Set(value.tags).size === value.tags.length &&
  value.tags.every(
    (tag) =>
      typeof tag === "string" &&
      PLANNER_TAGS.some((candidate) => candidate === tag),
  ) &&
  validHttpsUrl(value.officialUrl);

const validPlanStop = (value: unknown): boolean =>
  isRecord(value) &&
  exactKeys(value, [
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
  ]) &&
  Number.isInteger(value.position) &&
  (value.position as number) >= 0 &&
  (value.position as number) <= 2 &&
  validCompactPlace(value.place) &&
  validTimestamp(value.startsAt) &&
  validTimestamp(value.endsAt) &&
  Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
  validPrice(value.price) &&
  validPriceProvenance(value.priceProvenance) &&
  Number.isInteger(value.travelFromPreviousMinutes) &&
  (value.travelFromPreviousMinutes as number) >= 0 &&
  (value.travelFromPreviousMinutes as number) <= 30 &&
  Number.isInteger(value.travelFromPreviousDistanceMeters) &&
  (value.travelFromPreviousDistanceMeters as number) >= 0 &&
  (value.travelFromPreviousDistanceMeters as number) <= 5_000 &&
  validText(value.travelOriginLabel, 120) &&
  value.travelMethod === "COORDINATE_ESTIMATE" &&
  validText(value.travelLabel, 200) &&
  validText(value.openingFit, 240) &&
  validText(value.whyThisStop, 240) &&
  validText(value.sourcePublisher, 120) &&
  validTimestamp(value.sourceCheckedAt);

const reasonCodes = new Set([
  "MATCHES_INTERESTS",
  "SHORT_WALKS",
  "USES_TIME_WELL",
  "VARIED_STOPS",
  "WITHIN_BUDGET",
]);

const samePlannerIntent = (left: unknown, right: unknown): boolean => {
  if (!isRecord(left) || !isRecord(right)) return false;
  const sameArray = (one: unknown, two: unknown): boolean =>
    Array.isArray(one) &&
    Array.isArray(two) &&
    one.length === two.length &&
    one.every((value, index) => two[index] === value);
  return (
    left.schemaVersion === right.schemaVersion &&
    left.area === right.area &&
    left.partySize === right.partySize &&
    left.startAt === right.startAt &&
    left.endAt === right.endAt &&
    left.totalBudgetYen === right.totalBudgetYen &&
    left.stopCount === right.stopCount &&
    left.maxWalkMinutesPerLeg === right.maxWalkMinutesPerLeg &&
    sameArray(left.preferredTags, right.preferredTags) &&
    sameArray(left.excludedTags, right.excludedTags)
  );
};

const validPlan = (
  value: unknown,
  context: Readonly<{ clock?: () => Date; packVersion: string }>,
): boolean => {
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
    value.schemaVersion !== PLANNER_SCHEMA_VERSION ||
    !validId(value.planId) ||
    !validId(value.candidateSetId) ||
    value.packVersion !== context.packVersion ||
    !validatePlannerIntentV2Client(
      value.intent,
      (context.clock ?? (() => new Date()))(),
    ).ok ||
    !Array.isArray(value.stops) ||
    value.stops.length < 2 ||
    value.stops.length > 3 ||
    !value.stops.every(validPlanStop) ||
    !isRecord(value.totals) ||
    !exactKeys(value.totals, [
      "minPriceYen",
      "maxPriceYen",
      "totalWalkMinutes",
      "stopCount",
      "startsAt",
      "endsAt",
    ]) ||
    !Number.isInteger(value.totals.minPriceYen) ||
    !Number.isInteger(value.totals.maxPriceYen) ||
    (value.totals.minPriceYen as number) < 0 ||
    (value.totals.minPriceYen as number) >
      (value.totals.maxPriceYen as number) ||
    (value.totals.maxPriceYen as number) > 300_000 ||
    !Number.isInteger(value.totals.totalWalkMinutes) ||
    (value.totals.totalWalkMinutes as number) < 0 ||
    (value.totals.totalWalkMinutes as number) > 90 ||
    value.totals.stopCount !== value.stops.length ||
    !validTimestamp(value.totals.startsAt) ||
    !validTimestamp(value.totals.endsAt) ||
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
    value.reasonCodes.length > 4 ||
    new Set(value.reasonCodes).size !== value.reasonCodes.length ||
    !value.reasonCodes.every(
      (reason) => typeof reason === "string" && reasonCodes.has(reason),
    ) ||
    value.travelMethod !== "COORDINATE_ESTIMATE" ||
    value.disclaimer !==
      "Built from published information, not live availability. Check each official site before you go."
  ) {
    return false;
  }
  const stops = value.stops as Record<string, unknown>[];
  const placeIds = stops.map((stop) =>
    isRecord(stop.place) ? stop.place.placeId : undefined,
  );
  return (
    stops.every((stop, index) => stop.position === index) &&
    new Set(placeIds).size === stops.length &&
    value.totals.startsAt === stops[0]?.startsAt &&
    value.totals.endsAt === stops.at(-1)?.endsAt
  );
};

const validSourceUsage = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.mode !== "string") return false;
  if (value.mode === "OPEN_LICENSE") {
    return (
      exactKeys(value, ["mode", "licenseId", "licenseUrl", "attribution"]) &&
      validText(value.licenseId, 80) &&
      validHttpsUrl(value.licenseUrl) &&
      validText(value.attribution, 300)
    );
  }
  if (value.mode === "EXPLICIT_PERMISSION") {
    return (
      exactKeys(value, ["mode", "permissionEvidencePath", "attribution"]) &&
      typeof value.permissionEvidencePath === "string" &&
      /^specs\/002-source-backed-evening-planner\/evidence\/permissions\/[^/]+$/.test(
        value.permissionEvidencePath,
      ) &&
      validText(value.attribution, 300)
    );
  }
  if (value.mode === "OFFICIAL_FACT_REFERENCE") {
    const factScopes = new Set([
      "IDENTITY",
      "ADDRESS",
      "COORDINATES",
      "HOURS",
      "PRICE",
      "PUBLIC_ACCESS",
    ]);
    return (
      exactKeys(value, ["mode", "factScope", "attribution"]) &&
      Array.isArray(value.factScope) &&
      value.factScope.length >= 1 &&
      value.factScope.length <= 6 &&
      new Set(value.factScope).size === value.factScope.length &&
      value.factScope.every(
        (scope) => typeof scope === "string" && factScopes.has(scope),
      ) &&
      validText(value.attribution, 300)
    );
  }
  return value.mode === "OFFICIAL_LINK_ONLY" && exactKeys(value, ["mode"]);
};

const validSource = (value: unknown): boolean =>
  isRecord(value) &&
  hasAllowedKeys(
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
  validId(value.sourceId) &&
  validText(value.title, 160) &&
  validText(value.publisher, 120) &&
  ["OPEN_DATASET", "OFFICIAL_SITE", "LICENSE_TERMS"].includes(
    String(value.sourceKind),
  ) &&
  validHttpsUrl(value.url) &&
  validTimestamp(value.checkedAt) &&
  (value.publishedAt === undefined || validTimestamp(value.publishedAt)) &&
  (value.notes === undefined || validText(value.notes, 500)) &&
  validSourceUsage(value.usage);

const claimKinds = {
  address: "ADDRESS",
  coordinates: "COORDINATES",
  hours: "HOURS",
  identity: "IDENTITY",
  officialLink: "OFFICIAL_LINK",
  price: "PRICE",
  publicAccess: "PUBLIC_ACCESS",
} as const;

const validClaim = (value: unknown, expectedKind: string): boolean =>
  isRecord(value) &&
  exactKeys(value, [
    "kind",
    "value",
    "publisher",
    "sourceTitle",
    "sourceUrl",
    "checkedAt",
  ]) &&
  value.kind === expectedKind &&
  validText(value.value, 500) &&
  validText(value.publisher, 120) &&
  validText(value.sourceTitle, 160) &&
  validHttpsUrl(value.sourceUrl) &&
  validTimestamp(value.checkedAt);

const validEvidenceData = (
  value: unknown,
  context: Readonly<{ packVersion: string }>,
): boolean => {
  if (!isRecord(value) || !exactKeys(value, ["evidence"])) return false;
  const evidence = value.evidence;
  if (
    !isRecord(evidence) ||
    !exactKeys(evidence, [
      "schemaVersion",
      "packVersion",
      "placeId",
      "placeName",
      "officialUrl",
      "evidenceAsOf",
      "claims",
      "sources",
    ]) ||
    evidence.schemaVersion !== PLANNER_SCHEMA_VERSION ||
    evidence.packVersion !== context.packVersion ||
    !validId(evidence.placeId) ||
    !validText(evidence.placeName, 120) ||
    !validHttpsUrl(evidence.officialUrl) ||
    !validTimestamp(evidence.evidenceAsOf) ||
    !isRecord(evidence.claims) ||
    !exactKeys(evidence.claims, Object.keys(claimKinds)) ||
    !Array.isArray(evidence.sources) ||
    evidence.sources.length < 1 ||
    evidence.sources.length > 100 ||
    !evidence.sources.every(validSource)
  ) {
    return false;
  }
  const claims = evidence.claims;
  const sourceKeys = new Set(
    evidence.sources.map((source) =>
      isRecord(source)
        ? `${String(source.url)}\u0000${String(source.publisher)}\u0000${String(source.title)}\u0000${String(source.checkedAt)}`
        : "",
    ),
  );
  return Object.entries(claimKinds).every(([key, kind]) => {
    const claim = claims[key];
    if (key === "coordinates" && claim === null) return true;
    return (
      validClaim(claim, kind) &&
      isRecord(claim) &&
      sourceKeys.has(
        `${String(claim.sourceUrl)}\u0000${String(claim.publisher)}\u0000${String(claim.sourceTitle)}\u0000${String(claim.checkedAt)}`,
      )
    );
  });
};

const validSuccessData = (
  name: PlannerV2ToolName,
  value: unknown,
  context: Readonly<{ clock?: () => Date; packVersion: string }>,
  input: PlannerV2ToolInput,
): boolean => {
  if (!isRecord(value)) return false;
  if (name === "find_evening_plan") {
    return (
      exactKeys(value, ["candidateSetId", "plan", "warnings"]) &&
      validId(value.candidateSetId) &&
      validPlan(value.plan, context) &&
      isRecord(value.plan) &&
      value.candidateSetId === value.plan.candidateSetId &&
      samePlannerIntent(value.plan.intent, input) &&
      Array.isArray(value.warnings) &&
      value.warnings.length <= 30 &&
      value.warnings.every((warning) => validText(warning, 240))
    );
  }
  if (name === "show_place_evidence") {
    return (
      validEvidenceData(value, context) &&
      "placeId" in input &&
      isRecord(value.evidence) &&
      value.evidence.placeId === input.placeId
    );
  }
  if (name === "swap_plan_stop") {
    return (
      exactKeys(value, [
        "candidateSetId",
        "plan",
        "replacedStopIndex",
        "preference",
        "warnings",
      ]) &&
      validId(value.candidateSetId) &&
      validPlan(value.plan, context) &&
      isRecord(value.plan) &&
      value.candidateSetId === value.plan.candidateSetId &&
      Number.isInteger(value.replacedStopIndex) &&
      (value.replacedStopIndex as number) >= 0 &&
      Array.isArray(value.plan.stops) &&
      (value.replacedStopIndex as number) < value.plan.stops.length &&
      SWAP_PREFERENCES.some((preference) => preference === value.preference) &&
      "candidateSetId" in input &&
      value.candidateSetId === input.candidateSetId &&
      "preference" in input &&
      value.preference === input.preference &&
      Array.isArray(value.warnings) &&
      value.warnings.length <= 30 &&
      value.warnings.every((warning) => validText(warning, 240))
    );
  }
  if (name === "save_plan") {
    return (
      exactKeys(value, ["savedAt", "savedPlanId", "status"]) &&
      validTimestamp(value.savedAt) &&
      validId(value.savedPlanId) &&
      ["SAVED", "ALREADY_SAVED"].includes(String(value.status)) &&
      "planId" in input &&
      value.savedPlanId === input.planId
    );
  }
  return (
    exactKeys(value, ["deleted", "savedPlanId"]) &&
    typeof value.deleted === "boolean" &&
    validId(value.savedPlanId) &&
    "planId" in input &&
    value.savedPlanId === input.planId
  );
};

export const validatePlannerV2SearchData = (
  value: unknown,
  intent: PlannerIntentV2,
  packVersion: string,
  now = new Date(),
): value is SearchPlansDataV2 =>
  assertPublicPayloadSafe(value).ok &&
  validSuccessData(
    "find_evening_plan",
    value,
    { clock: () => now, packVersion },
    intent,
  );

export const validatePlannerV2EvidenceData = (
  value: unknown,
  placeId: string,
  packVersion: string,
): value is PlaceEvidenceDataV2 =>
  assertPublicPayloadSafe(value).ok &&
  validEvidenceData(value, { packVersion }) &&
  isRecord(value) &&
  isRecord(value.evidence) &&
  value.evidence.placeId === placeId;

export const validatePlannerV2SwapData = (
  value: unknown,
  input: SwapPlanStopToolInputV2,
  packVersion: string,
  now = new Date(),
): value is SwapPlanDataV2 =>
  assertPublicPayloadSafe(value).ok &&
  validSuccessData(
    "swap_plan_stop",
    value,
    { clock: () => now, packVersion },
    input,
  );

const validToolResult = (
  name: PlannerV2ToolName,
  value: unknown,
  dependencies: PlannerV2ToolDependencies,
  input: PlannerV2ToolInput,
): boolean => {
  if (
    !validEnvelope(value) ||
    !isRecord(value) ||
    typeof value.ok !== "boolean"
  ) {
    return false;
  }
  const envelopeKeys = value.ok
    ? ["schemaVersion", "ok", "data", "meta"]
    : ["schemaVersion", "ok", "error", "meta"];
  if (!exactKeys(value, envelopeKeys) || !isRecord(value.meta)) return false;
  if (
    !exactKeys(value.meta, [
      "correlationId",
      "origin",
      "completedAt",
      "packVersion",
    ]) ||
    value.meta.packVersion !== dependencies.packVersion
  ) {
    return false;
  }
  if (!value.ok) {
    return (
      isRecord(value.error) &&
      exactKeys(value.error, ["code", "message", "retryable"])
    );
  }
  return validSuccessData(name, value.data, dependencies, input);
};

const serializeResult = (
  name: PlannerV2ToolName,
  input: PlannerV2ToolInput,
  value: unknown,
  dependencies: PlannerV2ToolDependencies,
): string => {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    parsed = undefined;
  }
  if (
    validToolResult(name, parsed, dependencies, input) &&
    assertPublicPayloadSafe(parsed).ok
  ) {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (new TextEncoder().encode(serialized).byteLength <= 65_536) {
      return serialized;
    }
  }
  return JSON.stringify(
    failureEnvelope(
      error(
        "INTERNAL_ERROR",
        "The planner could not return a safe tool result.",
        true,
      ),
      dependencies,
    ),
  );
};

const isAbortError = (value: unknown, signal?: AbortSignal): boolean =>
  signal?.aborted === true ||
  (value instanceof Error &&
    (value.name === "AbortError" || /abort/i.test(value.message)));

type DefinitionOptions<TInput extends PlannerV2ToolInput> = {
  action: PlannerV2ToolAction<TInput>;
  annotations: NonNullable<ToolDefinition["annotations"]>;
  description: string;
  inputSchema: ToolDefinition["inputSchema"];
  name: PlannerV2ToolName;
  title: string;
};

const createDefinition = <TInput extends PlannerV2ToolInput>(
  options: DefinitionOptions<TInput>,
  dependencies: PlannerV2ToolDependencies,
): ToolDefinition => ({
  annotations: options.annotations,
  description: options.description,
  async execute(input, execution) {
    const validInput =
      options.name === "find_evening_plan"
        ? validatePlannerIntentV2Client(
            input,
            (dependencies.clock ?? (() => new Date()))(),
          ).ok
        : inputValidators[options.name](input);
    if (!validInput) {
      const code =
        isRecord(input) &&
        "schemaVersion" in input &&
        input.schemaVersion !== PLANNER_SCHEMA_VERSION
          ? "UNSUPPORTED_SCHEMA_VERSION"
          : "VALIDATION_ERROR";
      return JSON.stringify(
        failureEnvelope(
          error(code, "The request did not match the planner contract."),
          dependencies,
        ),
      );
    }

    const typedInput = input as TInput;
    if (execution?.signal?.aborted) {
      return JSON.stringify(
        failureEnvelope(
          error("CANCELLED", "The planner tool request was cancelled.", true),
          dependencies,
        ),
      );
    }
    let state: PlannerV2ToolStateCheck;
    try {
      state = dependencies.checkState(options.name, typedInput);
    } catch {
      state = {
        ok: false,
        error: error(
          "INTERNAL_ERROR",
          "The planner state could not be verified safely.",
          true,
        ),
      };
    }
    if (!state.ok) {
      const stateEnvelope = failureEnvelope(state.error, dependencies);
      const exactStateError =
        isRecord(state.error) &&
        exactKeys(state.error, ["code", "message", "retryable"]);
      const safeStateError =
        exactStateError &&
        validatePlannerEnvelopeV2Client(stateEnvelope) &&
        assertPublicPayloadSafe(state.error).ok
          ? state.error
          : error(
              "INTERNAL_ERROR",
              "The planner state could not be verified safely.",
              true,
            );
      return JSON.stringify(failureEnvelope(safeStateError, dependencies));
    }

    try {
      const result = await options.action(
        typedInput,
        "site-tool",
        execution?.signal,
      );
      return serializeResult(options.name, typedInput, result, dependencies);
    } catch (cause) {
      return JSON.stringify(
        failureEnvelope(
          isAbortError(cause, execution?.signal)
            ? error(
                "CANCELLED",
                "The planner tool request was cancelled.",
                true,
              )
            : error(
                "INTERNAL_ERROR",
                "The planner tool request could not be completed.",
                true,
              ),
          dependencies,
        ),
      );
    }
  },
  inputSchema: options.inputSchema,
  name: options.name,
  title: options.title,
});

const readOnlyAnnotations = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

const mutationAnnotations = {
  readOnlyHint: false,
  untrustedContentHint: true,
} as const;

export const createPlannerV2ToolDefinitions = (
  dependencies: PlannerV2ToolDependencies,
): readonly [
  ToolDefinition,
  ToolDefinition,
  ToolDefinition,
  ToolDefinition,
  ToolDefinition,
] => [
  createDefinition(
    {
      action: dependencies.find,
      annotations: readOnlyAnnotations,
      description:
        "Build one feasible Shibuya plan while enforcing the requested time window, total reference budget, preferred and excluded interests, and maximum walking per leg. Only source-eligible places with published schedulable windows and published reference amounts may appear; a place with no set hours or an unknown mandatory amount is excluded. Verified demo example: 13:00–22:00, up to ¥8,000, prefer art, hands-on, lively, or quiet, exclude alcohol and smoking, and keep each walk within 20 minutes. This does not check live availability or make a reservation.",
      inputSchema: findEveningPlanToolInputSchema,
      name: "find_evening_plan",
      title: "Find an evening plan",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.showEvidence,
      annotations: readOnlyAnnotations,
      description:
        "Show field-level identity, address, coordinates, opening-window, published reference-price, and official-link evidence for one place in the current plan, including publisher, comparison date, and source link.",
      inputSchema: showPlaceEvidenceToolInputSchema,
      name: "show_place_evidence",
      title: "Show place evidence",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.swap,
      annotations: readOnlyAnnotations,
      description:
        "Replace one stop with a cheaper, shorter-walk, or different-interest option while preserving every other stop and rechecking time, total budget, walking, interest, exclusion, and published-window constraints. This does not reserve anything.",
      inputSchema: swapPlanStopToolInputSchema,
      name: "swap_plan_stop",
      title: "Swap one plan stop",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.save,
      annotations: mutationAnnotations,
      description:
        "Save the currently displayed immutable plan snapshot in this browser only. No account or server record is created.",
      inputSchema: savePlanToolInputSchema,
      name: "save_plan",
      title: "Save this plan",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.deleteSaved,
      annotations: mutationAnnotations,
      description:
        "Delete one saved plan from this browser. Deleting an already absent plan is safe and returns deleted false.",
      inputSchema: deleteSavedPlanToolInputSchema,
      name: "delete_saved_plan",
      title: "Delete a saved plan",
    },
    dependencies,
  ),
];

export const registerPlannerV2Tools = (
  dependencies: PlannerV2ToolDependencies,
  source: Document = document,
): { dispose(): void; ready: Promise<void> } => {
  const handles: RegistrationHandle[] = [];
  try {
    for (const definition of createPlannerV2ToolDefinitions(dependencies)) {
      handles.push(registerTool(definition, {}, source));
    }
  } catch (cause) {
    for (const handle of handles) handle.dispose();
    throw cause;
  }
  return {
    dispose() {
      for (const handle of handles) handle.dispose();
    },
    ready: Promise.all(handles.map(({ ready }) => ready)).then(() => undefined),
  };
};

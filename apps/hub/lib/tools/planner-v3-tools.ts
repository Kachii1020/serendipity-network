import type {
  PlaceEvidenceDataV3,
  PlannerAreaV3,
  PlannerEnvelopeV3,
  PlannerIntentV3,
  PlannerPublicErrorV3,
  SearchPlansDataV3,
  SwapPlanDataV3,
} from "@serendipity/contracts/planner-v3";
import { validateEveningPlanV3 } from "@serendipity/contracts/planner-v3";
import {
  PLANNER_V3_AREAS,
  PLANNER_V3_SCHEMA_VERSION,
  SWAP_PREFERENCES_V3,
  isHttpsUrlV3,
  isStrictTimestampV3,
  isValidPlannerIdV3,
  plannerIntentV3ClientSchema,
  validatePlannerEnvelopeV3Client,
  validatePlannerIntentV3Client,
} from "@serendipity/contracts/planner-v3-shared";
import { assertPublicPayloadSafe } from "@serendipity/contracts/public-safety";
import {
  registerTool,
  type RegistrationHandle,
  type ToolDefinition,
} from "@serendipity/webmcp";

export const PLANNER_V3_TOOL_NAMES = [
  "find_evening_plan",
  "show_place_evidence",
  "swap_plan_stop",
  "save_plan",
  "delete_saved_plan",
] as const;

export type PlannerV3ToolName = (typeof PLANNER_V3_TOOL_NAMES)[number];
export type PlannerV3ToolTransport = "site-tool";

type PlanReferenceV3 = Readonly<{
  schemaVersion: "3";
  candidateSetId: string;
  planId: string;
}>;

export type ShowPlaceEvidenceToolInputV3 = PlanReferenceV3 &
  Readonly<{ area: PlannerAreaV3; placeId: string }>;
export type SwapPlanStopToolInputV3 = PlanReferenceV3 &
  Readonly<{
    targetPlaceId: string;
    preference: (typeof SWAP_PREFERENCES_V3)[number];
  }>;
export type SavePlanToolInputV3 = PlanReferenceV3;
export type DeleteSavedPlanToolInputV3 = Readonly<{
  schemaVersion: "3";
  planId: string;
}>;
export type PlannerV3ToolInput =
  | PlannerIntentV3
  | ShowPlaceEvidenceToolInputV3
  | SwapPlanStopToolInputV3
  | SavePlanToolInputV3
  | DeleteSavedPlanToolInputV3;

export type PlannerV3ToolStateCheck =
  Readonly<{ ok: true }> | Readonly<{ ok: false; error: PlannerPublicErrorV3 }>;

type ToolResult = PlannerEnvelopeV3<unknown> | string;
type ToolAction<TInput extends PlannerV3ToolInput> = (
  input: TInput,
  transport: PlannerV3ToolTransport,
  signal?: AbortSignal,
) => ToolResult | Promise<ToolResult>;

export type PlannerV3ToolDependencies = Readonly<{
  checkState(
    name: PlannerV3ToolName,
    input: PlannerV3ToolInput,
  ): PlannerV3ToolStateCheck;
  clock?: () => Date;
  context(): Readonly<{
    area: PlannerAreaV3 | null;
    packVersion: string | null;
  }>;
  correlationId?: () => string;
  deleteSaved: ToolAction<DeleteSavedPlanToolInputV3>;
  find: ToolAction<PlannerIntentV3>;
  hubOrigin: string;
  save: ToolAction<SavePlanToolInputV3>;
  showEvidence: ToolAction<ShowPlaceEvidenceToolInputV3>;
  swap: ToolAction<SwapPlanStopToolInputV3>;
}>;

const idSchema = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
} as const;
const referenceProperties = {
  schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
  candidateSetId: idSchema,
  planId: idSchema,
} as const;

export const findEveningPlanToolInputV3Schema = plannerIntentV3ClientSchema;
export const showPlaceEvidenceToolInputV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "area", "candidateSetId", "planId", "placeId"],
  properties: {
    ...referenceProperties,
    area: { enum: PLANNER_V3_AREAS },
    placeId: idSchema,
  },
} as const;
export const swapPlanStopToolInputV3Schema = {
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
    preference: { enum: SWAP_PREFERENCES_V3 },
  },
} as const;
export const savePlanToolInputV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "candidateSetId", "planId"],
  properties: referenceProperties,
} as const;
export const deleteSavedPlanToolInputV3Schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "planId"],
  properties: {
    schemaVersion: { const: PLANNER_V3_SCHEMA_VERSION },
    planId: idSchema,
  },
} as const;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exact = (
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
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const isArea = (value: unknown): value is PlannerAreaV3 =>
  PLANNER_V3_AREAS.some((area) => area === value);

const referenceInput = (
  value: unknown,
  extras: readonly string[] = [],
): value is Record<string, unknown> =>
  record(value) &&
  exact(value, ["schemaVersion", "candidateSetId", "planId", ...extras]) &&
  value.schemaVersion === "3" &&
  isValidPlannerIdV3(value.candidateSetId) &&
  isValidPlannerIdV3(value.planId);

const inputValidators: Record<
  PlannerV3ToolName,
  (value: unknown, now: Date) => boolean
> = {
  find_evening_plan: (value, now) =>
    validatePlannerIntentV3Client(value, now).ok,
  show_place_evidence: (value) =>
    referenceInput(value, ["area", "placeId"]) &&
    PLANNER_V3_AREAS.some((area) => area === value.area) &&
    isValidPlannerIdV3(value.placeId),
  swap_plan_stop: (value) =>
    referenceInput(value, ["targetPlaceId", "preference"]) &&
    isValidPlannerIdV3(value.targetPlaceId) &&
    SWAP_PREFERENCES_V3.some((preference) => preference === value.preference),
  save_plan: (value) => referenceInput(value),
  delete_saved_plan: (value) =>
    record(value) &&
    exact(value, ["schemaVersion", "planId"]) &&
    value.schemaVersion === "3" &&
    isValidPlannerIdV3(value.planId),
};

const validGoogleSignal = (value: unknown): boolean =>
  record(value) &&
  exact(value, [
    "placeId",
    "googlePlaceId",
    "businessStatus",
    "openNow",
    "priceLevel",
    "priceRangeLabel",
    "googleMapsUri",
    "attributions",
  ]) &&
  isValidPlannerIdV3(value.placeId) &&
  isValidPlannerIdV3(value.googlePlaceId) &&
  [
    "OPERATIONAL",
    "CLOSED_TEMPORARILY",
    "CLOSED_PERMANENTLY",
    "UNKNOWN",
  ].includes(String(value.businessStatus)) &&
  (typeof value.openNow === "boolean" || value.openNow === null) &&
  (value.priceLevel === null || text(value.priceLevel, 80)) &&
  (value.priceRangeLabel === null || text(value.priceRangeLabel, 120)) &&
  (value.googleMapsUri === null || isHttpsUrlV3(value.googleMapsUri)) &&
  Array.isArray(value.attributions) &&
  value.attributions.length <= 10 &&
  value.attributions.every(
    (attribution) =>
      record(attribution) &&
      exact(attribution, ["provider", "uri"]) &&
      text(attribution.provider, 120) &&
      (attribution.uri === null || isHttpsUrlV3(attribution.uri)),
  );

const validSearchData = (
  value: unknown,
  input: PlannerV3ToolInput,
): boolean => {
  if (
    !record(value) ||
    !exact(value, ["candidateSetId", "plan", "warnings", "googleSignals"]) ||
    !isValidPlannerIdV3(value.candidateSetId) ||
    !record(value.plan) ||
    !validateEveningPlanV3(value.plan).ok ||
    value.plan.candidateSetId !== value.candidateSetId ||
    !("area" in input) ||
    !record(value.plan.intent) ||
    value.plan.intent.area !== input.area ||
    !Array.isArray(value.warnings) ||
    value.warnings.length > 30 ||
    !value.warnings.every((warning) => text(warning, 240)) ||
    !Array.isArray(value.googleSignals) ||
    value.googleSignals.length > 3
  ) {
    return false;
  }
  const plan = value.plan;
  return value.googleSignals.every(
    (candidate) =>
      validGoogleSignal(candidate) &&
      record(candidate) &&
      Array.isArray(plan.stops) &&
      plan.stops.some(
        (stop) =>
          record(stop) &&
          record(stop.place) &&
          stop.place.placeId === candidate.placeId &&
          stop.place.googlePlaceId === candidate.googlePlaceId,
      ),
  );
};

const validEvidenceClaim = (value: unknown, kind: string): boolean =>
  record(value) &&
  exact(value, [
    "kind",
    "value",
    "publisher",
    "sourceTitle",
    "sourceUrl",
    "checkedAt",
  ]) &&
  value.kind === kind &&
  text(value.value, 500) &&
  text(value.publisher, 120) &&
  text(value.sourceTitle, 160) &&
  isHttpsUrlV3(value.sourceUrl) &&
  isStrictTimestampV3(value.checkedAt);

const claimKinds = {
  address: "ADDRESS",
  coordinates: "COORDINATES",
  hours: "HOURS",
  identity: "IDENTITY",
  officialLink: "OFFICIAL_LINK",
  price: "PRICE",
  publicAccess: "PUBLIC_ACCESS",
  menu: "MENU",
} as const;

const validEvidenceData = (
  value: unknown,
  input: PlannerV3ToolInput,
): boolean => {
  if (
    !record(value) ||
    !exact(value, ["evidence", "googleSignal"]) ||
    !record(value.evidence) ||
    !exact(value.evidence, [
      "schemaVersion",
      "packVersion",
      "area",
      "placeId",
      "placeName",
      "officialUrl",
      "evidenceAsOf",
      "claims",
      "sources",
    ]) ||
    value.evidence.schemaVersion !== "3" ||
    !("area" in input) ||
    value.evidence.area !== input.area ||
    !("placeId" in input) ||
    value.evidence.placeId !== input.placeId ||
    !isValidPlannerIdV3(value.evidence.placeId) ||
    !text(value.evidence.placeName, 120) ||
    !isHttpsUrlV3(value.evidence.officialUrl) ||
    !isStrictTimestampV3(value.evidence.evidenceAsOf) ||
    !record(value.evidence.claims) ||
    !exact(value.evidence.claims, Object.keys(claimKinds)) ||
    !Array.isArray(value.evidence.sources) ||
    value.evidence.sources.length < 1 ||
    value.evidence.sources.length > 100 ||
    !(value.googleSignal === null || validGoogleSignal(value.googleSignal))
  ) {
    return false;
  }
  const evidence = value.evidence;
  const claims = evidence.claims as Record<string, unknown>;
  return Object.entries(claimKinds).every(([key, kind]) => {
    const claim = claims[key];
    return key === "menu" && claim === null
      ? true
      : validEvidenceClaim(claim, kind);
  });
};

const validSwapData = (value: unknown, input: PlannerV3ToolInput): boolean => {
  if (
    !record(value) ||
    !exact(value, [
      "candidateSetId",
      "plan",
      "replacedStopIndex",
      "preference",
      "warnings",
      "googleSignals",
    ]) ||
    !isValidPlannerIdV3(value.candidateSetId) ||
    !record(value.plan) ||
    !validateEveningPlanV3(value.plan).ok ||
    value.plan.candidateSetId !== value.candidateSetId ||
    !Number.isInteger(value.replacedStopIndex) ||
    (value.replacedStopIndex as number) < 0 ||
    (value.replacedStopIndex as number) > 2 ||
    !("preference" in input) ||
    value.preference !== input.preference ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => text(warning, 240)) ||
    !Array.isArray(value.googleSignals) ||
    value.googleSignals.length > 3
  ) {
    return false;
  }
  const plan = value.plan;
  return value.googleSignals.every(
    (candidate) =>
      validGoogleSignal(candidate) &&
      record(candidate) &&
      Array.isArray(plan.stops) &&
      plan.stops.some(
        (stop) =>
          record(stop) &&
          record(stop.place) &&
          stop.place.placeId === candidate.placeId &&
          stop.place.googlePlaceId === candidate.googlePlaceId,
      ),
  );
};

const validSuccessData = (
  name: PlannerV3ToolName,
  value: unknown,
  input: PlannerV3ToolInput,
): boolean => {
  if (!assertPublicPayloadSafe(value).ok) return false;
  if (name === "find_evening_plan") return validSearchData(value, input);
  if (name === "show_place_evidence") return validEvidenceData(value, input);
  if (name === "swap_plan_stop") return validSwapData(value, input);
  if (name === "save_plan") {
    return (
      record(value) &&
      exact(value, ["savedPlanId", "savedAt", "status"]) &&
      "planId" in input &&
      value.savedPlanId === input.planId &&
      isStrictTimestampV3(value.savedAt) &&
      ["SAVED", "ALREADY_SAVED"].includes(String(value.status))
    );
  }
  return (
    record(value) &&
    exact(value, ["savedPlanId", "deleted"]) &&
    "planId" in input &&
    value.savedPlanId === input.planId &&
    typeof value.deleted === "boolean"
  );
};

export const validatePlannerV3SearchData = (
  value: unknown,
  intent: PlannerIntentV3,
  area: PlannerAreaV3,
  packVersion: string,
): value is SearchPlansDataV3 =>
  assertPublicPayloadSafe(value).ok &&
  validSearchData(value, intent) &&
  record(value) &&
  record(value.plan) &&
  value.plan.packVersion === packVersion &&
  record(value.plan.intent) &&
  value.plan.intent.area === area &&
  JSON.stringify(value.plan.intent) === JSON.stringify(intent);

export const validatePlannerV3SwapData = (
  value: unknown,
  input: SwapPlanStopToolInputV3,
  area: PlannerAreaV3,
  packVersion: string,
): value is SwapPlanDataV3 =>
  assertPublicPayloadSafe(value).ok &&
  validSwapData(value, input) &&
  record(value) &&
  record(value.plan) &&
  value.plan.packVersion === packVersion &&
  record(value.plan.intent) &&
  value.plan.intent.area === area;

export const validatePlannerV3EvidenceData = (
  value: unknown,
  area: PlannerAreaV3,
  placeId: string,
  packVersion: string,
): value is PlaceEvidenceDataV3 => {
  const input: ShowPlaceEvidenceToolInputV3 = {
    schemaVersion: "3",
    area,
    candidateSetId: "validation-candidate",
    planId: "validation-plan",
    placeId,
  };
  return (
    assertPublicPayloadSafe(value).ok &&
    validEvidenceData(value, input) &&
    record(value) &&
    record(value.evidence) &&
    value.evidence.packVersion === packVersion
  );
};

const validToolSuccessData = (
  name: PlannerV3ToolName,
  value: unknown,
  input: PlannerV3ToolInput,
  envelope: Record<string, unknown>,
): boolean => {
  if (!record(envelope.meta)) return false;
  const area = envelope.meta.area;
  const packVersion = envelope.meta.packVersion;
  if (name === "find_evening_plan") {
    const intent = input as PlannerIntentV3;
    return (
      isArea(area) &&
      typeof packVersion === "string" &&
      validatePlannerV3SearchData(value, intent, area, packVersion)
    );
  }
  if (name === "show_place_evidence") {
    const evidenceInput = input as ShowPlaceEvidenceToolInputV3;
    return (
      area === evidenceInput.area &&
      typeof packVersion === "string" &&
      validatePlannerV3EvidenceData(
        value,
        evidenceInput.area,
        evidenceInput.placeId,
        packVersion,
      )
    );
  }
  if (name === "swap_plan_stop") {
    const swapInput = input as SwapPlanStopToolInputV3;
    return (
      isArea(area) &&
      typeof packVersion === "string" &&
      validatePlannerV3SwapData(value, swapInput, area, packVersion)
    );
  }
  return validSuccessData(name, value, input);
};

const exactOrigin = (value: string): string => {
  const parsed = new URL(value);
  const local =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !local) throw new Error("Unsafe origin");
  return parsed.origin;
};

const failureEnvelope = (
  publicError: PlannerPublicErrorV3,
  dependencies: PlannerV3ToolDependencies,
): PlannerEnvelopeV3<never> => {
  const context = dependencies.context();
  return {
    schemaVersion: "3",
    ok: false,
    error: publicError,
    meta: {
      correlationId:
        dependencies.correlationId?.() ?? globalThis.crypto.randomUUID(),
      origin: exactOrigin(dependencies.hubOrigin),
      completedAt: (dependencies.clock ?? (() => new Date()))().toISOString(),
      packVersion: context.packVersion,
      area: context.area,
    },
  };
};

const serialize = (
  value: unknown,
  name: PlannerV3ToolName,
  input: PlannerV3ToolInput,
  dependencies: PlannerV3ToolDependencies,
): string => {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    parsed = null;
  }
  if (
    validatePlannerEnvelopeV3Client(parsed) &&
    assertPublicPayloadSafe(parsed).ok &&
    record(parsed) &&
    (parsed.ok === false ||
      validToolSuccessData(name, parsed.data, input, parsed))
  ) {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (new TextEncoder().encode(serialized).byteLength <= 65_536) {
      return serialized;
    }
  }
  return JSON.stringify(
    failureEnvelope(
      {
        code: "INTERNAL_ERROR",
        message: "The planner could not return a safe tool result.",
        retryable: true,
      },
      dependencies,
    ),
  );
};

const abortError = (cause: unknown, signal?: AbortSignal): boolean =>
  signal?.aborted === true ||
  (cause instanceof Error && cause.name === "AbortError");

type Definition<TInput extends PlannerV3ToolInput> = Readonly<{
  action: ToolAction<TInput>;
  annotations: NonNullable<ToolDefinition["annotations"]>;
  description: string;
  inputSchema: ToolDefinition["inputSchema"];
  name: PlannerV3ToolName;
  title: string;
}>;

const createDefinition = <TInput extends PlannerV3ToolInput>(
  definition: Definition<TInput>,
  dependencies: PlannerV3ToolDependencies,
): ToolDefinition => ({
  annotations: definition.annotations,
  description: definition.description,
  inputSchema: definition.inputSchema,
  name: definition.name,
  title: definition.title,
  async execute(input, options) {
    const now = (dependencies.clock ?? (() => new Date()))();
    if (!inputValidators[definition.name](input, now)) {
      return JSON.stringify(
        failureEnvelope(
          {
            code:
              record(input) &&
              "schemaVersion" in input &&
              input.schemaVersion !== "3"
                ? "UNSUPPORTED_SCHEMA_VERSION"
                : "VALIDATION_ERROR",
            message: "The request did not match the planner v3 contract.",
            retryable: false,
          },
          dependencies,
        ),
      );
    }
    const typed = input as TInput;
    let state: PlannerV3ToolStateCheck;
    try {
      state = dependencies.checkState(definition.name, typed);
    } catch {
      state = {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The planner state could not be verified safely.",
          retryable: true,
        },
      };
    }
    if (!state.ok) {
      return serialize(
        failureEnvelope(state.error, dependencies),
        definition.name,
        typed,
        dependencies,
      );
    }
    try {
      const result = await definition.action(
        typed,
        "site-tool",
        options?.signal,
      );
      return serialize(result, definition.name, typed, dependencies);
    } catch (cause) {
      return JSON.stringify(
        failureEnvelope(
          {
            code: abortError(cause, options?.signal)
              ? "CANCELLED"
              : "INTERNAL_ERROR",
            message: abortError(cause, options?.signal)
              ? "The planner tool request was cancelled."
              : "The planner tool request could not be completed.",
            retryable: true,
          },
          dependencies,
        ),
      );
    }
  },
});

const readOnly = { readOnlyHint: true, untrustedContentHint: true } as const;
const mutation = { readOnlyHint: false, untrustedContentHint: true } as const;

export const createPlannerV3ToolDefinitions = (
  dependencies: PlannerV3ToolDependencies,
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
      annotations: readOnly,
      description:
        "Build one source-backed Tokyo evening plan for the selected hub, party, time, per-person budget, meal setting, interest preset, walking cap, and exclusions. Optional Google Maps context never controls official feasibility.",
      inputSchema: findEveningPlanToolInputV3Schema,
      name: "find_evening_plan",
      title: "Find a Tokyo evening plan",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.showEvidence,
      annotations: readOnly,
      description:
        "Open the current stop's official identity, address, coordinate, hours, price, access, link, and menu evidence with separately labelled transient Google context.",
      inputSchema: showPlaceEvidenceToolInputV3Schema,
      name: "show_place_evidence",
      title: "Show place evidence",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.swap,
      annotations: readOnly,
      description:
        "Replace one stop with the same stop kind while preserving all other stops and rechecking time, official per-person budget, group estimate, walking, meal grammar, preset, and exclusions.",
      inputSchema: swapPlanStopToolInputV3Schema,
      name: "swap_plan_stop",
      title: "Change one stop",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.save,
      annotations: mutation,
      description:
        "Save the current sanitized official plan and evidence snapshot in this browser only. Transient Google content is not persisted.",
      inputSchema: savePlanToolInputV3Schema,
      name: "save_plan",
      title: "Save this plan",
    },
    dependencies,
  ),
  createDefinition(
    {
      action: dependencies.deleteSaved,
      annotations: mutation,
      description:
        "Delete one saved browser snapshot idempotently without changing an external place or booking.",
      inputSchema: deleteSavedPlanToolInputV3Schema,
      name: "delete_saved_plan",
      title: "Delete a saved plan",
    },
    dependencies,
  ),
];

export const registerPlannerV3Tools = (
  dependencies: PlannerV3ToolDependencies,
  source: Document = document,
): { dispose(): void; ready: Promise<void> } => {
  const handles: RegistrationHandle[] = [];
  const dispose = () => {
    for (const handle of handles) handle.dispose();
  };
  try {
    for (const definition of createPlannerV3ToolDefinitions(dependencies)) {
      handles.push(registerTool(definition, {}, source));
    }
  } catch (cause) {
    dispose();
    throw cause;
  }
  return {
    dispose,
    ready: Promise.all(handles.map(({ ready }) => ready))
      .then(() => undefined)
      .catch((cause: unknown) => {
        dispose();
        throw cause;
      }),
  };
};

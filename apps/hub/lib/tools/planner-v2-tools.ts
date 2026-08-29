import {
  type PlannerEnvelopeV2,
  type PlannerIntentV2,
  type PlannerPublicErrorV2,
} from "@serendipity/contracts/planner-v2";
import {
  PLANNER_SCHEMA_VERSION,
  SWAP_PREFERENCES,
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

const serializeResult = (
  value: unknown,
  dependencies: PlannerV2ToolDependencies,
): string => {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    parsed = undefined;
  }
  if (validEnvelope(parsed) && assertPublicPayloadSafe(parsed).ok) {
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
      const safeStateError =
        validatePlannerEnvelopeV2Client(stateEnvelope) &&
        assertPublicPayloadSafe(stateEnvelope).ok
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
      return serializeResult(result, dependencies);
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
        "Build one feasible Shibuya evening plan from published place, hours, reference price, and coordinate data. This does not check live availability or make a reservation.",
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
        "Show the publisher, checked date, source link, and evidence behind one place in the current plan.",
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
        "Replace one stop in the current plan with a cheaper, shorter-walk, or different-interest option while preserving the other stops. This does not reserve anything.",
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
  const handles: RegistrationHandle[] = createPlannerV2ToolDefinitions(
    dependencies,
  ).map((definition) => registerTool(definition, {}, source));
  return {
    dispose() {
      for (const handle of handles) handle.dispose();
    },
    ready: Promise.all(handles.map(({ ready }) => ready)).then(() => undefined),
  };
};

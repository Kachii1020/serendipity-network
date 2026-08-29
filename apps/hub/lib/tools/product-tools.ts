import {
  assertPublicPayloadSafe,
  confirmBundleInputSchema,
  contractValidators,
  enforceResultSize,
  findOptionsInputSchema,
  holdBundleInputSchema,
  releaseBundleInputSchema,
  showBundleInputSchema,
  type ConfirmBundleInput,
  type FindOptionsInput,
  type HoldBundleInput,
  type PublicError,
  type ReleaseBundleInput,
  type ShowBundleInput,
} from "@serendipity/contracts";
import {
  registerTool,
  type RegistrationHandle,
  type ToolDefinition,
} from "@serendipity/webmcp";

import {
  createHubFailureEnvelope,
  type HubEnvelopeContext,
} from "../hub-envelope";

export const PRODUCT_TOOL_NAMES = [
  "find_serendipity_options",
  "show_bundle",
  "hold_bundle",
  "confirm_bundle",
  "release_bundle",
] as const;

export type ProductToolName = (typeof PRODUCT_TOOL_NAMES)[number];

export type ProductToolInput =
  ConfirmBundleInput | FindOptionsInput | ReleaseBundleInput | ShowBundleInput;

export type ProductToolStateCheck =
  { readonly ok: true } | { readonly error: PublicError; readonly ok: false };

type ProductToolAction<TInput extends ProductToolInput> = (
  input: TInput,
  signal?: AbortSignal,
) => unknown;

export type ProductToolDependencies = {
  checkState?: (
    name: ProductToolName,
    input: ProductToolInput,
  ) => ProductToolStateCheck;
  clock?: () => Date;
  confirmBundle: ProductToolAction<ConfirmBundleInput>;
  correlationId?: () => string;
  findOptions: ProductToolAction<FindOptionsInput>;
  holdBundle: ProductToolAction<HoldBundleInput>;
  hubOrigin: string;
  releaseBundle: ProductToolAction<ReleaseBundleInput>;
  showBundle: ProductToolAction<ShowBundleInput>;
};

type RuntimeDefinition<TInput extends ProductToolInput> = {
  action: ProductToolAction<TInput>;
  annotations: NonNullable<ToolDefinition["annotations"]>;
  dataValidator: (value: unknown) => boolean;
  description: string;
  inputSchema: ToolDefinition["inputSchema"];
  inputValidator: (value: unknown) => boolean;
  name: ProductToolName;
  title: string;
};

const readOnlyAnnotations = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

const mutationAnnotations = {
  readOnlyHint: false,
  untrustedContentHint: true,
} as const;

const publicError = (
  code: PublicError["code"],
  message: string,
  retryable = false,
): PublicError => ({ code, message, retryable });

const validationError = (input: unknown): PublicError => {
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion !== "1"
  ) {
    return publicError(
      "UNSUPPORTED_SCHEMA_VERSION",
      "The schema version is not supported.",
    );
  }
  return publicError(
    "VALIDATION_ERROR",
    "The request did not match the Hub contract.",
  );
};

const internalError = (): PublicError =>
  publicError(
    "INTERNAL_ERROR",
    "The Hub could not return a safe tool result.",
    true,
  );

const cancelledError = (): PublicError =>
  publicError("CANCELLED", "The tool request was cancelled.", true);

const isAbortError = (error: unknown, signal?: AbortSignal): boolean =>
  signal?.aborted === true ||
  (error instanceof Error &&
    (error.name === "AbortError" || /abort/i.test(error.message)));

const serializeResult = (
  value: unknown,
  dataValidator: (value: unknown) => boolean,
  context: HubEnvelopeContext,
): string => {
  let envelope: unknown;
  try {
    envelope = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return JSON.stringify(createHubFailureEnvelope(internalError(), context));
  }

  const validEnvelope = contractValidators.providerResultEnvelope(envelope);
  const validData =
    validEnvelope &&
    typeof envelope === "object" &&
    envelope !== null &&
    "ok" in envelope &&
    (envelope.ok === false ||
      ("data" in envelope && dataValidator(envelope.data)));
  if (
    !validData ||
    !assertPublicPayloadSafe(envelope).ok ||
    !enforceResultSize(envelope).ok
  ) {
    return JSON.stringify(createHubFailureEnvelope(internalError(), context));
  }

  return typeof value === "string" ? value : JSON.stringify(envelope);
};

const createDefinition = <TInput extends ProductToolInput>(
  runtime: RuntimeDefinition<TInput>,
  dependencies: ProductToolDependencies,
  context: HubEnvelopeContext,
): ToolDefinition => ({
  annotations: runtime.annotations,
  description: runtime.description,
  async execute(input, options) {
    if (!runtime.inputValidator(input)) {
      return JSON.stringify(
        createHubFailureEnvelope(validationError(input), context),
      );
    }
    const typedInput = input as TInput;
    const state = dependencies.checkState?.(runtime.name, typedInput);
    if (state && !state.ok) {
      const error = contractValidators.error(state.error)
        ? state.error
        : internalError();
      return JSON.stringify(createHubFailureEnvelope(error, context));
    }

    try {
      const result = await runtime.action(typedInput, options?.signal);
      return serializeResult(result, runtime.dataValidator, context);
    } catch (error) {
      return JSON.stringify(
        createHubFailureEnvelope(
          isAbortError(error, options?.signal)
            ? cancelledError()
            : internalError(),
          context,
        ),
      );
    }
  },
  inputSchema: runtime.inputSchema,
  name: runtime.name,
  title: runtime.title,
});

export const createProductToolDefinitions = (
  dependencies: ProductToolDependencies,
): readonly [
  ToolDefinition,
  ToolDefinition,
  ToolDefinition,
  ToolDefinition,
  ToolDefinition,
] => {
  const context: HubEnvelopeContext = {
    ...(dependencies.clock ? { clock: dependencies.clock } : {}),
    ...(dependencies.correlationId
      ? { correlationId: dependencies.correlationId }
      : {}),
    origin: dependencies.hubOrigin,
  };

  return [
    createDefinition(
      {
        action: dependencies.findOptions,
        annotations: readOnlyAnnotations,
        dataValidator: contractValidators.findOptionsData,
        description:
          "Find up to three complete evening routes from current Provider availability. This search does not reserve inventory.",
        inputSchema: findOptionsInputSchema,
        inputValidator: contractValidators.findOptionsInput,
        name: "find_serendipity_options",
        title: "Find serendipity options",
      },
      dependencies,
      context,
    ),
    createDefinition(
      {
        action: dependencies.showBundle,
        annotations: readOnlyAnnotations,
        dataValidator: contractValidators.showBundleData,
        description:
          "Select and explain one route from the current candidate set. This does not reserve inventory.",
        inputSchema: showBundleInputSchema,
        inputValidator: contractValidators.showBundleInput,
        name: "show_bundle",
        title: "Show a route",
      },
      dependencies,
      context,
    ),
    createDefinition(
      {
        action: dependencies.holdBundle,
        annotations: mutationAnnotations,
        dataValidator: contractValidators.holdBundleData,
        description:
          "Temporarily hold every activity in the selected route. Successful partial holds are compensated if a Provider fails.",
        inputSchema: holdBundleInputSchema,
        inputValidator: contractValidators.holdBundleInput,
        name: "hold_bundle",
        title: "Hold this route",
      },
      dependencies,
      context,
    ),
    createDefinition(
      {
        action: dependencies.confirmBundle,
        annotations: mutationAnnotations,
        dataValidator: contractValidators.confirmBundleData,
        description:
          "Confirm the active Provider holds and reconcile any unknown result before returning a receipt.",
        inputSchema: confirmBundleInputSchema,
        inputValidator: contractValidators.confirmBundleInput,
        name: "confirm_bundle",
        title: "Confirm this route",
      },
      dependencies,
      context,
    ),
    createDefinition(
      {
        action: dependencies.releaseBundle,
        annotations: mutationAnnotations,
        dataValidator: contractValidators.releaseBundleData,
        description:
          "Release every active Provider hold in the route. This never rolls back a confirmed reservation.",
        inputSchema: releaseBundleInputSchema,
        inputValidator: contractValidators.releaseBundleInput,
        name: "release_bundle",
        title: "Release this route",
      },
      dependencies,
      context,
    ),
  ];
};

export const registerProductTools = (
  dependencies: ProductToolDependencies,
  source: Document = document,
): { dispose(): void; ready: Promise<void> } => {
  const handles: RegistrationHandle[] = createProductToolDefinitions(
    dependencies,
  ).map((definition) => registerTool(definition, {}, source));
  return {
    dispose() {
      for (const handle of handles) handle.dispose();
    },
    ready: Promise.all(handles.map(({ ready }) => ready)).then(() => undefined),
  };
};

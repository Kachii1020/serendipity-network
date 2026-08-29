import {
  contractValidators,
  findOptionsInputSchema,
  showBundleInputSchema,
  validateIntent,
  type FindOptionsData,
  type Intent,
  type PublicError,
  type ShowBundleData,
  type ShowBundleInput,
} from "@serendipity/contracts";
import {
  registerTool,
  type RegistrationHandle,
  type ToolDefinition,
} from "@serendipity/webmcp";

import {
  createHubFailureEnvelope,
  createHubSuccessEnvelope,
  type HubEnvelopeContext,
} from "../hub-envelope";
import type { DiscoverOutcome } from "../orchestrator/discover";
import { explainBundle } from "../selection";
import type { CandidateSessionStore } from "../selection";

type HubDiscoveryToolDependencies = {
  clock?: () => Date;
  correlationId?: () => string;
  discover: (intent: Intent, signal?: AbortSignal) => Promise<DiscoverOutcome>;
  hubOrigin: string;
  sessions: CandidateSessionStore;
};

const annotations = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

const validationError = (
  code: PublicError["code"] = "VALIDATION_ERROR",
): PublicError => ({
  code,
  message:
    code === "UNSUPPORTED_SCHEMA_VERSION"
      ? "The schema version is not supported."
      : "The request did not match the Hub contract.",
  retryable: false,
});

export const createHubDiscoveryToolDefinitions = (
  dependencies: HubDiscoveryToolDependencies,
): readonly [ToolDefinition, ToolDefinition] => {
  const context: HubEnvelopeContext = {
    ...(dependencies.clock ? { clock: dependencies.clock } : {}),
    ...(dependencies.correlationId
      ? { correlationId: dependencies.correlationId }
      : {}),
    origin: dependencies.hubOrigin,
  };
  const find: ToolDefinition = {
    annotations,
    description:
      "Compose up to three complete Shibuya evening routes from live Kiln, Nori, and Loop availability. This search does not reserve inventory.",
    async execute(input, options) {
      const validated = validateIntent(input);
      if (!validated.ok) {
        return JSON.stringify(
          createHubFailureEnvelope(validationError(validated.code), context),
        );
      }
      const result = await dependencies.discover(
        validated.value,
        options?.signal,
      );
      if (!result.ok) {
        return JSON.stringify(createHubFailureEnvelope(result.error, context));
      }
      dependencies.sessions.save(result.session);
      if (!contractValidators.findOptionsData(result.data)) {
        return JSON.stringify(
          createHubFailureEnvelope(
            {
              code: "INTERNAL_ERROR",
              message: "The Hub produced an invalid candidate set.",
              retryable: true,
            },
            context,
          ),
        );
      }
      return JSON.stringify(
        createHubSuccessEnvelope<FindOptionsData>(result.data, context),
      );
    },
    inputSchema: findOptionsInputSchema,
    name: "find_serendipity_options",
    title: "Find serendipity options",
  };

  const show: ToolDefinition = {
    annotations,
    description:
      "Select and explain one route from the current read-only candidate set. This does not reserve inventory.",
    execute(input) {
      const candidateInput: unknown = input;
      if (!contractValidators.showBundleInput(candidateInput)) {
        return JSON.stringify(
          createHubFailureEnvelope(validationError(), context),
        );
      }
      const selection = candidateInput as ShowBundleInput;
      const selected = dependencies.sessions.select(
        selection.bundleSessionId,
        selection,
      );
      if (!selected.ok) {
        return JSON.stringify(
          createHubFailureEnvelope(
            {
              code: selected.code,
              message:
                selected.code === "BUNDLE_NOT_FOUND"
                  ? "The candidate session was not found."
                  : "The requested candidate is stale or unknown.",
              retryable: selected.code === "BUNDLE_NOT_FOUND",
            },
            context,
          ),
        );
      }
      const data: ShowBundleData = {
        explanation: explainBundle(selected.selectedBundle),
        selectedBundle: selected.selectedBundle,
      };
      if (!contractValidators.showBundleData(data)) {
        return JSON.stringify(
          createHubFailureEnvelope(
            {
              code: "INTERNAL_ERROR",
              message: "The selected route could not be presented safely.",
              retryable: true,
            },
            context,
          ),
        );
      }
      return JSON.stringify(createHubSuccessEnvelope(data, context));
    },
    inputSchema: showBundleInputSchema,
    name: "show_bundle",
    title: "Show a route",
  };
  return [find, show];
};

export const registerHubDiscoveryTools = (
  dependencies: HubDiscoveryToolDependencies,
  source: Document = document,
): { dispose(): void; ready: Promise<void> } => {
  const handles: RegistrationHandle[] = createHubDiscoveryToolDefinitions(
    dependencies,
  ).map((definition) => registerTool(definition, {}, source));
  return {
    dispose() {
      for (const handle of handles) handle.dispose();
    },
    ready: Promise.all(handles.map(({ ready }) => ready)).then(() => undefined),
  };
};

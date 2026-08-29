import {
  confirmBundleInputSchema,
  contractValidators,
  holdBundleInputSchema,
  releaseBundleInputSchema,
  type ConfirmBundleInput,
  type HoldBundleInput,
  type PublicError,
  type ReleaseBundleInput,
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
import type {
  ConfirmationOutcome,
  ReleaseOutcome,
} from "../orchestrator/confirmation";
import type {
  HeldBundleSession,
  HoldOutcome,
  HoldSelection,
} from "../orchestrator/hold";
import type { CandidateSessionStore } from "../selection";

export class HeldSessionStore {
  readonly #sessions = new Map<string, HeldBundleSession>();

  clear(bundleSessionId: string): void {
    this.#sessions.delete(bundleSessionId);
  }

  get(bundleSessionId: string): HeldBundleSession | undefined {
    return this.#sessions.get(bundleSessionId);
  }

  save(session: HeldBundleSession): void {
    this.#sessions.set(session.bundleSessionId, session);
  }
}

type ReservationToolDependencies = {
  browserSessionId: string;
  candidates: CandidateSessionStore;
  clock?: () => Date;
  confirm: (
    session: HeldBundleSession,
    signal?: AbortSignal,
  ) => Promise<ConfirmationOutcome>;
  correlationId?: () => string;
  held: HeldSessionStore;
  hold: (
    selection: HoldSelection,
    signal?: AbortSignal,
  ) => Promise<HoldOutcome>;
  hubOrigin: string;
  release: (
    session: HeldBundleSession,
    reason: "HOLD_EXPIRED_UI" | "USER_CANCELLED",
    signal?: AbortSignal,
  ) => Promise<ReleaseOutcome>;
};

const mutationAnnotations = { untrustedContentHint: true } as const;

const error = (
  code: PublicError["code"],
  message: string,
  retryable = false,
): PublicError => ({ code, message, retryable });

export const createHubReservationToolDefinitions = (
  dependencies: ReservationToolDependencies,
): readonly [ToolDefinition, ToolDefinition, ToolDefinition] => {
  const context: HubEnvelopeContext = {
    ...(dependencies.clock ? { clock: dependencies.clock } : {}),
    ...(dependencies.correlationId
      ? { correlationId: dependencies.correlationId }
      : {}),
    origin: dependencies.hubOrigin,
  };
  const hold: ToolDefinition = {
    annotations: mutationAnnotations,
    description:
      "Temporarily hold all three activities in a current Serendipity route. Compensates successful holds if any Provider fails.",
    async execute(input, options) {
      const candidateInput: unknown = input;
      if (!contractValidators.holdBundleInput(candidateInput)) {
        return JSON.stringify(
          createHubFailureEnvelope(
            error("VALIDATION_ERROR", "The hold request was invalid."),
            context,
          ),
        );
      }
      const selection = candidateInput as HoldBundleInput;
      const session = dependencies.candidates.get(selection.bundleSessionId);
      if (!session) {
        return JSON.stringify(
          createHubFailureEnvelope(
            error("BUNDLE_NOT_FOUND", "The candidate session was not found."),
            context,
          ),
        );
      }
      const result = await dependencies.hold(
        {
          browserSessionId: dependencies.browserSessionId,
          bundleId: selection.bundleId,
          bundleSession: session,
          bundleVersion: selection.bundleVersion,
        },
        options?.signal,
      );
      if (!result.ok) {
        return JSON.stringify(createHubFailureEnvelope(result.error, context));
      }
      dependencies.held.save(result.heldSession);
      return JSON.stringify(createHubSuccessEnvelope(result.data, context));
    },
    inputSchema: holdBundleInputSchema,
    name: "hold_bundle",
    title: "Hold this route",
  };

  const confirm: ToolDefinition = {
    annotations: mutationAnnotations,
    description:
      "Confirm the three active Provider holds and reconcile any unknown result before returning a receipt.",
    async execute(input, options) {
      const candidateInput: unknown = input;
      if (!contractValidators.confirmBundleInput(candidateInput)) {
        return JSON.stringify(
          createHubFailureEnvelope(
            error("VALIDATION_ERROR", "The confirmation request was invalid."),
            context,
          ),
        );
      }
      const selection = candidateInput as ConfirmBundleInput;
      const session = dependencies.held.get(selection.bundleSessionId);
      if (!session || session.bundleHoldId !== selection.bundleHoldId) {
        return JSON.stringify(
          createHubFailureEnvelope(
            error("BUNDLE_NOT_FOUND", "The active bundle hold was not found."),
            context,
          ),
        );
      }
      const result = await dependencies.confirm(session, options?.signal);
      if (!result.ok) {
        return JSON.stringify(createHubFailureEnvelope(result.error, context));
      }
      dependencies.held.clear(selection.bundleSessionId);
      return JSON.stringify(createHubSuccessEnvelope(result.data, context));
    },
    inputSchema: confirmBundleInputSchema,
    name: "confirm_bundle",
    title: "Confirm this route",
  };

  const release: ToolDefinition = {
    annotations: mutationAnnotations,
    description:
      "Release every active Provider hold in the route. It never rolls back a confirmed reservation.",
    async execute(input, options) {
      const candidateInput: unknown = input;
      if (!contractValidators.releaseBundleInput(candidateInput)) {
        return JSON.stringify(
          createHubFailureEnvelope(
            error("VALIDATION_ERROR", "The release request was invalid."),
            context,
          ),
        );
      }
      const selection = candidateInput as ReleaseBundleInput;
      const session = dependencies.held.get(selection.bundleSessionId);
      if (!session || session.bundleHoldId !== selection.bundleHoldId) {
        return JSON.stringify(
          createHubFailureEnvelope(
            error("BUNDLE_NOT_FOUND", "The active bundle hold was not found."),
            context,
          ),
        );
      }
      const result = await dependencies.release(
        session,
        selection.reason,
        options?.signal,
      );
      if (!result.ok) {
        return JSON.stringify(createHubFailureEnvelope(result.error, context));
      }
      dependencies.held.clear(selection.bundleSessionId);
      return JSON.stringify(createHubSuccessEnvelope(result.data, context));
    },
    inputSchema: releaseBundleInputSchema,
    name: "release_bundle",
    title: "Release this route",
  };
  return [hold, confirm, release];
};

export const registerHubReservationTools = (
  dependencies: ReservationToolDependencies,
  source: Document = document,
): { dispose(): void; ready: Promise<void> } => {
  const handles: RegistrationHandle[] = createHubReservationToolDefinitions(
    dependencies,
  ).map((definition) => registerTool(definition, {}, source));
  return {
    dispose() {
      for (const handle of handles) handle.dispose();
    },
    ready: Promise.all(handles.map(({ ready }) => ready)).then(() => undefined),
  };
};

import { composeBundles, type TravelTimes } from "@serendipity/bundle-engine";
import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  directComposeInputSchema,
  directPrepareConfirmationInputSchema,
  directPrepareHoldInputSchema,
  directPrepareReleaseInputSchema,
  directRecordConfirmationInputSchema,
  directRecordHoldInputSchema,
  directRecordReleaseInputSchema,
  validateIntent,
  type BundleSummary,
  type ConfirmBundleData,
  type DirectComposeData,
  type DirectComposeInput,
  type DirectPrepareConfirmationInput,
  type DirectPrepareHoldInput,
  type DirectPrepareReleaseInput,
  type DirectRecordConfirmationData,
  type DirectRecordConfirmationInput,
  type DirectRecordHoldData,
  type DirectRecordHoldInput,
  type DirectRecordReleaseData,
  type DirectRecordReleaseInput,
  type HoldBundleData,
  type Provider,
  type PublicError,
  type ReleaseBundleData,
} from "@serendipity/contracts";
import { parseExactOrigin } from "@serendipity/provider-config";
import {
  registerTool,
  type RegistrationHandle,
  type ToolDefinition,
} from "@serendipity/webmcp";

import {
  createHubFailureEnvelope,
  createHubSuccessEnvelope,
  type HubEnvelopeContext,
} from "../../hub-envelope";
import type { HeldBundleSession, HeldProvider } from "../../orchestrator/hold";
import { selectCandidate, type CandidateSessionStore } from "../../selection";
import type {
  DirectWorkflowStore,
  DirectPendingHold,
  DirectPendingRelease,
} from "./workflow-store";

export type DirectToolDependencies = {
  browserSessionId: string;
  bundleHoldId: () => string;
  bundleSessionId: () => string;
  bundleVersion: number;
  candidates: CandidateSessionStore;
  clientRequestId: (provider: Provider) => string;
  clock?: () => Date;
  correlationId?: () => string;
  expectedOrigins: Record<Provider, string>;
  hubOrigin: string;
  now: () => Date;
  onEvent?: (event: DirectHubToolEvent) => void;
  travelTimes: TravelTimes;
  workflows: DirectWorkflowStore;
};

export type DirectHubToolEvent = {
  data: unknown;
  toolName:
    | "hub_compose_provider_results"
    | "hub_prepare_bundle_hold"
    | "hub_record_bundle_hold_results"
    | "hub_prepare_bundle_release"
    | "hub_record_confirmation_results"
    | "hub_record_release_results"
    | "hub_prepare_bundle_confirmation";
};

type ResultEntry = {
  provider: Provider;
  result: {
    meta: { origin: string };
  };
};

const annotations = { untrustedContentHint: true } as const;
const readOnlyAnnotations = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

const error = (
  code: PublicError["code"],
  message: string,
  retryable = false,
  provider?: Provider,
): PublicError => ({
  code,
  message,
  ...(provider ? { provider } : {}),
  retryable,
});

const verifyResultSet = (
  entries: readonly ResultEntry[],
  expectedProviders: readonly Provider[],
  origins: Record<Provider, string>,
): PublicError | null => {
  const actual = entries.map(({ provider }) => provider);
  if (
    new Set(actual).size !== actual.length ||
    actual.length !== expectedProviders.length ||
    expectedProviders.some((provider) => !actual.includes(provider))
  ) {
    return error(
      "VALIDATION_ERROR",
      "Provider results must contain each expected Provider exactly once.",
    );
  }
  for (const entry of entries) {
    let resultOrigin: string;
    try {
      resultOrigin = parseExactOrigin(entry.result.meta.origin);
    } catch {
      return error(
        "ORIGIN_MISMATCH",
        "A Provider result origin was invalid.",
        false,
        entry.provider,
      );
    }
    if (resultOrigin !== origins[entry.provider]) {
      return error(
        "ORIGIN_MISMATCH",
        "A Provider result came from an unexpected origin.",
        false,
        entry.provider,
      );
    }
  }
  return null;
};

const replacementFor = (
  pending: DirectPendingHold,
  failedProviders: ReadonlySet<Provider>,
): BundleSummary | null =>
  pending.bundleSession.candidates.find(
    (candidate) =>
      candidate.bundleId !== pending.bundle.bundleId &&
      [...failedProviders].every((provider) => {
        const failedSlot = pending.bundle.items.find(
          (item) => item.slot.provider === provider,
        )?.slot.slotId;
        const replacementSlot = candidate.items.find(
          (item) => item.slot.provider === provider,
        )?.slot.slotId;
        return Boolean(
          failedSlot && replacementSlot && failedSlot !== replacementSlot,
        );
      }),
  ) ?? null;

const holdOperations = (pending: DirectPendingHold) =>
  PROVIDERS.map((provider) => {
    const item = pending.bundle.items.find(
      (candidate) => candidate.slot.provider === provider,
    );
    if (!item) throw new Error("selected bundle is missing a Provider");
    return {
      input: {
        browserSessionId: pending.browserSessionId,
        clientRequestId: pending.clientRequestIds[provider],
        inventoryVersion: item.slot.inventoryVersion,
        quantity: 1 as const,
        schemaVersion: SCHEMA_VERSION,
        slotId: item.slot.slotId,
      },
      provider,
      toolName: `${provider}_hold_slot`,
    };
  });

const releaseOperations = (
  session: HeldBundleSession,
  holds: readonly HeldProvider[],
  reason: "BUNDLE_COMPENSATION" | "HOLD_EXPIRED_UI" | "USER_CANCELLED",
) =>
  holds.map((hold) => ({
    input: {
      browserSessionId: session.browserSessionId,
      holdSafeReference: hold.holdSafeReference,
      reason,
      schemaVersion: SCHEMA_VERSION,
    },
    provider: hold.provider,
    toolName: `${hold.provider}_release_hold`,
  }));

const confirmationOperations = (session: HeldBundleSession) =>
  session.providerHolds.map((hold) => ({
    input: {
      browserSessionId: session.browserSessionId,
      holdSafeReference: hold.holdSafeReference,
      schemaVersion: SCHEMA_VERSION,
    },
    provider: hold.provider,
    toolName: `${hold.provider}_confirm_hold`,
  }));

const statusOperations = (session: HeldBundleSession) =>
  session.providerHolds.map((hold) => ({
    input: {
      browserSessionId: session.browserSessionId,
      holdSafeReference: hold.holdSafeReference,
      schemaVersion: SCHEMA_VERSION,
    },
    provider: hold.provider,
    toolName: `${hold.provider}_get_hold_status`,
  }));

const selectedSession = (
  input: DirectPrepareHoldInput,
  dependencies: DirectToolDependencies,
):
  | { ok: true; pending: DirectPendingHold }
  | { ok: false; error: PublicError } => {
  const session = dependencies.candidates.get(input.bundleSessionId);
  if (!session) {
    return {
      error: error("BUNDLE_NOT_FOUND", "The candidate session was not found."),
      ok: false,
    };
  }
  const selected = selectCandidate(session, input);
  if (!selected.ok) {
    return {
      error: error("STALE_BUNDLE", "The selected route is stale.", true),
      ok: false,
    };
  }
  const existing = dependencies.workflows.getPendingHold(input.bundleSessionId);
  if (
    existing &&
    existing.bundle.bundleId === input.bundleId &&
    existing.bundle.bundleVersion === input.bundleVersion
  ) {
    return { ok: true, pending: existing };
  }
  const pending: DirectPendingHold = {
    browserSessionId: dependencies.browserSessionId,
    bundle: selected.selectedBundle,
    bundleHoldId: dependencies.bundleHoldId(),
    bundleSession: selected.session,
    clientRequestIds: Object.fromEntries(
      PROVIDERS.map((provider) => [
        provider,
        dependencies.clientRequestId(provider),
      ]),
    ) as Record<Provider, string>,
  };
  dependencies.workflows.savePendingHold(pending);
  return { ok: true, pending };
};

const createDefinitions = (
  dependencies: DirectToolDependencies,
): readonly ToolDefinition[] => {
  const context: HubEnvelopeContext = {
    ...(dependencies.clock ? { clock: dependencies.clock } : {}),
    ...(dependencies.correlationId
      ? { correlationId: dependencies.correlationId }
      : {}),
    origin: dependencies.hubOrigin,
  };
  const origins = Object.fromEntries(
    PROVIDERS.map((provider) => [
      provider,
      parseExactOrigin(dependencies.expectedOrigins[provider]),
    ]),
  ) as Record<Provider, string>;
  const failure = (publicError: PublicError) =>
    JSON.stringify(createHubFailureEnvelope(publicError, context));
  const success = (data: unknown) =>
    JSON.stringify(createHubSuccessEnvelope(data, context));

  const compose: ToolDefinition = {
    annotations: readOnlyAnnotations,
    description:
      "Validate one live search result from each Provider and compose complete Serendipity routes without reserving inventory.",
    async execute(rawInput) {
      if (!contractValidators.directComposeInput(rawInput)) {
        return failure(
          error(
            "VALIDATION_ERROR",
            "The Provider search results were invalid.",
          ),
        );
      }
      const input = rawInput as DirectComposeInput;
      const providerError = verifyResultSet(
        input.providerResults,
        PROVIDERS,
        origins,
      );
      if (providerError) return failure(providerError);
      const intent = validateIntent(input.intent);
      if (!intent.ok) {
        return failure(
          error(intent.code, "The structured route intent was invalid."),
        );
      }
      const slotsByProvider = {} as Record<
        Provider,
        DirectComposeInput["providerResults"][number]["result"]["data"]["slots"]
      >;
      for (const entry of input.providerResults) {
        if (entry.result.data.provider !== entry.provider) {
          return failure(
            error(
              "VALIDATION_ERROR",
              "A search result claimed the wrong Provider.",
              false,
              entry.provider,
            ),
          );
        }
        slotsByProvider[entry.provider] = entry.result.data.slots;
      }
      const composed = await composeBundles({
        bundleVersion: dependencies.bundleVersion,
        intent: intent.value,
        slotsByProvider,
        travelTimes: dependencies.travelTimes,
      });
      if (!composed.ok || !composed.candidates[0]) {
        return failure(
          error(
            "NO_VALID_BUNDLE",
            "No complete three-stop route matches these constraints.",
            true,
          ),
        );
      }
      const bundleSessionId = dependencies.bundleSessionId();
      const data: DirectComposeData = {
        alternatives: composed.candidates.slice(1),
        bundleSessionId,
        bundleVersion: dependencies.bundleVersion,
        providerStatuses: { kiln: "ONLINE", nori: "ONLINE", loop: "ONLINE" },
        selectedBundle: composed.candidates[0],
      };
      if (!contractValidators.directComposeData(data)) {
        return failure(
          error(
            "INTERNAL_ERROR",
            "The Hub composed an invalid candidate set.",
            true,
          ),
        );
      }
      dependencies.candidates.save({
        bundleSessionId,
        bundleVersion: dependencies.bundleVersion,
        candidates: composed.candidates,
        intent: intent.value,
        selectedBundleId: composed.candidates[0].bundleId,
      });
      dependencies.onEvent?.({
        data,
        toolName: "hub_compose_provider_results",
      });
      return success(data);
    },
    inputSchema: directComposeInputSchema,
    name: "hub_compose_provider_results",
    title: "Compose Provider results",
  };

  const prepareHold: ToolDefinition = {
    annotations,
    description:
      "Prepare three Provider-owned hold calls for the selected route using stable safe request references and no private keys.",
    execute(rawInput) {
      if (!contractValidators.directPrepareHoldInput(rawInput)) {
        return failure(
          error("VALIDATION_ERROR", "The hold selection was invalid."),
        );
      }
      const selected = selectedSession(
        rawInput as DirectPrepareHoldInput,
        dependencies,
      );
      if (!selected.ok) return failure(selected.error);
      const data = {
        bundleHoldId: selected.pending.bundleHoldId,
        bundleSessionId: selected.pending.bundleSession.bundleSessionId,
        operations: holdOperations(selected.pending),
      };
      if (!contractValidators.directPrepareHoldData(data)) {
        return failure(
          error("INTERNAL_ERROR", "The hold plan was invalid.", true),
        );
      }
      dependencies.onEvent?.({ data, toolName: "hub_prepare_bundle_hold" });
      return success(data);
    },
    inputSchema: directPrepareHoldInputSchema,
    name: "hub_prepare_bundle_hold",
    title: "Prepare route hold",
  };

  const recordHold: ToolDefinition = {
    annotations,
    description:
      "Record the three Provider hold results, enter held state on full success, or return exact compensation calls for every success.",
    execute(rawInput) {
      if (!contractValidators.directRecordHoldInput(rawInput)) {
        return failure(
          error("VALIDATION_ERROR", "The hold results were invalid."),
        );
      }
      const input = rawInput as DirectRecordHoldInput;
      const pending = dependencies.workflows.getPendingHold(
        input.bundleSessionId,
      );
      if (!pending || pending.bundleHoldId !== input.bundleHoldId) {
        return failure(
          error("BUNDLE_NOT_FOUND", "The prepared hold was not found."),
        );
      }
      const providerError = verifyResultSet(
        input.providerResults,
        PROVIDERS,
        origins,
      );
      if (providerError) return failure(providerError);
      const held: HeldProvider[] = [];
      const failedProviders = new Set<Provider>();
      let firstError: PublicError | null = null;
      for (const entry of input.providerResults) {
        if (!entry.result.ok) {
          if (
            entry.result.error.provider &&
            entry.result.error.provider !== entry.provider
          ) {
            return failure(
              error(
                "VALIDATION_ERROR",
                "A hold failure claimed the wrong Provider.",
                false,
                entry.provider,
              ),
            );
          }
          failedProviders.add(entry.provider);
          firstError ??= entry.result.error;
          continue;
        }
        const expectedItem = pending.bundle.items.find(
          (item) => item.slot.provider === entry.provider,
        );
        if (
          entry.result.data.provider !== entry.provider ||
          entry.result.data.slotId !== expectedItem?.slot.slotId
        ) {
          failedProviders.add(entry.provider);
          firstError ??= error(
            "VALIDATION_ERROR",
            "A hold result did not match the prepared Provider slot.",
            false,
            entry.provider,
          );
          continue;
        }
        held.push({
          expiresAt: entry.result.data.expiresAt,
          holdSafeReference: entry.result.data.holdSafeReference,
          provider: entry.provider,
          slotId: entry.result.data.slotId,
        });
      }
      held.sort(
        (left, right) =>
          PROVIDERS.indexOf(left.provider) - PROVIDERS.indexOf(right.provider),
      );
      if (held.length === PROVIDERS.length) {
        const expiresAt = held
          .map((item) => item.expiresAt)
          .sort((left, right) => Date.parse(left) - Date.parse(right))[0]!;
        const heldSession: HeldBundleSession = {
          browserSessionId: pending.browserSessionId,
          bundle: pending.bundle,
          bundleHoldId: pending.bundleHoldId,
          bundleSessionId: pending.bundleSession.bundleSessionId,
          expiresAt,
          providerHolds: held,
        };
        dependencies.workflows.saveHeld(heldSession);
        const data: HoldBundleData = {
          bundleHoldId: pending.bundleHoldId,
          bundleId: pending.bundle.bundleId,
          expiresAt,
          providerHolds: held.map((item) => ({
            holdSafeReference: item.holdSafeReference,
            provider: item.provider,
            status: "HELD",
          })),
          status: "HELD",
        };
        if (!contractValidators.directRecordHoldData(data)) {
          return failure(
            error("INTERNAL_ERROR", "The held result was invalid.", true),
          );
        }
        dependencies.onEvent?.({
          data,
          toolName: "hub_record_bundle_hold_results",
        });
        return success(data satisfies DirectRecordHoldData);
      }
      const replacementBundle = replacementFor(pending, failedProviders);
      const provisionalSession: HeldBundleSession = {
        browserSessionId: pending.browserSessionId,
        bundle: pending.bundle,
        bundleHoldId: pending.bundleHoldId,
        bundleSessionId: pending.bundleSession.bundleSessionId,
        expiresAt:
          held
            .map((item) => item.expiresAt)
            .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ??
          dependencies.now().toISOString(),
        providerHolds: held,
      };
      dependencies.workflows.savePendingRelease({
        expectedHolds: held,
        heldSession: provisionalSession,
        kind: "compensation",
        replacementBundle,
      });
      const data = {
        bundleHoldId: pending.bundleHoldId,
        bundleSessionId: pending.bundleSession.bundleSessionId,
        error:
          firstError ??
          error("INTERNAL_ERROR", "One or more Provider holds failed.", true),
        failedProviders: [...failedProviders].sort(
          (left, right) => PROVIDERS.indexOf(left) - PROVIDERS.indexOf(right),
        ),
        releaseOperations: releaseOperations(
          provisionalSession,
          held,
          "BUNDLE_COMPENSATION",
        ),
        replacementBundle,
        status: "RECOVERY_REQUIRED" as const,
      };
      if (!contractValidators.directRecordHoldData(data)) {
        return failure(
          error("INTERNAL_ERROR", "The recovery plan was invalid.", true),
        );
      }
      dependencies.onEvent?.({
        data,
        toolName: "hub_record_bundle_hold_results",
      });
      return success(data);
    },
    inputSchema: directRecordHoldInputSchema,
    name: "hub_record_bundle_hold_results",
    title: "Record route hold results",
  };

  const prepareRelease: ToolDefinition = {
    annotations,
    description:
      "Prepare three Provider-owned release calls for an active route hold without exposing private tokens or operation keys.",
    execute(rawInput) {
      if (!contractValidators.directPrepareReleaseInput(rawInput)) {
        return failure(
          error("VALIDATION_ERROR", "The release request was invalid."),
        );
      }
      const input = rawInput as DirectPrepareReleaseInput;
      const session = dependencies.workflows.getHeld(input.bundleSessionId);
      if (!session || session.bundleHoldId !== input.bundleHoldId) {
        return failure(
          error("BUNDLE_NOT_FOUND", "The active route hold was not found."),
        );
      }
      const pendingRelease: DirectPendingRelease = {
        expectedHolds: session.providerHolds,
        heldSession: session,
        kind: "user",
        replacementBundle: null,
      };
      dependencies.workflows.savePendingRelease(pendingRelease);
      const data = {
        bundleHoldId: session.bundleHoldId,
        bundleSessionId: session.bundleSessionId,
        operations: releaseOperations(
          session,
          session.providerHolds,
          input.reason,
        ),
      };
      if (!contractValidators.directPrepareReleaseData(data)) {
        return failure(
          error("INTERNAL_ERROR", "The release plan was invalid.", true),
        );
      }
      dependencies.onEvent?.({
        data,
        toolName: "hub_prepare_bundle_release",
      });
      return success(data);
    },
    inputSchema: directPrepareReleaseInputSchema,
    name: "hub_prepare_bundle_release",
    title: "Prepare route release",
  };

  const recordRelease: ToolDefinition = {
    annotations,
    description:
      "Verify every required Provider release result and complete either compensation or an Explorer-requested release.",
    execute(rawInput) {
      if (!contractValidators.directRecordReleaseInput(rawInput)) {
        return failure(
          error("VALIDATION_ERROR", "The release results were invalid."),
        );
      }
      const input = rawInput as DirectRecordReleaseInput;
      const pending = dependencies.workflows.getPendingRelease(
        input.bundleSessionId,
      );
      if (!pending || pending.heldSession.bundleHoldId !== input.bundleHoldId) {
        return failure(
          error("BUNDLE_NOT_FOUND", "The release plan was not found."),
        );
      }
      const expectedProviders = pending.expectedHolds.map(
        ({ provider }) => provider,
      );
      const providerError = verifyResultSet(
        input.providerResults,
        expectedProviders,
        origins,
      );
      if (providerError) return failure(providerError);
      const statuses: ReleaseBundleData["providerStatuses"] = [];
      for (const entry of input.providerResults) {
        if (!entry.result.ok) {
          if (
            entry.result.error.provider &&
            entry.result.error.provider !== entry.provider
          ) {
            return failure(
              error(
                "VALIDATION_ERROR",
                "A release failure claimed the wrong Provider.",
                false,
                entry.provider,
              ),
            );
          }
          return failure(
            pending.kind === "compensation"
              ? error(
                  "COMPENSATION_INCOMPLETE",
                  "One or more Provider holds were not verified released.",
                  true,
                  entry.provider,
                )
              : entry.result.error,
          );
        }
        const expected = pending.expectedHolds.find(
          ({ provider }) => provider === entry.provider,
        );
        if (
          entry.result.data.provider !== entry.provider ||
          entry.result.data.holdSafeReference !== expected?.holdSafeReference ||
          !["EXPIRED", "RELEASED"].includes(entry.result.data.status)
        ) {
          return failure(
            error(
              pending.kind === "compensation"
                ? "COMPENSATION_INCOMPLETE"
                : "VALIDATION_ERROR",
              "A Provider release did not match the prepared hold.",
              pending.kind === "compensation",
              entry.provider,
            ),
          );
        }
        statuses.push({
          provider: entry.provider,
          status: entry.result.data.status,
        });
      }
      let data: DirectRecordReleaseData;
      if (pending.kind === "user") {
        statuses.sort(
          (left, right) =>
            PROVIDERS.indexOf(left.provider) -
            PROVIDERS.indexOf(right.provider),
        );
        data = {
          bundleId: pending.heldSession.bundle.bundleId,
          providerStatuses: statuses,
          status: "RELEASED",
        };
      } else {
        data = {
          bundleHoldId: pending.heldSession.bundleHoldId,
          bundleSessionId: pending.heldSession.bundleSessionId,
          replacementBundle: pending.replacementBundle,
          status: "COMPENSATED",
        };
        if (pending.replacementBundle) {
          dependencies.candidates.select(pending.heldSession.bundleSessionId, {
            bundleId: pending.replacementBundle.bundleId,
            bundleVersion: pending.replacementBundle.bundleVersion,
          });
        }
      }
      if (!contractValidators.directRecordReleaseData(data)) {
        return failure(
          error("INTERNAL_ERROR", "The release result was invalid.", true),
        );
      }
      dependencies.workflows.clear(input.bundleSessionId);
      dependencies.onEvent?.({
        data,
        toolName: "hub_record_release_results",
      });
      return success(data);
    },
    inputSchema: directRecordReleaseInputSchema,
    name: "hub_record_release_results",
    title: "Record Provider releases",
  };

  const prepareConfirmation: ToolDefinition = {
    annotations,
    description:
      "Prepare three Provider-owned confirmation calls for a non-expired active route hold.",
    execute(rawInput) {
      if (!contractValidators.directPrepareConfirmationInput(rawInput)) {
        return failure(
          error("VALIDATION_ERROR", "The confirmation request was invalid."),
        );
      }
      const input = rawInput as DirectPrepareConfirmationInput;
      const session = dependencies.workflows.getHeld(input.bundleSessionId);
      if (!session || session.bundleHoldId !== input.bundleHoldId) {
        return failure(
          error("BUNDLE_NOT_FOUND", "The active route hold was not found."),
        );
      }
      if (dependencies.now().getTime() >= Date.parse(session.expiresAt)) {
        return failure(
          error(
            "HOLD_EXPIRED",
            "The earliest Provider hold has expired.",
            true,
          ),
        );
      }
      const data = {
        bundleHoldId: session.bundleHoldId,
        bundleSessionId: session.bundleSessionId,
        operations: confirmationOperations(session),
      };
      if (!contractValidators.directPrepareConfirmationData(data)) {
        return failure(
          error("INTERNAL_ERROR", "The confirmation plan was invalid.", true),
        );
      }
      dependencies.onEvent?.({
        data,
        toolName: "hub_prepare_bundle_confirmation",
      });
      return success(data);
    },
    inputSchema: directPrepareConfirmationInputSchema,
    name: "hub_prepare_bundle_confirmation",
    title: "Prepare route confirmation",
  };

  const recordConfirmation: ToolDefinition = {
    annotations,
    description:
      "Validate Provider confirmation or status results and return a receipt only when all three are authoritatively confirmed.",
    execute(rawInput) {
      if (!contractValidators.directRecordConfirmationInput(rawInput)) {
        return failure(
          error("VALIDATION_ERROR", "The confirmation results were invalid."),
        );
      }
      const input = rawInput as DirectRecordConfirmationInput;
      const session = dependencies.workflows.getHeld(input.bundleSessionId);
      if (!session || session.bundleHoldId !== input.bundleHoldId) {
        return failure(
          error("BUNDLE_NOT_FOUND", "The active route hold was not found."),
        );
      }
      const providerError = verifyResultSet(
        input.providerResults,
        PROVIDERS,
        origins,
      );
      if (providerError) return failure(providerError);
      const mislabeledFailure = input.providerResults.find(
        (entry) =>
          !entry.result.ok &&
          entry.result.error.provider !== undefined &&
          entry.result.error.provider !== entry.provider,
      );
      if (mislabeledFailure) {
        return failure(
          error(
            "VALIDATION_ERROR",
            "A confirmation failure claimed the wrong Provider.",
            false,
            mislabeledFailure.provider,
          ),
        );
      }
      const unknown = input.providerResults.find(
        ({ result }) =>
          !result.ok &&
          ["CANCELLED", "PROVIDER_OFFLINE", "PROVIDER_TIMEOUT"].includes(
            result.error.code,
          ),
      );
      if (unknown) {
        const data = {
          bundleHoldId: session.bundleHoldId,
          bundleSessionId: session.bundleSessionId,
          status: "RECONCILIATION_REQUIRED" as const,
          statusOperations: statusOperations(session),
        };
        if (!contractValidators.directRecordConfirmationData(data)) {
          return failure(
            error("INTERNAL_ERROR", "The status plan was invalid.", true),
          );
        }
        dependencies.onEvent?.({
          data,
          toolName: "hub_record_confirmation_results",
        });
        return success(data);
      }
      const reservations: ConfirmBundleData["reservations"] = [];
      let heldCount = 0;
      for (const entry of input.providerResults) {
        if (!entry.result.ok) return failure(entry.result.error);
        const expected = session.providerHolds.find(
          ({ provider }) => provider === entry.provider,
        );
        if (
          entry.result.data.provider !== entry.provider ||
          entry.result.data.holdSafeReference !== expected?.holdSafeReference
        ) {
          return failure(
            error(
              "VALIDATION_ERROR",
              "A confirmation result did not match the active Provider hold.",
              false,
              entry.provider,
            ),
          );
        }
        if (
          entry.result.data.status === "CONFIRMED" &&
          entry.result.data.reservationRef
        ) {
          reservations.push({
            provider: entry.provider,
            reservationRef: entry.result.data.reservationRef,
          });
        } else if (entry.result.data.status === "HELD") {
          heldCount += 1;
        } else {
          return failure(
            error(
              entry.result.data.status === "EXPIRED"
                ? "HOLD_EXPIRED"
                : "HOLD_RELEASED",
              "A Provider hold became terminal during confirmation.",
              true,
              entry.provider,
            ),
          );
        }
      }
      if (reservations.length !== PROVIDERS.length) {
        return failure(
          error(
            reservations.length > 0 && heldCount > 0
              ? "CONFIRMATION_INCONSISTENT"
              : "RECONCILIATION_REQUIRED",
            "Provider confirmation states do not agree.",
            reservations.length === 0,
          ),
        );
      }
      reservations.sort(
        (left, right) =>
          PROVIDERS.indexOf(left.provider) - PROVIDERS.indexOf(right.provider),
      );
      const data: ConfirmBundleData = {
        bundleId: session.bundle.bundleId,
        confirmedAt: dependencies.now().toISOString(),
        reservations,
        status: "CONFIRMED",
        totalPriceYen: session.bundle.totalPriceYen,
      };
      if (!contractValidators.directRecordConfirmationData(data)) {
        return failure(
          error("INTERNAL_ERROR", "The receipt was invalid.", true),
        );
      }
      dependencies.workflows.clear(input.bundleSessionId);
      dependencies.onEvent?.({
        data,
        toolName: "hub_record_confirmation_results",
      });
      return success(data satisfies DirectRecordConfirmationData);
    },
    inputSchema: directRecordConfirmationInputSchema,
    name: "hub_record_confirmation_results",
    title: "Record Provider confirmations",
  };

  return [
    compose,
    prepareHold,
    recordHold,
    prepareRelease,
    recordRelease,
    prepareConfirmation,
    recordConfirmation,
  ];
};

export const createDirectHubToolDefinitions = createDefinitions;

export const registerDirectHubTools = (
  dependencies: DirectToolDependencies,
  source: Document = document,
): { dispose(): void; ready: Promise<void> } => {
  const handles: RegistrationHandle[] = createDefinitions(dependencies).map(
    (definition) => registerTool(definition, {}, source),
  );
  return {
    dispose() {
      for (const handle of handles) handle.dispose();
    },
    ready: Promise.all(handles.map(({ ready }) => ready)).then(() => undefined),
  };
};

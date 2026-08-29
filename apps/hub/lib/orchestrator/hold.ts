import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  type BundleSummary,
  type HoldBundleData,
  type Provider,
  type ProviderHoldData,
  type ProviderHoldStatusData,
  type PublicError,
} from "@serendipity/contracts";

import type {
  ProviderGateway,
  ProviderGatewayResult,
} from "../provider-gateways/types";
import { selectCandidate, type CandidateSession } from "../selection";

export type HeldProvider = {
  expiresAt: string;
  holdSafeReference: string;
  provider: Provider;
  slotId: string;
};

export type HeldBundleSession = {
  browserSessionId: string;
  bundle: BundleSummary;
  bundleHoldId: string;
  bundleSessionId: string;
  expiresAt: string;
  providerHolds: readonly HeldProvider[];
};

export type HoldSelection = {
  browserSessionId: string;
  bundleId: string;
  bundleSession: CandidateSession;
  bundleVersion: number;
};

export type HoldDependencies = {
  bundleHoldId: () => string;
  clientRequestId: (provider: Provider) => string;
  gateways: Record<Provider, ProviderGateway>;
  idempotencyKey?: (
    bundleHoldId: string,
    provider: Provider,
    operation: "hold" | "release",
  ) => Promise<string> | string;
  persistHeld?: (session: HeldBundleSession) => Promise<void>;
};

export type HoldOutcome =
  | {
      data: HoldBundleData;
      heldSession: HeldBundleSession;
      ok: true;
    }
  | {
      compensationComplete: boolean;
      error: PublicError;
      ok: false;
      replacementBundle: BundleSummary | null;
    };

const deriveIdempotencyKey = async (
  bundleHoldId: string,
  provider: Provider,
  operation: "hold" | "release",
): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${bundleHoldId}:${provider}:${operation}:v1`),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isUnknownResult = (
  result: Extract<ProviderGatewayResult<unknown>, { ok: false }>,
): boolean =>
  result.failureType === "offline" ||
  ["CANCELLED", "PROVIDER_OFFLINE", "PROVIDER_TIMEOUT"].includes(
    result.error.code,
  );

const replacementFor = (
  session: CandidateSession,
  selected: BundleSummary,
  failedProviders: ReadonlySet<Provider>,
): BundleSummary | null =>
  session.candidates.find(
    (candidate) =>
      candidate.bundleId !== selected.bundleId &&
      [...failedProviders].every((provider) => {
        const failedSlot = selected.items.find(
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

const failure = (
  code: PublicError["code"],
  message: string,
  provider?: Provider,
): PublicError => ({
  code,
  message,
  ...(provider ? { provider } : {}),
  retryable: [
    "COMPENSATION_INCOMPLETE",
    "PROVIDER_OFFLINE",
    "PROVIDER_TIMEOUT",
    "SLOT_UNAVAILABLE",
  ].includes(code),
});

export const holdSelectedBundle = async (
  input: HoldSelection,
  dependencies: HoldDependencies,
  signal?: AbortSignal,
): Promise<HoldOutcome> => {
  const selection = selectCandidate(input.bundleSession, {
    bundleId: input.bundleId,
    bundleVersion: input.bundleVersion,
  });
  if (!selection.ok) {
    return {
      compensationComplete: true,
      error: failure("STALE_BUNDLE", "The selected route is stale."),
      ok: false,
      replacementBundle: null,
    };
  }
  const bundle = selection.selectedBundle;
  const bundleHoldId = dependencies.bundleHoldId();
  const requestIds = Object.fromEntries(
    PROVIDERS.map((provider) => [
      provider,
      dependencies.clientRequestId(provider),
    ]),
  ) as Record<Provider, string>;
  const key = dependencies.idempotencyKey ?? deriveIdempotencyKey;

  const attempts = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const item = bundle.items.find(({ slot }) => slot.provider === provider);
      if (!item) {
        return {
          provider,
          result: {
            error: failure(
              "VALIDATION_ERROR",
              "The selected route did not contain every Provider.",
              provider,
            ),
            failureType: "invalid" as const,
            ok: false as const,
          },
        };
      }
      const result = await dependencies.gateways[provider].hold(
        {
          browserSessionId: input.browserSessionId,
          clientRequestId: requestIds[provider],
          idempotencyKey: await key(bundleHoldId, provider, "hold"),
          inventoryVersion: item.slot.inventoryVersion,
          quantity: 1,
          schemaVersion: SCHEMA_VERSION,
          slotId: item.slot.slotId,
        },
        { ...(signal ? { signal } : {}) },
      );
      return { item, provider, result };
    }),
  );

  const held: HeldProvider[] = [];
  const failures: Array<{ error: PublicError; provider: Provider }> = [];
  for (const attempt of attempts) {
    let result: ProviderGatewayResult<
      ProviderHoldData | ProviderHoldStatusData
    > = attempt.result;
    if (!result.ok && isUnknownResult(result)) {
      result = await dependencies.gateways[attempt.provider].getHoldStatus(
        {
          browserSessionId: input.browserSessionId,
          clientRequestId: requestIds[attempt.provider],
          schemaVersion: SCHEMA_VERSION,
        },
        { ...(signal ? { signal } : {}) },
      );
    }
    if (
      result.ok &&
      result.data.status === "HELD" &&
      result.data.provider === attempt.provider &&
      (!attempt.item || result.data.slotId === attempt.item.slot.slotId)
    ) {
      held.push({
        expiresAt: result.data.expiresAt,
        holdSafeReference: result.data.holdSafeReference,
        provider: attempt.provider,
        slotId: result.data.slotId,
      });
      continue;
    }
    const error = result.ok
      ? failure(
          result.data.status === "CONFIRMED"
            ? "ALREADY_CONFIRMED"
            : result.data.status === "EXPIRED"
              ? "HOLD_EXPIRED"
              : "HOLD_RELEASED",
          "The recovered hold was already terminal.",
          attempt.provider,
        )
      : result.error;
    failures.push({ error, provider: attempt.provider });
  }

  const compensate = async (): Promise<boolean> => {
    const compensation = await Promise.all(
      held.map(async (active) => {
        const result = await dependencies.gateways[active.provider].release(
          {
            browserSessionId: input.browserSessionId,
            holdSafeReference: active.holdSafeReference,
            idempotencyKey: await key(bundleHoldId, active.provider, "release"),
            reason: "BUNDLE_COMPENSATION",
            schemaVersion: SCHEMA_VERSION,
          },
          { ...(signal ? { signal } : {}) },
        );
        return (
          result.ok &&
          (result.data.status === "RELEASED" ||
            result.data.status === "EXPIRED")
        );
      }),
    );
    return compensation.every(Boolean);
  };

  if (failures.length === 0 && held.length === PROVIDERS.length) {
    held.sort(
      (left, right) =>
        PROVIDERS.indexOf(left.provider) - PROVIDERS.indexOf(right.provider),
    );
    const earliestExpiry = held
      .map(({ expiresAt }) => expiresAt)
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0]!;
    const data: HoldBundleData = {
      bundleHoldId,
      bundleId: bundle.bundleId,
      expiresAt: earliestExpiry,
      providerHolds: held.map(({ holdSafeReference, provider }) => ({
        holdSafeReference,
        provider,
        status: "HELD",
      })),
      status: "HELD",
    };
    if (!contractValidators.holdBundleData(data)) {
      return {
        compensationComplete: false,
        error: failure(
          "COMPENSATION_INCOMPLETE",
          "The held result violated the public contract.",
        ),
        ok: false,
        replacementBundle: null,
      };
    }
    const heldSession: HeldBundleSession = {
      browserSessionId: input.browserSessionId,
      bundle,
      bundleHoldId,
      bundleSessionId: input.bundleSession.bundleSessionId,
      expiresAt: earliestExpiry,
      providerHolds: held,
    };
    if (dependencies.persistHeld) {
      try {
        await dependencies.persistHeld(heldSession);
      } catch {
        const compensationComplete = await compensate();
        return {
          compensationComplete,
          error: compensationComplete
            ? failure(
                "INTERNAL_ERROR",
                "The held bundle could not be persisted and was released.",
              )
            : failure(
                "COMPENSATION_INCOMPLETE",
                "Persistence failed and one or more holds could not be released.",
              ),
          ok: false,
          replacementBundle: null,
        };
      }
    }
    return { data, heldSession, ok: true };
  }

  const compensationComplete = await compensate();
  const failedProviders = new Set(failures.map(({ provider }) => provider));
  const firstFailure = failures[0];
  return {
    compensationComplete,
    error: compensationComplete
      ? (firstFailure?.error ??
        failure("INTERNAL_ERROR", "The bundle could not be held."))
      : failure(
          "COMPENSATION_INCOMPLETE",
          "One or more successful holds could not be released.",
        ),
    ok: false,
    replacementBundle: replacementFor(
      input.bundleSession,
      bundle,
      failedProviders,
    ),
  };
};

import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  type ConfirmBundleData,
  type Provider,
  type PublicError,
  type ReleaseBundleData,
} from "@serendipity/contracts";

import type { ProviderGateway } from "../provider-gateways/types";
import type { HeldBundleSession, HeldProvider } from "./hold";

type ConfirmationDependencies = {
  gateways: Record<Provider, ProviderGateway>;
  idempotencyKey?: (
    bundleHoldId: string,
    provider: Provider,
    operation: "confirm" | "release",
  ) => Promise<string> | string;
  now: () => Date;
};

export type ConfirmationOutcome =
  | { data: ConfirmBundleData; ok: true }
  | {
      error: PublicError;
      ok: false;
      requiresFreshSearch: boolean;
    };

type ReleaseDependencies = ConfirmationDependencies & {
  reason: "HOLD_EXPIRED_UI" | "USER_CANCELLED";
};

export type ReleaseOutcome =
  { data: ReleaseBundleData; ok: true } | { error: PublicError; ok: false };

const deriveKey = async (
  bundleHoldId: string,
  provider: Provider,
  operation: "confirm" | "release",
): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${bundleHoldId}:${provider}:${operation}:v1`),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const publicError = (
  code: PublicError["code"],
  message: string,
  provider?: Provider,
): PublicError => ({
  code,
  message,
  ...(provider ? { provider } : {}),
  retryable: [
    "PROVIDER_OFFLINE",
    "PROVIDER_TIMEOUT",
    "RECONCILIATION_REQUIRED",
  ].includes(code),
});

const statusFor = (
  hold: HeldProvider,
  session: HeldBundleSession,
  gateways: Record<Provider, ProviderGateway>,
  signal?: AbortSignal,
) =>
  gateways[hold.provider].getHoldStatus(
    {
      browserSessionId: session.browserSessionId,
      holdSafeReference: hold.holdSafeReference,
      schemaVersion: SCHEMA_VERSION,
    },
    { ...(signal ? { signal } : {}) },
  );

export const confirmHeldBundle = async (
  session: HeldBundleSession,
  dependencies: ConfirmationDependencies,
  signal?: AbortSignal,
): Promise<ConfirmationOutcome> => {
  if (dependencies.now().getTime() >= Date.parse(session.expiresAt)) {
    await Promise.all(
      session.providerHolds.map((hold) =>
        statusFor(hold, session, dependencies.gateways, signal),
      ),
    );
    return {
      error: publicError(
        "HOLD_EXPIRED",
        "The earliest Provider hold has expired.",
      ),
      ok: false,
      requiresFreshSearch: true,
    };
  }
  const key = dependencies.idempotencyKey ?? deriveKey;
  const attempts = await Promise.all(
    session.providerHolds.map(async (hold) => {
      const result = await dependencies.gateways[hold.provider].confirm(
        {
          browserSessionId: session.browserSessionId,
          holdSafeReference: hold.holdSafeReference,
          idempotencyKey: await key(
            session.bundleHoldId,
            hold.provider,
            "confirm",
          ),
          schemaVersion: SCHEMA_VERSION,
        },
        { ...(signal ? { signal } : {}) },
      );
      if (
        !result.ok &&
        (result.failureType === "offline" ||
          ["CANCELLED", "PROVIDER_OFFLINE", "PROVIDER_TIMEOUT"].includes(
            result.error.code,
          ))
      ) {
        return {
          hold,
          result: await statusFor(hold, session, dependencies.gateways, signal),
        };
      }
      return { hold, result };
    }),
  );

  const reservations: ConfirmBundleData["reservations"] = [];
  let heldCount = 0;
  for (const { hold, result } of attempts) {
    if (!result.ok) {
      return {
        error: result.error,
        ok: false,
        requiresFreshSearch: false,
      };
    }
    if (result.data.status === "CONFIRMED" && result.data.reservationRef) {
      reservations.push({
        provider: hold.provider,
        reservationRef: result.data.reservationRef,
      });
    } else if (result.data.status === "HELD") {
      heldCount += 1;
    } else {
      return {
        error: publicError(
          result.data.status === "EXPIRED" ? "HOLD_EXPIRED" : "HOLD_RELEASED",
          "A Provider hold became terminal during confirmation.",
          hold.provider,
        ),
        ok: false,
        requiresFreshSearch: true,
      };
    }
  }
  if (reservations.length !== PROVIDERS.length) {
    return {
      error: publicError(
        reservations.length > 0 && heldCount > 0
          ? "CONFIRMATION_INCONSISTENT"
          : "RECONCILIATION_REQUIRED",
        "Provider confirmation states do not agree.",
      ),
      ok: false,
      requiresFreshSearch: false,
    };
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
  if (!contractValidators.confirmBundleData(data)) {
    return {
      error: publicError(
        "INTERNAL_ERROR",
        "The confirmation receipt violated the public contract.",
      ),
      ok: false,
      requiresFreshSearch: false,
    };
  }
  return { data, ok: true };
};

export const releaseHeldBundle = async (
  session: HeldBundleSession,
  dependencies: ReleaseDependencies,
  signal?: AbortSignal,
): Promise<ReleaseOutcome> => {
  const statuses = await Promise.all(
    session.providerHolds.map(async (hold) => ({
      hold,
      result: await statusFor(hold, session, dependencies.gateways, signal),
    })),
  );
  for (const { hold, result } of statuses) {
    if (!result.ok) return { error: result.error, ok: false };
    if (result.data.status === "CONFIRMED") {
      return {
        error: publicError(
          "ALREADY_CONFIRMED",
          "A confirmed Provider item cannot be released as a hold.",
          hold.provider,
        ),
        ok: false,
      };
    }
  }

  const key = dependencies.idempotencyKey ?? deriveKey;
  const released = await Promise.all(
    statuses.map(async ({ hold, result }) => {
      if (!result.ok) return result;
      if (
        result.data.status === "RELEASED" ||
        result.data.status === "EXPIRED"
      ) {
        return result;
      }
      return dependencies.gateways[hold.provider].release(
        {
          browserSessionId: session.browserSessionId,
          holdSafeReference: hold.holdSafeReference,
          idempotencyKey: await key(
            session.bundleHoldId,
            hold.provider,
            "release",
          ),
          reason: dependencies.reason,
          schemaVersion: SCHEMA_VERSION,
        },
        { ...(signal ? { signal } : {}) },
      );
    }),
  );
  const providerStatuses: ReleaseBundleData["providerStatuses"] = [];
  for (const [index, result] of released.entries()) {
    if (!result.ok) return { error: result.error, ok: false };
    if (result.data.status !== "RELEASED" && result.data.status !== "EXPIRED") {
      return {
        error: publicError(
          "COMPENSATION_INCOMPLETE",
          "A Provider hold did not reach a release terminal state.",
          PROVIDERS[index],
        ),
        ok: false,
      };
    }
    providerStatuses.push({
      provider: PROVIDERS[index]!,
      status: result.data.status,
    });
  }
  const data: ReleaseBundleData = {
    bundleId: session.bundle.bundleId,
    providerStatuses,
    status: "RELEASED",
  };
  if (!contractValidators.releaseBundleData(data)) {
    return {
      error: publicError(
        "INTERNAL_ERROR",
        "The release result violated the public contract.",
      ),
      ok: false,
    };
  }
  return { data, ok: true };
};

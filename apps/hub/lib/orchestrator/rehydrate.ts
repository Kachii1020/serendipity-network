import {
  PROVIDERS,
  SCHEMA_VERSION,
  type Provider,
  type PublicError,
} from "@serendipity/contracts";

import type { ProviderGateway } from "../provider-gateways/types";
import type { LoadedHeldWorkflow } from "../server/workflow-persistence";

type RehydratedProviderState = {
  holdSafeReference: string;
  provider: Provider;
  reservationRef?: string;
  status: "CONFIRMED" | "EXPIRED" | "HELD" | "RELEASED";
};

export type RehydrateOutcome =
  | {
      bundle: LoadedHeldWorkflow["heldSession"]["bundle"];
      bundleHoldId: string;
      bundleSessionId: string;
      expiresAt: string | null;
      ok: true;
      phase: "confirmed" | "held" | "released";
      providerStates: readonly RehydratedProviderState[];
      requiresFreshSearch: boolean;
    }
  | { error: PublicError; ok: false };

export type RehydrateDependencies = {
  createGateways: (
    loaded: LoadedHeldWorkflow,
  ) => Record<Provider, ProviderGateway>;
  load: (
    bundleSessionId: string,
    browserSessionId: string,
  ) => Promise<LoadedHeldWorkflow | null>;
};

const error = (
  code: PublicError["code"],
  message: string,
): RehydrateOutcome => ({
  error: { code, message, retryable: code !== "CONFIRMATION_INCONSISTENT" },
  ok: false,
});

export const rehydrateBundleSession = async (
  bundleSessionId: string,
  browserSessionId: string,
  dependencies: RehydrateDependencies,
  signal?: AbortSignal,
): Promise<RehydrateOutcome> => {
  const loaded = await dependencies.load(bundleSessionId, browserSessionId);
  if (!loaded) {
    return error("BUNDLE_NOT_FOUND", "The owned bundle session was not found.");
  }
  const gateways = dependencies.createGateways(loaded);
  const results = await Promise.all(
    loaded.heldSession.providerHolds.map(async (hold) => ({
      hold,
      result: await gateways[hold.provider].getHoldStatus(
        {
          browserSessionId,
          holdSafeReference: hold.holdSafeReference,
          schemaVersion: SCHEMA_VERSION,
        },
        { ...(signal ? { signal } : {}) },
      ),
    })),
  );
  const states: RehydratedProviderState[] = [];
  for (const { hold, result } of results) {
    if (!result.ok) return { error: result.error, ok: false };
    states.push({
      holdSafeReference: hold.holdSafeReference,
      provider: hold.provider,
      ...(result.data.reservationRef
        ? { reservationRef: result.data.reservationRef }
        : {}),
      status: result.data.status,
    });
  }
  states.sort(
    (left, right) =>
      PROVIDERS.indexOf(left.provider) - PROVIDERS.indexOf(right.provider),
  );
  const statuses = new Set(states.map(({ status }) => status));
  if (statuses.size !== 1) {
    return error(
      "CONFIRMATION_INCONSISTENT",
      "Provider states disagree after session reload.",
    );
  }
  const status = states[0]?.status;
  const terminal = status === "EXPIRED" || status === "RELEASED";
  return {
    bundle: loaded.heldSession.bundle,
    bundleHoldId: loaded.heldSession.bundleHoldId,
    bundleSessionId,
    expiresAt: status === "HELD" ? loaded.heldSession.expiresAt : null,
    ok: true,
    phase:
      status === "CONFIRMED" ? "confirmed" : terminal ? "released" : "held",
    providerStates: states,
    requiresFreshSearch: terminal,
  };
};

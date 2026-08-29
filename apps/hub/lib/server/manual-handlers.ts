import "server-only";

import { randomUUID } from "node:crypto";

import {
  contractValidators,
  type ConfirmBundleInput,
  type HoldBundleInput,
  type Provider,
  type ReleaseBundleInput,
} from "@serendipity/contracts";

import {
  confirmHeldBundle,
  releaseHeldBundle,
} from "../orchestrator/confirmation";
import { holdSelectedBundle } from "../orchestrator/hold";
import { rehydrateBundleSession } from "../orchestrator/rehydrate";
import { CandidateSessionStore, type CandidateSession } from "../selection";
import { readBrowserSession } from "./browser-session";
import {
  createManualWorkflowRuntime,
  type ManualWorkflowRuntime,
} from "./manual-runtime";
import { parseBoundedJson, requestCorrelationId } from "./request";
import { routeFailure, routeSuccess } from "./route-response";
import { MemoryProviderTokenVault } from "./token-vault";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const requestError = {
  code: "VALIDATION_ERROR" as const,
  message: "The manual workflow request was invalid.",
  retryable: false,
};

const runtimeFailure = (request: Request, correlationId: string): Response =>
  routeFailure(
    {
      code: "INTERNAL_ERROR",
      message: "The manual workflow is not configured.",
      retryable: false,
    },
    500,
    { correlationId, hubOrigin: new URL(request.url).origin },
  );

export const handleManualHold = async (
  request: Request,
  expectedBundleSessionId?: string,
  runtimeFactory: () => ManualWorkflowRuntime = createManualWorkflowRuntime,
): Promise<Response> => {
  const correlationId = requestCorrelationId(request);
  const session = readBrowserSession(request);
  let runtime: ManualWorkflowRuntime;
  try {
    runtime = runtimeFactory();
  } catch {
    return runtimeFailure(request, correlationId);
  }
  const context = { correlationId, hubOrigin: runtime.hubOrigin, session };
  const parsed = await parseBoundedJson(request);
  if (!parsed.ok || !isRecord(parsed.value)) {
    return routeFailure(requestError, 400, context);
  }
  const candidate = parsed.value.bundleSession;
  const selection = {
    schemaVersion: parsed.value.schemaVersion,
    bundleSessionId: parsed.value.bundleSessionId,
    bundleId: parsed.value.bundleId,
    bundleVersion: parsed.value.bundleVersion,
  };
  if (!contractValidators.holdBundleInput(selection)) {
    return routeFailure(requestError, 400, context);
  }
  const holdInput = selection as unknown as HoldBundleInput;
  if (
    !isRecord(candidate) ||
    candidate.bundleSessionId !== holdInput.bundleSessionId ||
    (expectedBundleSessionId !== undefined &&
      expectedBundleSessionId !== holdInput.bundleSessionId)
  ) {
    return routeFailure(requestError, 400, context);
  }
  const candidates = new CandidateSessionStore();
  try {
    candidates.save(candidate as unknown as CandidateSession);
  } catch {
    return routeFailure(requestError, 400, context);
  }
  const candidateSession = candidates.get(holdInput.bundleSessionId);
  if (!candidateSession) return routeFailure(requestError, 400, context);
  const vault = new MemoryProviderTokenVault();
  const gateways = runtime.createGateways(vault);
  const result = await holdSelectedBundle(
    {
      browserSessionId: session.id,
      bundleId: holdInput.bundleId,
      bundleSession: candidateSession,
      bundleVersion: holdInput.bundleVersion,
    },
    {
      bundleHoldId: () => holdInput.bundleSessionId,
      clientRequestId: () => randomUUID(),
      gateways,
      persistHeld: async (heldSession) => {
        const rawTokens: Partial<Record<Provider, string>> = {};
        for (const hold of heldSession.providerHolds) {
          const token = vault.load(hold.provider, hold.holdSafeReference);
          if (!token) throw new Error("manual hold token is missing");
          rawTokens[hold.provider] = token;
        }
        await runtime.repository.persistHeld({
          candidateSession,
          heldSession,
          rawTokens,
        });
      },
    },
    request.signal,
  );
  return result.ok
    ? routeSuccess(result.data, context)
    : routeFailure(
        result.error,
        result.error.code === "COMPENSATION_INCOMPLETE" ? 500 : 409,
        context,
      );
};

const loadManualHeld = async (
  request: Request,
  bundleSessionId: string,
  runtimeFactory: () => ManualWorkflowRuntime,
) => {
  const session = readBrowserSession(request);
  if (session.isNew) return null;
  const runtime = runtimeFactory();
  const loaded = await runtime.repository.loadHeld(bundleSessionId, session.id);
  if (!loaded) return null;
  const vault = new MemoryProviderTokenVault();
  for (const hold of loaded.heldSession.providerHolds) {
    const token = loaded.rawTokens[hold.provider];
    if (token) vault.save(hold.provider, hold.holdSafeReference, token);
  }
  return {
    gateways: runtime.createGateways(vault),
    loaded,
    runtime,
    session,
  };
};

export const handleManualConfirm = async (
  request: Request,
  runtimeFactory: () => ManualWorkflowRuntime = createManualWorkflowRuntime,
): Promise<Response> => {
  const correlationId = requestCorrelationId(request);
  const parsed = await parseBoundedJson(request);
  const fallbackContext = {
    correlationId,
    hubOrigin: new URL(request.url).origin,
  };
  if (!parsed.ok || !contractValidators.confirmBundleInput(parsed.value)) {
    return routeFailure(requestError, 400, fallbackContext);
  }
  const input = parsed.value as ConfirmBundleInput;
  let active: Awaited<ReturnType<typeof loadManualHeld>>;
  try {
    active = await loadManualHeld(
      request,
      input.bundleSessionId,
      runtimeFactory,
    );
  } catch {
    return runtimeFailure(request, correlationId);
  }
  if (
    !active ||
    active.loaded.heldSession.bundleHoldId !== input.bundleHoldId
  ) {
    return routeFailure(
      {
        code: "BUNDLE_NOT_FOUND",
        message: "The owned active bundle hold was not found.",
        retryable: false,
      },
      404,
      fallbackContext,
    );
  }
  const context = {
    correlationId,
    hubOrigin: active.runtime.hubOrigin,
    session: active.session,
  };
  const result = await confirmHeldBundle(
    active.loaded.heldSession,
    { gateways: active.gateways, now: () => new Date() },
    request.signal,
  );
  if (!result.ok) return routeFailure(result.error, 409, context);
  try {
    await active.runtime.repository.markTerminal(
      input.bundleSessionId,
      active.session.id,
      "confirmed",
      { kiln: "CONFIRMED", nori: "CONFIRMED", loop: "CONFIRMED" },
    );
  } catch {
    return routeFailure(
      {
        code: "RECONCILIATION_REQUIRED",
        message:
          "Confirmation succeeded but the Hub must reconcile its receipt.",
        retryable: true,
      },
      500,
      context,
    );
  }
  return routeSuccess(result.data, context);
};

export const handleManualRelease = async (
  request: Request,
  runtimeFactory: () => ManualWorkflowRuntime = createManualWorkflowRuntime,
): Promise<Response> => {
  const correlationId = requestCorrelationId(request);
  const parsed = await parseBoundedJson(request);
  const fallbackContext = {
    correlationId,
    hubOrigin: new URL(request.url).origin,
  };
  if (!parsed.ok || !contractValidators.releaseBundleInput(parsed.value)) {
    return routeFailure(requestError, 400, fallbackContext);
  }
  const input = parsed.value as ReleaseBundleInput;
  let active: Awaited<ReturnType<typeof loadManualHeld>>;
  try {
    active = await loadManualHeld(
      request,
      input.bundleSessionId,
      runtimeFactory,
    );
  } catch {
    return runtimeFailure(request, correlationId);
  }
  if (
    !active ||
    active.loaded.heldSession.bundleHoldId !== input.bundleHoldId
  ) {
    return routeFailure(
      {
        code: "BUNDLE_NOT_FOUND",
        message: "The owned active bundle hold was not found.",
        retryable: false,
      },
      404,
      fallbackContext,
    );
  }
  const context = {
    correlationId,
    hubOrigin: active.runtime.hubOrigin,
    session: active.session,
  };
  const result = await releaseHeldBundle(
    active.loaded.heldSession,
    {
      gateways: active.gateways,
      now: () => new Date(),
      reason: input.reason,
    },
    request.signal,
  );
  if (!result.ok) return routeFailure(result.error, 409, context);
  const statuses = Object.fromEntries(
    result.data.providerStatuses.map(({ provider, status }) => [
      provider,
      status,
    ]),
  ) as Record<Provider, "EXPIRED" | "RELEASED">;
  try {
    await active.runtime.repository.markTerminal(
      input.bundleSessionId,
      active.session.id,
      "composed",
      statuses,
    );
  } catch {
    return routeFailure(
      {
        code: "RECONCILIATION_REQUIRED",
        message: "Release succeeded but the Hub must reconcile its state.",
        retryable: true,
      },
      500,
      context,
    );
  }
  return routeSuccess(result.data, context);
};

export const handleBundleReload = async (
  request: Request,
  bundleSessionId: string,
  runtimeFactory: () => ManualWorkflowRuntime = createManualWorkflowRuntime,
): Promise<Response> => {
  const correlationId = requestCorrelationId(request);
  const session = readBrowserSession(request);
  let runtime: ManualWorkflowRuntime;
  try {
    runtime = runtimeFactory();
  } catch {
    return runtimeFailure(request, correlationId);
  }
  const context = { correlationId, hubOrigin: runtime.hubOrigin, session };
  if (session.isNew) {
    return routeFailure(
      {
        code: "BUNDLE_NOT_FOUND",
        message: "The owned bundle session was not found.",
        retryable: false,
      },
      404,
      context,
    );
  }
  const result = await rehydrateBundleSession(
    bundleSessionId,
    session.id,
    {
      createGateways(loaded) {
        const vault = new MemoryProviderTokenVault();
        for (const hold of loaded.heldSession.providerHolds) {
          const token = loaded.rawTokens[hold.provider];
          if (token) vault.save(hold.provider, hold.holdSafeReference, token);
        }
        return runtime.createGateways(vault);
      },
      load: (sessionId, browserId) =>
        runtime.repository.loadHeld(sessionId, browserId),
    },
    request.signal,
  );
  return result.ok
    ? routeSuccess(result, context)
    : routeFailure(result.error, 409, context);
};

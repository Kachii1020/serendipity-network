import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  type Provider,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import type { ToolDefinition } from "@serendipity/webmcp";
import { describe, expect, it } from "vitest";

import { CandidateSessionStore } from "../../selection";
import {
  createDirectHubToolDefinitions,
  type DirectToolDependencies,
} from "./direct-tools";
import { DirectWorkflowStore } from "./workflow-store";

const origins: Record<Provider, string> = {
  kiln: "https://kiln.test",
  nori: "https://nori.test",
  loop: "https://loop.test",
};

const meta = (provider: Provider) => ({
  completedAt: "2030-05-17T09:00:00Z",
  correlationId: `correlation-${provider}`,
  origin: origins[provider],
});

const success = (provider: Provider, data: unknown) => ({
  data,
  meta: meta(provider),
  ok: true as const,
  schemaVersion: SCHEMA_VERSION,
});

const failure = (
  provider: Provider,
  code: "PROVIDER_TIMEOUT" | "SLOT_UNAVAILABLE",
) => ({
  error: {
    code,
    message: `${provider} failed safely.`,
    provider,
    retryable: true,
  },
  meta: meta(provider),
  ok: false as const,
  schemaVersion: SCHEMA_VERSION,
});

type PublicEnvelope = {
  data?: Record<string, unknown>;
  error?: { code?: string };
  ok: boolean;
};

type PreparedOperation = {
  input: {
    browserSessionId: string;
    clientRequestId?: string;
    holdSafeReference?: string;
    inventoryVersion?: string;
    quantity?: 1;
    reason?: string;
    schemaVersion: "1";
    slotId?: string;
  };
  provider: Provider;
  toolName: string;
};

const requireData = (envelope: PublicEnvelope): Record<string, unknown> => {
  expect(envelope.ok).toBe(true);
  if (!envelope.ok || !envelope.data) throw new Error("expected tool data");
  return envelope.data;
};

const requireOperations = (
  envelope: PublicEnvelope,
  key: "operations" | "releaseOperations" | "statusOperations" = "operations",
): PreparedOperation[] => {
  const data = requireData(envelope);
  const operations = data[key];
  if (!Array.isArray(operations)) throw new Error("expected operations");
  return operations as PreparedOperation[];
};

const findTool = (
  definitions: readonly ToolDefinition[],
  name: string,
): ToolDefinition => {
  const definition = definitions.find((item) => item.name === name);
  if (!definition) throw new Error(`missing tool ${name}`);
  return definition;
};

const execute = async (
  definitions: readonly ToolDefinition[],
  name: string,
  input: unknown,
): Promise<PublicEnvelope> =>
  JSON.parse(
    await findTool(definitions, name).execute(input),
  ) as PublicEnvelope;

const createHarness = () => {
  const candidates = new CandidateSessionStore();
  const workflows = new DirectWorkflowStore();
  const dependencies: DirectToolDependencies = {
    browserSessionId: "browser-session-direct",
    bundleHoldId: () => "bundle-hold-direct",
    bundleSessionId: () => "bundle-session-direct",
    bundleVersion: 1,
    candidates,
    clientRequestId: (provider) => `hold-request-${provider}`,
    clock: () => new Date("2030-05-17T09:00:00Z"),
    correlationId: () => "hub-correlation-direct",
    expectedOrigins: origins,
    hubOrigin: "https://hub.test",
    now: () => new Date("2030-05-17T09:00:10Z"),
    travelTimes: canonicalTravelTimes,
    workflows,
  };
  return {
    candidates,
    definitions: createDirectHubToolDefinitions(dependencies),
    workflows,
  };
};

const compose = async (definitions: readonly ToolDefinition[]) => {
  const envelope = await execute(definitions, "hub_compose_provider_results", {
    intent: canonicalIntent,
    providerResults: PROVIDERS.map((provider) => ({
      provider,
      result: success(provider, {
        inventoryAsOf: "2030-05-17T08:59:00Z",
        provider,
        slots: canonicalSlotsByProvider[provider],
      }),
    })),
    schemaVersion: SCHEMA_VERSION,
  });
  const data = requireData(envelope);
  expect(contractValidators.directComposeData(data)).toBe(true);
  return data;
};

const prepareHold = async (
  definitions: readonly ToolDefinition[],
  composed: Record<string, unknown>,
) => {
  const selected = composed.selectedBundle as {
    bundleId: string;
    bundleVersion: number;
  };
  const envelope = await execute(definitions, "hub_prepare_bundle_hold", {
    bundleId: selected.bundleId,
    bundleSessionId: composed.bundleSessionId,
    bundleVersion: selected.bundleVersion,
    schemaVersion: SCHEMA_VERSION,
  });
  expect(contractValidators.directPrepareHoldData(envelope.data)).toBe(true);
  return envelope;
};

const holdResults = (
  operations: readonly PreparedOperation[],
  failingProvider?: Provider,
) =>
  operations.map((operation, index) => ({
    provider: operation.provider,
    result:
      operation.provider === failingProvider
        ? failure(operation.provider, "SLOT_UNAVAILABLE")
        : success(operation.provider, {
            expiresAt: `2030-05-17T09:01:${20 + index}Z`,
            holdSafeReference: `safe-${operation.provider}`,
            provider: operation.provider,
            slotId: operation.input.slotId,
            status: "HELD",
          }),
  }));

describe("direct-mode Hub coordination", () => {
  it("T065/T066 exposes only the direct coordination surface and no private public fields", () => {
    const { definitions } = createHarness();
    expect(definitions.map(({ name }) => name)).toEqual([
      "hub_compose_provider_results",
      "hub_prepare_bundle_hold",
      "hub_record_bundle_hold_results",
      "hub_prepare_bundle_release",
      "hub_record_release_results",
      "hub_prepare_bundle_confirmation",
      "hub_record_confirmation_results",
    ]);
    expect(definitions[0]?.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(definitions.slice(1).map(({ annotations }) => annotations)).toEqual(
      Array.from({ length: 6 }, () => ({ untrustedContentHint: true })),
    );
    expect(JSON.stringify(definitions)).not.toMatch(
      /holdToken|idempotencyKey|serviceRoleKey/i,
    );
    expect(
      contractValidators.providerToolHoldInput({
        browserSessionId: "browser",
        clientRequestId: "request",
        idempotencyKey: "must-not-be-public",
        inventoryVersion: "1",
        quantity: 1,
        schemaVersion: SCHEMA_VERSION,
        slotId: "slot",
      }),
    ).toBe(false);
  });

  it("T067 completes hold, unknown-confirm reconciliation, and a three-reference receipt", async () => {
    const { definitions, workflows } = createHarness();
    const composed = await compose(definitions);
    const prepared = await prepareHold(definitions, composed);
    const operations = requireOperations(prepared);
    expect(JSON.stringify(prepared)).not.toMatch(/idempotencyKey|holdToken/i);

    const held = await execute(definitions, "hub_record_bundle_hold_results", {
      bundleHoldId: "bundle-hold-direct",
      bundleSessionId: "bundle-session-direct",
      providerResults: holdResults(operations),
      schemaVersion: SCHEMA_VERSION,
    });
    const heldData = requireData(held);
    expect(heldData).toMatchObject({
      bundleHoldId: "bundle-hold-direct",
      expiresAt: "2030-05-17T09:01:20Z",
      status: "HELD",
    });

    const confirmationPlan = await execute(
      definitions,
      "hub_prepare_bundle_confirmation",
      {
        bundleHoldId: "bundle-hold-direct",
        bundleSessionId: "bundle-session-direct",
        schemaVersion: SCHEMA_VERSION,
      },
    );
    const confirmationOperations = requireOperations(confirmationPlan);
    const firstAttempt = await execute(
      definitions,
      "hub_record_confirmation_results",
      {
        bundleHoldId: "bundle-hold-direct",
        bundleSessionId: "bundle-session-direct",
        providerResults: confirmationOperations.map((operation) => ({
          provider: operation.provider,
          result:
            operation.provider === "nori"
              ? failure("nori", "PROVIDER_TIMEOUT")
              : success(operation.provider, {
                  confirmedAt: "2030-05-17T09:00:15Z",
                  holdSafeReference: operation.input.holdSafeReference,
                  provider: operation.provider,
                  reservationRef: `reservation-${operation.provider}`,
                  status: "CONFIRMED",
                }),
        })),
        schemaVersion: SCHEMA_VERSION,
      },
    );
    expect(requireData(firstAttempt).status).toBe("RECONCILIATION_REQUIRED");
    const statusOps = requireOperations(firstAttempt, "statusOperations");
    expect(statusOps).toHaveLength(3);

    const reconciled = await execute(
      definitions,
      "hub_record_confirmation_results",
      {
        bundleHoldId: "bundle-hold-direct",
        bundleSessionId: "bundle-session-direct",
        providerResults: statusOps.map((operation, index) => ({
          provider: operation.provider,
          result: success(operation.provider, {
            expiresAt: `2030-05-17T09:01:${20 + index}Z`,
            holdSafeReference: operation.input.holdSafeReference,
            provider: operation.provider,
            reservationRef: `reservation-${operation.provider}`,
            slotId: operations[index]?.input.slotId,
            status: "CONFIRMED",
          }),
        })),
        schemaVersion: SCHEMA_VERSION,
      },
    );
    const receipt = requireData(reconciled);
    expect(receipt.status).toBe("CONFIRMED");
    expect(receipt.reservations).toHaveLength(3);
    expect(contractValidators.confirmBundleData(receipt)).toBe(true);
    expect(workflows.getHeld("bundle-session-direct")).toBeUndefined();
    expect(JSON.stringify(receipt)).not.toMatch(/idempotencyKey|holdToken/i);
  });

  it("T067 compensates every partial success and never auto-holds the replacement", async () => {
    const { candidates, definitions, workflows } = createHarness();
    const composed = await compose(definitions);
    const prepared = await prepareHold(definitions, composed);
    const operations = requireOperations(prepared);
    const recovery = await execute(
      definitions,
      "hub_record_bundle_hold_results",
      {
        bundleHoldId: "bundle-hold-direct",
        bundleSessionId: "bundle-session-direct",
        providerResults: holdResults(operations, "loop"),
        schemaVersion: SCHEMA_VERSION,
      },
    );
    const recoveryData = requireData(recovery);
    expect(recoveryData.status).toBe("RECOVERY_REQUIRED");
    expect(recoveryData.failedProviders).toEqual(["loop"]);
    const releases = requireOperations(recovery, "releaseOperations");
    expect(releases.map(({ provider }) => provider)).toEqual(["kiln", "nori"]);
    expect(workflows.getHeld("bundle-session-direct")).toBeUndefined();

    const incomplete = await execute(
      definitions,
      "hub_record_release_results",
      {
        bundleHoldId: "bundle-hold-direct",
        bundleSessionId: "bundle-session-direct",
        providerResults: releases.map((operation) => ({
          provider: operation.provider,
          result:
            operation.provider === "nori"
              ? failure("nori", "PROVIDER_TIMEOUT")
              : success(operation.provider, {
                  capacityRestored: true,
                  holdSafeReference: operation.input.holdSafeReference,
                  provider: operation.provider,
                  slotId: operations.find(
                    ({ provider }) => provider === operation.provider,
                  )?.input.slotId,
                  status: "RELEASED",
                }),
        })),
        schemaVersion: SCHEMA_VERSION,
      },
    );
    expect(incomplete).toMatchObject({
      error: { code: "COMPENSATION_INCOMPLETE" },
      ok: false,
    });

    const compensated = await execute(
      definitions,
      "hub_record_release_results",
      {
        bundleHoldId: "bundle-hold-direct",
        bundleSessionId: "bundle-session-direct",
        providerResults: releases.map((operation) => ({
          provider: operation.provider,
          result: success(operation.provider, {
            capacityRestored: true,
            holdSafeReference: operation.input.holdSafeReference,
            provider: operation.provider,
            slotId: operations.find(
              ({ provider }) => provider === operation.provider,
            )?.input.slotId,
            status: "RELEASED",
          }),
        })),
        schemaVersion: SCHEMA_VERSION,
      },
    );
    const compensatedData = requireData(compensated);
    expect(compensatedData.status).toBe("COMPENSATED");
    expect(compensatedData.replacementBundle).not.toBeNull();
    const replacement = compensatedData.replacementBundle as {
      bundleId: string;
    };
    expect(candidates.get("bundle-session-direct")?.selectedBundleId).toBe(
      replacement.bundleId,
    );
    expect(workflows.getHeld("bundle-session-direct")).toBeUndefined();
  });

  it("T067 prepares and verifies an explicit three-Provider user release", async () => {
    const { definitions, workflows } = createHarness();
    const composed = await compose(definitions);
    const prepared = await prepareHold(definitions, composed);
    const holdOperations = requireOperations(prepared);
    await execute(definitions, "hub_record_bundle_hold_results", {
      bundleHoldId: "bundle-hold-direct",
      bundleSessionId: "bundle-session-direct",
      providerResults: holdResults(holdOperations),
      schemaVersion: SCHEMA_VERSION,
    });

    const releasePlan = await execute(
      definitions,
      "hub_prepare_bundle_release",
      {
        bundleHoldId: "bundle-hold-direct",
        bundleSessionId: "bundle-session-direct",
        reason: "USER_CANCELLED",
        schemaVersion: SCHEMA_VERSION,
      },
    );
    const releases = requireOperations(releasePlan);
    expect(releases).toHaveLength(3);
    expect(
      releases.every(({ input }) => input.reason === "USER_CANCELLED"),
    ).toBe(true);

    const released = await execute(definitions, "hub_record_release_results", {
      bundleHoldId: "bundle-hold-direct",
      bundleSessionId: "bundle-session-direct",
      providerResults: releases.map((operation) => ({
        provider: operation.provider,
        result: success(operation.provider, {
          capacityRestored: true,
          holdSafeReference: operation.input.holdSafeReference,
          provider: operation.provider,
          slotId: holdOperations.find(
            ({ provider }) => provider === operation.provider,
          )?.input.slotId,
          status: "RELEASED",
        }),
      })),
      schemaVersion: SCHEMA_VERSION,
    });
    const releasedData = requireData(released);
    expect(releasedData.status).toBe("RELEASED");
    expect(releasedData.providerStatuses).toHaveLength(3);
    expect(contractValidators.releaseBundleData(releasedData)).toBe(true);
    expect(workflows.getHeld("bundle-session-direct")).toBeUndefined();
  });

  it("rejects duplicate Provider identities and exact-origin mismatches before composition", async () => {
    const { candidates, definitions } = createHarness();
    const duplicateResults = PROVIDERS.map((provider) => ({
      provider,
      result: success(provider, {
        inventoryAsOf: "2030-05-17T08:59:00Z",
        provider,
        slots: canonicalSlotsByProvider[provider],
      }),
    }));
    duplicateResults[2] = duplicateResults[0]!;
    const duplicate = await execute(
      definitions,
      "hub_compose_provider_results",
      {
        intent: canonicalIntent,
        providerResults: duplicateResults,
        schemaVersion: SCHEMA_VERSION,
      },
    );
    expect(duplicate).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
      ok: false,
    });

    const wrongOriginResults = PROVIDERS.map((provider) => ({
      provider,
      result: {
        ...success(provider, {
          inventoryAsOf: "2030-05-17T08:59:00Z",
          provider,
          slots: canonicalSlotsByProvider[provider],
        }),
        meta: { ...meta(provider), origin: "https://attacker.test" },
      },
    }));
    const wrongOrigin = await execute(
      definitions,
      "hub_compose_provider_results",
      {
        intent: canonicalIntent,
        providerResults: wrongOriginResults,
        schemaVersion: SCHEMA_VERSION,
      },
    );
    expect(wrongOrigin).toMatchObject({
      error: { code: "ORIGIN_MISMATCH" },
      ok: false,
    });
    expect(candidates.get("bundle-session-direct")).toBeUndefined();
  });
});

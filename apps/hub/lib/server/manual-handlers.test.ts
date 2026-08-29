import { composeBundles } from "@serendipity/bundle-engine";
import {
  type Provider,
  type ProviderConfirmData,
  type ProviderHoldData,
  type ProviderHoldStatusData,
  type ProviderReleaseData,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { describe, expect, it, vi } from "vitest";

import type { ProviderGateway } from "../provider-gateways/types";
import type { LoadedHeldWorkflow } from "./workflow-persistence";
import type { ManualWorkflowRuntime } from "./manual-runtime";
import { handleManualConfirm, handleManualHold } from "./manual-handlers";

const providers: readonly Provider[] = ["kiln", "nori", "loop"];

describe("manual workflow handlers", () => {
  it("holds, encrypts through persistence, reloads by cookie, and confirms without public secrets", async () => {
    const composed = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: canonicalSlotsByProvider,
      travelTimes: canonicalTravelTimes,
    });
    if (!composed.ok || !composed.candidates[0]) {
      throw new Error("candidate missing");
    }
    const bundleSessionId = "50000000-0000-4000-8000-000000000001";
    const candidateSession = {
      bundleSessionId,
      bundleVersion: 1,
      candidates: composed.candidates,
      intent: canonicalIntent,
      selectedBundleId: composed.candidates[0].bundleId,
    };
    let loaded: LoadedHeldWorkflow | null = null;
    const persistHeld = vi.fn(
      (input: {
        candidateSession: typeof candidateSession;
        heldSession: LoadedHeldWorkflow["heldSession"];
        rawTokens?: Partial<Record<Provider, string>>;
      }) => {
        loaded = {
          candidateSession: input.candidateSession,
          heldSession: input.heldSession,
          rawTokens: input.rawTokens ?? {},
        };
        return Promise.resolve();
      },
    );
    const markTerminal = vi.fn(() => Promise.resolve());
    const runtimeFactory = (): ManualWorkflowRuntime => ({
      createGateways(vault) {
        return Object.fromEntries(
          providers.map((provider, index) => [
            provider,
            {
              provider,
              search: () => Promise.reject(new Error("not used")),
              hold: (input) => {
                const safeReference = input.clientRequestId;
                return Promise.resolve(
                  vault.save(
                    provider,
                    safeReference,
                    `private-${provider}-token`,
                  ),
                ).then(() => ({
                  data: {
                    expiresAt: `2030-05-17T09:01:${20 + index}Z`,
                    holdSafeReference: safeReference,
                    provider,
                    slotId: input.slotId,
                    status: "HELD",
                  } satisfies ProviderHoldData,
                  meta: {
                    completedAt: "2030-05-17T09:00:00Z",
                    correlationId: `hold-${provider}`,
                    origin: `https://${provider}.test`,
                  },
                  ok: true as const,
                }));
              },
              getHoldStatus: (input) =>
                Promise.resolve({
                  data: {
                    expiresAt: "2030-05-17T09:01:20Z",
                    holdSafeReference: input.holdSafeReference!,
                    provider,
                    slotId: composed.candidates[0]!.items[index]!.slot.slotId,
                    status: "HELD",
                  } satisfies ProviderHoldStatusData,
                  meta: {
                    completedAt: "2030-05-17T09:00:00Z",
                    correlationId: `status-${provider}`,
                    origin: `https://${provider}.test`,
                  },
                  ok: true as const,
                }),
              confirm: (input) =>
                Promise.resolve({
                  data: {
                    confirmedAt: "2030-05-17T09:00:10Z",
                    holdSafeReference: input.holdSafeReference,
                    provider,
                    reservationRef: `reservation-${provider}`,
                    status: "CONFIRMED",
                  } satisfies ProviderConfirmData,
                  meta: {
                    completedAt: "2030-05-17T09:00:10Z",
                    correlationId: `confirm-${provider}`,
                    origin: `https://${provider}.test`,
                  },
                  ok: true as const,
                }),
              release: (input) =>
                Promise.resolve({
                  data: {
                    capacityRestored: true,
                    holdSafeReference: input.holdSafeReference,
                    provider,
                    slotId: composed.candidates[0]!.items[index]!.slot.slotId,
                    status: "RELEASED",
                  } satisfies ProviderReleaseData,
                  meta: {
                    completedAt: "2030-05-17T09:00:10Z",
                    correlationId: `release-${provider}`,
                    origin: `https://${provider}.test`,
                  },
                  ok: true as const,
                }),
            } satisfies ProviderGateway,
          ]),
        ) as unknown as ReturnType<ManualWorkflowRuntime["createGateways"]>;
      },
      hubOrigin: "https://hub.test",
      repository: {
        loadHeld: () => Promise.resolve(loaded),
        markTerminal,
        persistHeld,
      },
    });

    const holdResponse = await handleManualHold(
      new Request("https://hub.test/api/manual/hold", {
        body: JSON.stringify({
          schemaVersion: "1",
          bundleSessionId,
          bundleId: candidateSession.selectedBundleId,
          bundleVersion: 1,
          bundleSession: candidateSession,
        }),
        method: "POST",
      }),
      undefined,
      runtimeFactory,
    );
    expect(holdResponse.status).toBe(200);
    const holdBody = JSON.stringify(await holdResponse.json());
    expect(holdBody).not.toMatch(/private-|holdToken|idempotencyKey/i);
    expect(persistHeld).toHaveBeenCalledOnce();
    const cookie = holdResponse.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toMatch(/^serendipity-session=/);

    const confirmResponse = await handleManualConfirm(
      new Request("https://hub.test/api/manual/confirm", {
        body: JSON.stringify({
          schemaVersion: "1",
          bundleSessionId,
          bundleHoldId: bundleSessionId,
        }),
        headers: { cookie: cookie! },
        method: "POST",
      }),
      runtimeFactory,
    );
    expect(confirmResponse.status).toBe(200);
    const confirmBody = JSON.stringify(await confirmResponse.json());
    expect(confirmBody).toContain("CONFIRMED");
    expect(confirmBody).not.toMatch(/private-|holdToken|idempotencyKey/i);
    expect(markTerminal).toHaveBeenCalledOnce();
  });
});

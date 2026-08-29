import {
  contractValidators,
  type ConfirmBundleData,
  type HoldBundleData,
  type ReleaseBundleData,
} from "@serendipity/contracts";
import { describe, expect, it } from "vitest";

import type { HeldBundleSession } from "../orchestrator/hold";
import { CandidateSessionStore } from "../selection";
import {
  HeldSessionStore,
  createHubReservationToolDefinitions,
} from "./reservation-tools";

const heldSession = {
  browserSessionId: "20000000-0000-4000-8000-000000000001",
  bundle: { bundleId: "bundle-1" },
  bundleHoldId: "60000000-0000-4000-8000-000000000001",
  bundleSessionId: "50000000-0000-4000-8000-000000000001",
  expiresAt: "2030-05-17T09:01:20Z",
  providerHolds: [],
} as unknown as HeldBundleSession;

const holdData: HoldBundleData = {
  bundleHoldId: heldSession.bundleHoldId,
  bundleId: "bundle-1",
  expiresAt: heldSession.expiresAt,
  providerHolds: ["kiln", "nori", "loop"].map((provider, index) => ({
    holdSafeReference: `safe-${index}`,
    provider: provider as "kiln" | "nori" | "loop",
    status: "HELD" as const,
  })),
  status: "HELD",
};

describe("Hub reservation tools", () => {
  it("defines exactly three secret-free mutation tools", () => {
    const definitions = createHubReservationToolDefinitions({
      browserSessionId: heldSession.browserSessionId,
      candidates: new CandidateSessionStore(),
      confirm: () => Promise.reject(new Error("not used")),
      held: new HeldSessionStore(),
      hold: () => Promise.reject(new Error("not used")),
      hubOrigin: "https://hub.test",
      release: () => Promise.reject(new Error("not used")),
    });

    expect(definitions.map(({ name }) => name)).toEqual([
      "hold_bundle",
      "confirm_bundle",
      "release_bundle",
    ]);
    for (const definition of definitions) {
      expect(definition.annotations).toEqual({ untrustedContentHint: true });
      expect(JSON.stringify(definition)).not.toMatch(/holdToken|secret/i);
    }
  });

  it("returns validated confirm and release envelopes from held state", async () => {
    const confirmData: ConfirmBundleData = {
      bundleId: "bundle-1",
      confirmedAt: "2030-05-17T09:00:10Z",
      reservations: ["kiln", "nori", "loop"].map((provider) => ({
        provider: provider as "kiln" | "nori" | "loop",
        reservationRef: `reservation-${provider}`,
      })),
      status: "CONFIRMED",
      totalPriceYen: 4500,
    };
    const releaseData: ReleaseBundleData = {
      bundleId: "bundle-1",
      providerStatuses: ["kiln", "nori", "loop"].map((provider) => ({
        provider: provider as "kiln" | "nori" | "loop",
        status: "RELEASED" as const,
      })),
      status: "RELEASED",
    };
    const held = new HeldSessionStore();
    held.save(heldSession);
    const definitions = createHubReservationToolDefinitions({
      browserSessionId: heldSession.browserSessionId,
      candidates: new CandidateSessionStore(),
      confirm: () => Promise.resolve({ data: confirmData, ok: true }),
      held,
      hold: () => Promise.resolve({ data: holdData, heldSession, ok: true }),
      hubOrigin: "https://hub.test",
      release: () => Promise.resolve({ data: releaseData, ok: true }),
    });
    const confirmEnvelope = JSON.parse(
      await definitions[1].execute({
        schemaVersion: "1",
        bundleSessionId: heldSession.bundleSessionId,
        bundleHoldId: heldSession.bundleHoldId,
      }),
    ) as { data?: unknown; ok?: boolean };
    expect(confirmEnvelope.ok).toBe(true);
    expect(contractValidators.confirmBundleData(confirmEnvelope.data)).toBe(
      true,
    );

    held.save(heldSession);
    const releaseEnvelope = JSON.parse(
      await definitions[2].execute({
        schemaVersion: "1",
        bundleSessionId: heldSession.bundleSessionId,
        bundleHoldId: heldSession.bundleHoldId,
        reason: "USER_CANCELLED",
      }),
    ) as { data?: unknown; ok?: boolean };
    expect(releaseEnvelope.ok).toBe(true);
    expect(contractValidators.releaseBundleData(releaseEnvelope.data)).toBe(
      true,
    );
  });
});

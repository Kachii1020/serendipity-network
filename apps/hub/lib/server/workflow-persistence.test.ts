import { composeBundles } from "@serendipity/bundle-engine";
import type { Provider } from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { describe, expect, it, vi } from "vitest";

import type { HeldBundleSession } from "../orchestrator/hold";
import type { CandidateSession } from "../selection";
import {
  createWorkflowRepository,
  type StoredHeldWorkflow,
  type WorkflowPersistenceStorage,
} from "./workflow-persistence";

const browserSessionId = "20000000-0000-4000-8000-000000000001";
const bundleSessionId = "50000000-0000-4000-8000-000000000001";
const encryptionKey = Buffer.alloc(32, 9).toString("base64url");

const fixture = async (): Promise<{
  candidateSession: CandidateSession;
  heldSession: HeldBundleSession;
}> => {
  const composed = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!composed.ok || !composed.candidates[0]) {
    throw new Error("candidate missing");
  }
  const bundle = composed.candidates[0];
  const candidateSession: CandidateSession = {
    bundleSessionId,
    bundleVersion: 1,
    candidates: composed.candidates,
    intent: canonicalIntent,
    selectedBundleId: bundle.bundleId,
  };
  return {
    candidateSession,
    heldSession: {
      browserSessionId,
      bundle,
      bundleHoldId: bundleSessionId,
      bundleSessionId,
      expiresAt: "2030-05-17T09:01:20Z",
      providerHolds: bundle.items.map(({ slot }, index) => ({
        expiresAt: "2030-05-17T09:01:20Z",
        holdSafeReference: `safe-reference-${index}`,
        provider: slot.provider,
        slotId: slot.slotId,
      })),
    },
  };
};

const createStorage = () => {
  let stored: StoredHeldWorkflow | null = null;
  const markTerminal = vi.fn(() => Promise.resolve());
  const storage: WorkflowPersistenceStorage = {
    insertHeld: vi.fn((record: StoredHeldWorkflow) => {
      stored = record;
      return Promise.resolve();
    }),
    loadOwned: vi.fn((id: string, browserId: string) =>
      Promise.resolve(
        stored?.bundleSessionId === id && stored.browserSessionId === browserId
          ? stored
          : null,
      ),
    ),
    markTerminal,
  };
  return { getStored: () => stored, markTerminal, storage };
};

describe("workflow persistence", () => {
  it("encrypts all manual tokens and restores them only for the owning browser session", async () => {
    const { candidateSession, heldSession } = await fixture();
    const { getStored, storage } = createStorage();
    const repository = createWorkflowRepository(storage, encryptionKey);
    const rawTokens: Record<Provider, string> = {
      kiln: "private-kiln-token",
      nori: "private-nori-token",
      loop: "private-loop-token",
    };

    await repository.persistHeld({ candidateSession, heldSession, rawTokens });
    const serialized = JSON.stringify(getStored());
    expect(serialized).not.toContain("private-kiln-token");
    expect(serialized).not.toContain("private-nori-token");
    expect(serialized).not.toContain("private-loop-token");

    await expect(
      repository.loadHeld(
        bundleSessionId,
        "20000000-0000-4000-8000-000000000099",
      ),
    ).resolves.toBeNull();
    const loaded = await repository.loadHeld(bundleSessionId, browserSessionId);
    expect(loaded?.rawTokens).toEqual(rawTokens);
    expect(JSON.stringify(loaded?.heldSession)).not.toMatch(/token/i);
  });

  it("clears encrypted authority when a workflow becomes terminal", async () => {
    const { markTerminal, storage } = createStorage();
    const repository = createWorkflowRepository(storage, encryptionKey);
    await repository.markTerminal(
      bundleSessionId,
      browserSessionId,
      "confirmed",
      {
        kiln: "CONFIRMED",
        nori: "CONFIRMED",
        loop: "CONFIRMED",
      },
    );
    expect(markTerminal).toHaveBeenCalledWith(
      bundleSessionId,
      browserSessionId,
      "confirmed",
      { kiln: "CONFIRMED", nori: "CONFIRMED", loop: "CONFIRMED" },
    );
  });
});

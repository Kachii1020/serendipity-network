import { composeBundles } from "@serendipity/bundle-engine";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { describe, expect, it, vi } from "vitest";

import { createBundleSessionRepository } from "./bundle-session-persistence";

describe("bundle session persistence", () => {
  it("validates immutable snapshots and scopes reloads to the browser session", async () => {
    const composed = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: canonicalSlotsByProvider,
      travelTimes: canonicalTravelTimes,
    });
    if (!composed.ok) throw new Error("fixture should compose");

    const insertSession = vi.fn<(row: unknown) => Promise<void>>();
    insertSession.mockResolvedValue(undefined);
    const findOwnedSession =
      vi.fn<(id: string, browserId: string) => Promise<unknown>>();
    findOwnedSession.mockResolvedValue({
      id: "50000000-0000-4000-8000-000000000001",
    });
    const repository = createBundleSessionRepository({
      findOwnedSession,
      insertSession,
    });

    await repository.create({
      browserSessionId: "20000000-0000-4000-8000-000000000001",
      bundleSessionId: "50000000-0000-4000-8000-000000000001",
      candidateBundles: composed.candidates,
      intent: canonicalIntent,
    });
    expect(insertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        browser_session_id: "20000000-0000-4000-8000-000000000001",
        candidate_set_version: 1,
        phase: "composed",
      }),
    );
    expect(JSON.stringify(insertSession.mock.calls[0]?.[0])).not.toContain(
      "rawPrompt",
    );

    await repository.loadOwned(
      "50000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001",
    );
    expect(findOwnedSession).toHaveBeenCalledWith(
      "50000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001",
    );
  });

  it("rejects unvalidated snapshots before storage", async () => {
    const insertSession = vi.fn<(row: unknown) => Promise<void>>();
    insertSession.mockResolvedValue(undefined);
    const findOwnedSession =
      vi.fn<(id: string, browserId: string) => Promise<unknown>>();
    findOwnedSession.mockResolvedValue(null);
    const repository = createBundleSessionRepository({
      findOwnedSession,
      insertSession,
    });
    await expect(
      repository.create({
        browserSessionId: "20000000-0000-4000-8000-000000000001",
        bundleSessionId: "50000000-0000-4000-8000-000000000001",
        candidateBundles: [{ holdToken: "private" }],
        intent: canonicalIntent,
      }),
    ).rejects.toThrow("candidate bundle");
    expect(insertSession).not.toHaveBeenCalled();
  });
});

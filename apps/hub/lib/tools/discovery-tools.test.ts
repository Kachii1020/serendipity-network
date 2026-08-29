import { SCHEMA_VERSION, contractValidators } from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { composeBundles } from "@serendipity/bundle-engine";
import { describe, expect, it } from "vitest";

import {
  CandidateSessionStore,
  createBundleViewModel,
  selectCandidate,
} from "../selection";
import { createHubDiscoveryToolDefinitions } from "./discovery-tools";

const canonicalSession = async () => {
  const composed = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!composed.ok) throw new Error("canonical bundle missing");
  return {
    bundleSessionId: "bundle-session-tools",
    bundleVersion: 1,
    candidates: composed.candidates,
    intent: canonicalIntent,
    selectedBundleId: composed.candidates[0]?.bundleId ?? "",
  };
};

describe("Hub discovery tools and selection", () => {
  it("registers exactly the two read-only nested discovery tools", () => {
    const definitions = createHubDiscoveryToolDefinitions({
      discover: () =>
        Promise.resolve({
          ok: false,
          error: {
            code: "NO_VALID_BUNDLE",
            message: "No route found.",
            retryable: true,
          },
          providerStatuses: {
            kiln: "ONLINE",
            nori: "ONLINE",
            loop: "ONLINE",
          },
        }),
      hubOrigin: "https://hub.test",
      sessions: new CandidateSessionStore(),
    });

    expect(definitions.map(({ name }) => name)).toEqual([
      "find_serendipity_options",
      "show_bundle",
    ]);
    for (const definition of definitions) {
      expect(definition.annotations).toEqual({
        readOnlyHint: true,
        untrustedContentHint: true,
      });
    }
  });

  it("stores a validated ephemeral candidate set and rejects stale show requests", async () => {
    const session = await canonicalSession();
    const sessions = new CandidateSessionStore();
    const definitions = createHubDiscoveryToolDefinitions({
      discover: () =>
        Promise.resolve({
          ok: true,
          data: {
            alternatives: session.candidates.slice(1),
            bundleSessionId: session.bundleSessionId,
            bundleVersion: session.bundleVersion,
            providerStatuses: {
              kiln: "ONLINE",
              nori: "ONLINE",
              loop: "ONLINE",
            },
            selectedBundle: session.candidates[0]!,
          },
          session,
        }),
      hubOrigin: "https://hub.test",
      sessions,
    });
    const [find, show] = definitions;

    const findEnvelope = JSON.parse(
      await find.execute(canonicalIntent),
    ) as Record<string, unknown>;
    expect(contractValidators.providerResultEnvelope(findEnvelope)).toBe(true);
    expect(sessions.get(session.bundleSessionId)).toEqual(session);

    const selected = session.candidates[1]!;
    const showEnvelope = JSON.parse(
      await show.execute({
        schemaVersion: SCHEMA_VERSION,
        bundleSessionId: session.bundleSessionId,
        bundleId: selected.bundleId,
        bundleVersion: selected.bundleVersion,
      }),
    ) as { ok: boolean; data?: unknown };
    expect(showEnvelope.ok).toBe(true);
    expect(contractValidators.showBundleData(showEnvelope.data)).toBe(true);
    expect(sessions.get(session.bundleSessionId)?.selectedBundleId).toBe(
      selected.bundleId,
    );

    const staleEnvelope = JSON.parse(
      await show.execute({
        schemaVersion: SCHEMA_VERSION,
        bundleSessionId: session.bundleSessionId,
        bundleId: selected.bundleId,
        bundleVersion: selected.bundleVersion + 1,
      }),
    ) as { ok: boolean; error?: { code?: string } };
    expect(staleEnvelope).toMatchObject({
      ok: false,
      error: { code: "STALE_BUNDLE" },
    });
    expect(sessions.get(session.bundleSessionId)?.selectedBundleId).toBe(
      selected.bundleId,
    );
  });

  it("changes only a valid selection and derives deterministic timeline/map reasons", async () => {
    const session = await canonicalSession();
    const alternative = session.candidates[1]!;
    const changed = selectCandidate(session, {
      bundleId: alternative.bundleId,
      bundleVersion: alternative.bundleVersion,
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) throw new Error("expected valid selection");
    expect(changed.session.selectedBundleId).toBe(alternative.bundleId);

    const stale = selectCandidate(changed.session, {
      bundleId: "unknown-bundle",
      bundleVersion: alternative.bundleVersion,
    });
    expect(stale).toEqual({ ok: false, code: "STALE_BUNDLE" });

    const view = createBundleViewModel(alternative);
    expect(view.timeline).toHaveLength(3);
    expect(view.timeline.map((stop) => stop.provider)).toEqual([
      "kiln",
      "nori",
      "loop",
    ]);
    expect(view.map.points).toHaveLength(3);
    expect(view.map.segments).toHaveLength(2);
    expect(view.explanation.length).toBeLessThanOrEqual(400);
    expect(
      view.explanation.split(/[.!?](?:\s|$)/).filter(Boolean).length,
    ).toBeLessThanOrEqual(2);
  });
});

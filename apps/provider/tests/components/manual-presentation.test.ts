import { describe, expect, it } from "vitest";

import {
  acceptManualBind,
  acceptManualPresentation,
} from "../../lib/manual-presentation";

const context = {
  browserSessionId: "20000000-0000-4000-8000-000000000001",
  frameInstanceId: "70000000-0000-4000-8000-000000000001",
  hubOrigin: "https://hub.test",
  provider: "kiln" as const,
  sourceIsParent: true,
};

const bind = {
  type: "serendipity.bind-session.v1",
  schemaVersion: "1",
  provider: "kiln",
  frameInstanceId: context.frameInstanceId,
  browserSessionId: context.browserSessionId,
};

const state = {
  type: "serendipity.provider-state.v1",
  schemaVersion: "1",
  provider: "kiln",
  frameInstanceId: context.frameInstanceId,
  browserSessionId: context.browserSessionId,
  action: "HOLD",
  source: "manual",
  status: "HELD",
  expiresAt: "2030-05-17T09:01:20Z",
  correlationId: "manual-hold-1",
};

describe("manual Provider presentation channel", () => {
  it("accepts an exact bind and maps a safe state message to presentation only", () => {
    expect(acceptManualBind(bind, "https://hub.test", context)).toBe(true);
    expect(
      acceptManualPresentation(state, "https://hub.test", context),
    ).toEqual({
      connectionLabel: "Manual connection",
      latestAction: "Activity held for the current session",
      operationLabel: "Held",
    });
  });

  it("labels a Hub Site Tool request without claiming iframe execution", () => {
    const presentation = acceptManualPresentation(
      { ...state, action: "SEARCH", source: "site-tool", status: "QUERYING" },
      "https://hub.test",
      context,
    );

    expect(presentation).toEqual({
      connectionLabel: "Live site",
      latestAction: "Hub Site Tool requested the Provider API",
      operationLabel: "Checking",
    });
    expect(presentation?.latestAction).not.toMatch(/iframe|embedded tool/i);
  });

  it("rejects wrong origin, frame, session, source, Provider, and extra fields", () => {
    expect(acceptManualBind(bind, "https://attacker.test", context)).toBe(
      false,
    );
    for (const poisoned of [
      { ...state, frameInstanceId: "70000000-0000-4000-8000-000000000099" },
      { ...state, browserSessionId: "20000000-0000-4000-8000-000000000099" },
      { ...state, provider: "nori" },
      { ...state, source: "iframe-tool" },
      Object.fromEntries(
        Object.entries(state).filter(([key]) => key !== "source"),
      ),
      { ...state, holdToken: "private" },
    ]) {
      expect(
        acceptManualPresentation(poisoned, "https://hub.test", context),
      ).toBeNull();
    }
    expect(
      acceptManualPresentation(state, "https://hub.test", {
        ...context,
        sourceIsParent: false,
      }),
    ).toBeNull();
  });
});

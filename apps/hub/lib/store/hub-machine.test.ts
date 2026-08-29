import { describe, expect, it } from "vitest";

import type { BundleSummary } from "@serendipity/contracts";

import {
  deriveHubUi,
  hubReducer,
  initialHubState,
  type HubState,
} from "./hub-machine";

const bundle = (id: string, version = 1): BundleSummary => ({
  bundleId: id,
  bundleVersion: version,
  items: [],
  totalPriceYen: 4500,
  totalTravelMinutes: 38,
  startsAt: "2030-05-17T18:15:00+09:00",
  endsAt: "2030-05-17T22:00:00+09:00",
  score: 72,
  scoreBreakdown: {
    preferenceFit: 1,
    novelty: 0.88,
    timeUtilization: 0.6,
    discount: 0.38,
    travelBurden: 0.63,
  },
  reasonCodes: ["MATCHES_PREFERENCES"],
});

const composedState = (): HubState =>
  hubReducer(hubReducer(initialHubState, { type: "DISCOVER" }), {
    type: "DISCOVER_SUCCEEDED",
    bundleSessionId: "session-1",
    candidates: [bundle("bundle-1"), bundle("bundle-2")],
  });

const heldState = (): HubState =>
  hubReducer(hubReducer(composedState(), { type: "HOLD_STARTED" }), {
    type: "HOLD_SUCCEEDED",
    expiresAt: "2030-05-17T18:01:30+09:00",
    holds: [
      { provider: "kiln", safeReference: "k-1" },
      { provider: "nori", safeReference: "n-1" },
      { provider: "loop", safeReference: "l-1" },
    ],
  });

const activeHolds = [
  { provider: "kiln" as const, safeReference: "k-1" },
  { provider: "nori" as const, safeReference: "n-1" },
  { provider: "loop" as const, safeReference: "l-1" },
];

describe("Hub state machine", () => {
  it("ST-001 accepts the canonical state path and derives one action", () => {
    const composed = composedState();
    const holding = hubReducer(composed, { type: "HOLD_STARTED" });
    const held = hubReducer(holding, {
      type: "HOLD_SUCCEEDED",
      expiresAt: "2030-05-17T18:01:30+09:00",
      holds: [
        { provider: "kiln", safeReference: "k-1" },
        { provider: "nori", safeReference: "n-1" },
        { provider: "loop", safeReference: "l-1" },
      ],
    });
    const confirming = hubReducer(held, { type: "CONFIRM_STARTED" });
    const confirmed = hubReducer(confirming, {
      type: "CONFIRM_SUCCEEDED",
      reservations: [
        { provider: "kiln", reservationRef: "K-1" },
        { provider: "nori", reservationRef: "N-1" },
        { provider: "loop", reservationRef: "L-1" },
      ],
    });

    expect([
      initialHubState.phase,
      composed.phase,
      holding.phase,
      held.phase,
      confirming.phase,
      confirmed.phase,
    ]).toEqual([
      "idle",
      "composed",
      "holding",
      "held",
      "confirming",
      "confirmed",
    ]);
    expect(deriveHubUi(held).primaryAction).toBe("confirm");
    expect(deriveHubUi(confirming).primaryAction).toBeNull();
  });

  it("ST-001 covers selection, empty, failure, expiry, and reconciliation branches", () => {
    const discovering = hubReducer(initialHubState, { type: "DISCOVER" });
    expect(
      hubReducer(discovering, {
        type: "DISCOVER_FAILED",
        errorCode: "PROVIDER_TIMEOUT",
      }).phase,
    ).toBe("error");
    expect(
      hubReducer(discovering, {
        type: "DISCOVER_SUCCEEDED",
        bundleSessionId: "empty-session",
        candidates: [],
      }).phase,
    ).toBe("no_results");

    const composed = composedState();
    const selected = hubReducer(composed, {
      type: "SELECT_BUNDLE",
      bundleId: "bundle-2",
      bundleVersion: 1,
    });
    expect(selected.selectedBundleId).toBe("bundle-2");
    expect(
      hubReducer(composed, {
        type: "SELECT_BUNDLE",
        bundleId: "bundle-2",
        bundleVersion: 99,
      }).errorCode,
    ).toBe("STALE_BUNDLE");

    const holding = hubReducer(composed, { type: "HOLD_STARTED" });
    expect(
      hubReducer(holding, {
        type: "HOLD_FAILED",
        errorCode: "SLOT_UNAVAILABLE",
      }).phase,
    ).toBe("error");
    const recovering = hubReducer(holding, {
      type: "HOLD_PARTIAL_FAILED",
      errorCode: "SLOT_UNAVAILABLE",
      successfulHolds: [{ provider: "kiln", safeReference: "k-1" }],
    });
    expect(
      hubReducer(recovering, {
        type: "RECOVERY_COMPLETED",
        candidates: [],
        compensationIncomplete: false,
      }).phase,
    ).toBe("no_results");

    const expired = hubReducer(heldState(), { type: "HOLD_EXPIRED" });
    expect(expired.phase).toBe("composed");
    expect(expired.requiresFreshSearch).toBe(true);

    const reconciling = hubReducer(
      hubReducer(heldState(), { type: "CONFIRM_STARTED" }),
      { type: "CONFIRM_UNKNOWN" },
    );
    expect(
      hubReducer(reconciling, {
        type: "RECONCILIATION_CONFIRMED",
        reservations: [
          { provider: "kiln", reservationRef: "K-1" },
          { provider: "nori", reservationRef: "N-1" },
          { provider: "loop", reservationRef: "L-1" },
        ],
      }).phase,
    ).toBe("confirmed");
    expect(
      hubReducer(reconciling, {
        type: "RECONCILIATION_FAILED",
        errorCode: "CONFIRMATION_INCONSISTENT",
      }).phase,
    ).toBe("error");
  });

  it("ST-002 rejects undocumented transitions without mutation", () => {
    expect(
      hubReducer(initialHubState, {
        type: "CONFIRM_SUCCEEDED",
        reservations: [],
      }),
    ).toBe(initialHubState);
  });

  it("ST-003/004 retains partial references through recovery then clears them", () => {
    const holding = hubReducer(composedState(), { type: "HOLD_STARTED" });
    const recovering = hubReducer(holding, {
      type: "HOLD_PARTIAL_FAILED",
      errorCode: "SLOT_UNAVAILABLE",
      successfulHolds: [{ provider: "kiln", safeReference: "k-1" }],
    });
    expect(recovering.phase).toBe("recovering");
    expect(recovering.activeHolds).toHaveLength(1);

    const recovered = hubReducer(recovering, {
      type: "RECOVERY_COMPLETED",
      candidates: [bundle("bundle-2", 2)],
      compensationIncomplete: false,
    });
    expect(recovered.phase).toBe("composed");
    expect(recovered.activeHolds).toEqual([]);
    expect(recovered.selectedBundleId).toBe("bundle-2");
  });

  it("ST-004 blocks actions when compensation is incomplete", () => {
    const holding = hubReducer(composedState(), { type: "HOLD_STARTED" });
    const recovering = hubReducer(holding, {
      type: "HOLD_PARTIAL_FAILED",
      errorCode: "SLOT_UNAVAILABLE",
      successfulHolds: [{ provider: "kiln", safeReference: "k-1" }],
    });
    const incomplete = hubReducer(recovering, {
      type: "RECOVERY_COMPLETED",
      candidates: [],
      compensationIncomplete: true,
    });
    expect(incomplete.phase).toBe("error");
    expect(incomplete.errorCode).toBe("COMPENSATION_INCOMPLETE");
    expect(deriveHubUi(incomplete).primaryAction).toBeNull();
  });

  it("ST-005 permits confirmation only from held", () => {
    const composed = composedState();
    expect(hubReducer(composed, { type: "CONFIRM_STARTED" })).toBe(composed);
    expect(deriveHubUi(composed).canConfirm).toBe(false);
  });

  it("ST-006 enters reconciliation rather than optimistic confirmation", () => {
    const holding = hubReducer(composedState(), { type: "HOLD_STARTED" });
    const held = hubReducer(holding, {
      type: "HOLD_SUCCEEDED",
      expiresAt: "2030-05-17T18:01:30+09:00",
      holds: [
        { provider: "kiln", safeReference: "k-1" },
        { provider: "nori", safeReference: "n-1" },
        { provider: "loop", safeReference: "l-1" },
      ],
    });
    const confirming = hubReducer(held, { type: "CONFIRM_STARTED" });
    const reconciling = hubReducer(confirming, { type: "CONFIRM_UNKNOWN" });
    expect(reconciling.phase).toBe("reconciling");
    expect(deriveHubUi(reconciling).primaryAction).toBe("check-status");
  });

  it("ST-007 clears active references on release/expiry", () => {
    const held = heldState();
    const releasing = hubReducer(held, { type: "RELEASE_STARTED" });
    const released = hubReducer(releasing, { type: "RELEASE_COMPLETED" });
    expect(releasing.phase).toBe("releasing");
    expect(releasing.activeHolds).toEqual(activeHolds);
    expect(deriveHubUi(releasing)).toEqual({
      primaryAction: null,
      canConfirm: false,
      isBusy: true,
    });
    expect(released.phase).toBe("composed");
    expect(released.activeHolds).toEqual([]);
    expect(released.requiresFreshSearch).toBe(true);

    expect(hubReducer(heldState(), { type: "RELEASE_COMPLETED" })).toEqual(
      heldState(),
    );
  });

  it("ST-009 fail-closes every user action while release is in flight", () => {
    const releasing = hubReducer(heldState(), { type: "RELEASE_STARTED" });

    expect(hubReducer(releasing, { type: "CONFIRM_STARTED" })).toBe(releasing);
    expect(hubReducer(releasing, { type: "DISCOVER" })).toBe(releasing);
    expect(hubReducer(releasing, { type: "HOLD_STARTED" })).toBe(releasing);
    expect(hubReducer(releasing, { type: "RELEASE_STARTED" })).toBe(releasing);
    expect(hubReducer(releasing, { type: "RESET" })).toBe(releasing);
  });

  it("ST-010 retains hold identity and permits only an explicit safe release retry", () => {
    const releasing = hubReducer(heldState(), { type: "RELEASE_STARTED" });
    const failed = hubReducer(releasing, {
      type: "RELEASE_FAILED",
      errorCode: "COMPENSATION_INCOMPLETE",
      retryAvailable: true,
    });

    expect(failed).toMatchObject({
      phase: "error",
      activeHolds,
      expiresAt: "2030-05-17T18:01:30+09:00",
      errorCode: "COMPENSATION_INCOMPLETE",
      releaseRetryAvailable: true,
    });
    expect(deriveHubUi(failed)).toEqual({
      primaryAction: "retry-release",
      canConfirm: false,
      isBusy: false,
    });
    expect(hubReducer(failed, { type: "CONFIRM_STARTED" })).toBe(failed);
    expect(hubReducer(failed, { type: "DISCOVER" })).toBe(failed);

    const retrying = hubReducer(failed, { type: "RELEASE_STARTED" });
    expect(retrying.phase).toBe("releasing");
    expect(retrying.activeHolds).toEqual(activeHolds);
    expect(retrying.releaseRetryAvailable).toBe(false);
  });

  it("ST-011 exposes status reconciliation instead of confirm for non-retryable release failure", () => {
    const failed = hubReducer(
      hubReducer(heldState(), { type: "RELEASE_STARTED" }),
      {
        type: "RELEASE_FAILED",
        errorCode: "ALREADY_CONFIRMED",
        retryAvailable: false,
      },
    );

    expect(failed.activeHolds).toEqual(activeHolds);
    expect(failed.releaseRetryAvailable).toBe(false);
    expect(deriveHubUi(failed).primaryAction).toBe("check-status");
    expect(hubReducer(failed, { type: "RELEASE_STARTED" })).toBe(failed);

    const checking = hubReducer(failed, { type: "RELEASE_STATUS_STARTED" });
    expect(checking.phase).toBe("reconciling");
    expect(hubReducer(checking, { type: "RELEASE_COMPLETED" }).phase).toBe(
      "composed",
    );
    const stillHeld = hubReducer(checking, { type: "RELEASE_STATUS_HELD" });
    expect(stillHeld).toMatchObject({
      phase: "error",
      releaseRetryAvailable: true,
    });

    const reconciledReleased = hubReducer(failed, {
      type: "RELEASE_COMPLETED",
    });
    expect(reconciledReleased.phase).toBe("composed");
    expect(reconciledReleased.activeHolds).toEqual([]);
    expect(reconciledReleased.requiresFreshSearch).toBe(true);
  });

  it("ST-012 blocks manual hold failure recovery until the compensation window elapses", () => {
    const holding = hubReducer(composedState(), { type: "HOLD_STARTED" });
    const blockedUntil = "2030-05-17T18:03:00+09:00";
    const blocked = hubReducer(holding, {
      type: "HOLD_FAILED",
      errorCode: "COMPENSATION_INCOMPLETE",
      compensationBlockedUntil: blockedUntil,
    });

    expect(blocked).toMatchObject({
      phase: "error",
      compensationIncomplete: true,
      compensationBlockedUntil: blockedUntil,
      releaseRetryAvailable: false,
    });
    expect(deriveHubUi(blocked).primaryAction).toBeNull();
    expect(hubReducer(blocked, { type: "DISCOVER" })).toBe(blocked);
    expect(hubReducer(blocked, { type: "RESET" })).toBe(blocked);
    expect(hubReducer(blocked, { type: "RELEASE_COMPLETED" })).toBe(blocked);
    expect(hubReducer(blocked, { type: "HOLD_EXPIRED" })).toBe(blocked);

    const elapsed = hubReducer(blocked, {
      type: "COMPENSATION_BLOCK_ELAPSED",
    });
    expect(elapsed).toMatchObject({
      phase: "error",
      activeHolds: [],
      expiresAt: null,
      compensationIncomplete: false,
      compensationBlockedUntil: null,
      requiresFreshSearch: true,
    });
    expect(deriveHubUi(elapsed).primaryAction).toBe("retry");
    expect(hubReducer(elapsed, { type: "DISCOVER" }).phase).toBe("discovering");
  });

  it("ST-013 restores a compensation block after reload and ignores elapsed without a block", () => {
    const blockedUntil = "2030-05-17T18:03:00+09:00";
    const restored = hubReducer(initialHubState, {
      type: "COMPENSATION_BLOCK_RESTORED",
      blockedUntil,
    });

    expect(restored).toMatchObject({
      phase: "error",
      errorCode: "COMPENSATION_INCOMPLETE",
      compensationIncomplete: true,
      compensationBlockedUntil: blockedUntil,
      requiresFreshSearch: true,
    });
    expect(deriveHubUi(restored).primaryAction).toBeNull();
    expect(
      hubReducer(initialHubState, { type: "COMPENSATION_BLOCK_ELAPSED" }),
    ).toBe(initialHubState);
  });

  it("ST-014 applies the same compensation window after partial recovery", () => {
    const recovering = hubReducer(
      hubReducer(composedState(), { type: "HOLD_STARTED" }),
      {
        type: "HOLD_PARTIAL_FAILED",
        errorCode: "SLOT_UNAVAILABLE",
        successfulHolds: [{ provider: "kiln", safeReference: "k-1" }],
      },
    );
    const blockedUntil = "2030-05-17T18:03:00+09:00";
    const blocked = hubReducer(recovering, {
      type: "RECOVERY_COMPLETED",
      candidates: [],
      compensationIncomplete: true,
      compensationBlockedUntil: blockedUntil,
    });

    expect(blocked.compensationBlockedUntil).toBe(blockedUntil);
    expect(blocked.activeHolds).toEqual([
      { provider: "kiln", safeReference: "k-1" },
    ]);
    expect(deriveHubUi(blocked).primaryAction).toBeNull();
    expect(hubReducer(blocked, { type: "RELEASE_COMPLETED" })).toBe(blocked);
    expect(hubReducer(blocked, { type: "HOLD_EXPIRED" })).toBe(blocked);
  });

  it("ST-008 reset returns a safe initial state", () => {
    expect(hubReducer(composedState(), { type: "RESET" })).toEqual(
      initialHubState,
    );
  });
});

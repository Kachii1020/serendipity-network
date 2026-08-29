import type { BundleSummary, Provider } from "@serendipity/contracts";

import type { HeldBundleSession, HeldProvider } from "../../orchestrator/hold";
import type { CandidateSession } from "../../selection";

export type DirectPendingHold = {
  browserSessionId: string;
  bundle: BundleSummary;
  bundleHoldId: string;
  bundleSession: CandidateSession;
  clientRequestIds: Record<Provider, string>;
};

export type DirectPendingRelease = {
  expectedHolds: readonly HeldProvider[];
  heldSession: HeldBundleSession;
  kind: "compensation" | "user";
  replacementBundle: BundleSummary | null;
};

export class DirectWorkflowStore {
  readonly #held = new Map<string, HeldBundleSession>();
  readonly #pendingHolds = new Map<string, DirectPendingHold>();
  readonly #pendingReleases = new Map<string, DirectPendingRelease>();

  clear(bundleSessionId: string): void {
    this.#held.delete(bundleSessionId);
    this.#pendingHolds.delete(bundleSessionId);
    this.#pendingReleases.delete(bundleSessionId);
  }

  getHeld(bundleSessionId: string): HeldBundleSession | undefined {
    return this.#held.get(bundleSessionId);
  }

  getPendingHold(bundleSessionId: string): DirectPendingHold | undefined {
    return this.#pendingHolds.get(bundleSessionId);
  }

  getPendingRelease(bundleSessionId: string): DirectPendingRelease | undefined {
    return this.#pendingReleases.get(bundleSessionId);
  }

  saveHeld(session: HeldBundleSession): void {
    this.#held.set(session.bundleSessionId, session);
  }

  savePendingHold(pending: DirectPendingHold): void {
    this.#pendingHolds.set(pending.bundleSession.bundleSessionId, pending);
  }

  savePendingRelease(pending: DirectPendingRelease): void {
    this.#pendingReleases.set(pending.heldSession.bundleSessionId, pending);
  }
}

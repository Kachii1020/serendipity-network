import {
  validateBundleSummary,
  validateIntent,
  type BundleSummary,
  type Intent,
  type Provider,
  type REASON_CODES,
} from "@serendipity/contracts";

export type CandidateSession = {
  bundleSessionId: string;
  bundleVersion: number;
  candidates: readonly BundleSummary[];
  intent: Intent;
  selectedBundleId: string;
};

type CandidateSelection = {
  bundleId: string;
  bundleVersion: number;
};

export class CandidateSessionStore {
  readonly #sessions = new Map<string, CandidateSession>();

  get(bundleSessionId: string): CandidateSession | undefined {
    return this.#sessions.get(bundleSessionId);
  }

  save(session: CandidateSession): void {
    const intent = validateIntent(session.intent);
    if (!intent.ok) throw new Error("candidate session intent is invalid");
    if (
      session.candidates.length < 1 ||
      session.candidates.length > 3 ||
      session.candidates.some(
        (candidate) =>
          !validateBundleSummary(candidate).ok ||
          candidate.bundleVersion !== session.bundleVersion,
      ) ||
      !session.candidates.some(
        ({ bundleId }) => bundleId === session.selectedBundleId,
      )
    ) {
      throw new Error("candidate session bundles are invalid");
    }
    this.#sessions.set(session.bundleSessionId, {
      ...session,
      candidates: [...session.candidates],
      intent: intent.value,
    });
  }

  select(
    bundleSessionId: string,
    selection: CandidateSelection,
  ):
    | { ok: true; session: CandidateSession; selectedBundle: BundleSummary }
    | { ok: false; code: "BUNDLE_NOT_FOUND" | "STALE_BUNDLE" } {
    const session = this.#sessions.get(bundleSessionId);
    if (!session) return { ok: false, code: "BUNDLE_NOT_FOUND" };
    const selected = selectCandidate(session, selection);
    if (selected.ok) this.#sessions.set(bundleSessionId, selected.session);
    return selected;
  }
}

export const selectCandidate = (
  session: CandidateSession,
  selection: CandidateSelection,
):
  | { ok: true; session: CandidateSession; selectedBundle: BundleSummary }
  | { ok: false; code: "STALE_BUNDLE" } => {
  if (selection.bundleVersion !== session.bundleVersion) {
    return { ok: false, code: "STALE_BUNDLE" };
  }
  const selectedBundle = session.candidates.find(
    ({ bundleId, bundleVersion }) =>
      bundleId === selection.bundleId &&
      bundleVersion === selection.bundleVersion,
  );
  if (!selectedBundle) return { ok: false, code: "STALE_BUNDLE" };
  return {
    ok: true,
    selectedBundle,
    session: { ...session, selectedBundleId: selectedBundle.bundleId },
  };
};

const reasonCopy: Record<(typeof REASON_CODES)[number], string> = {
  GOOD_VALUE: "unusually good value",
  HIGH_NOVELTY: "a strong sense of discovery",
  LOW_TRAVEL: "short travel between stops",
  MATCHES_PREFERENCES: "a close match to your interests",
  USES_TIME_WELL: "good use of the evening window",
};

export const explainBundle = (bundle: BundleSummary): string => {
  const strongestReason = bundle.reasonCodes[0];
  const reason = strongestReason
    ? reasonCopy[strongestReason]
    : "a balanced three-stop route";
  return `Three available stops fit into ¥${bundle.totalPriceYen.toLocaleString("en-US")} with ${bundle.totalTravelMinutes} minutes of travel. This option stands out for ${reason}.`;
};

export type BundleViewModel = {
  bundleId: string;
  explanation: string;
  map: {
    points: Array<{
      locationId: string;
      provider: Provider;
      x: number;
      y: number;
    }>;
    segments: Array<{
      fromLocationId: string;
      toLocationId: string;
      travelMinutes: number;
    }>;
  };
  reasonCodes: BundleSummary["reasonCodes"];
  timeline: Array<{
    endsAt: string;
    locationName: string;
    position: number;
    priceYen: number;
    provider: Provider;
    spareGapFromPreviousMinutes: number | null;
    startsAt: string;
    title: string;
    travelFromPreviousMinutes: number | null;
  }>;
  totalPriceYen: number;
  totalTravelMinutes: number;
};

export const createBundleViewModel = (
  bundle: BundleSummary,
): BundleViewModel => ({
  bundleId: bundle.bundleId,
  explanation: explainBundle(bundle),
  map: {
    points: bundle.items.map(({ slot }) => ({
      locationId: slot.location.locationId,
      provider: slot.provider,
      x: slot.location.mapX,
      y: slot.location.mapY,
    })),
    segments: bundle.items.slice(1).map((item, index) => ({
      fromLocationId:
        bundle.items[index]?.slot.location.locationId ??
        item.slot.location.locationId,
      toLocationId: item.slot.location.locationId,
      travelMinutes: item.travelFromPreviousMinutes ?? 0,
    })),
  },
  reasonCodes: bundle.reasonCodes,
  timeline: bundle.items.map((item) => ({
    endsAt: item.slot.endsAt,
    locationName: item.slot.location.name,
    position: item.position,
    priceYen: item.slot.priceYen,
    provider: item.slot.provider,
    spareGapFromPreviousMinutes: item.spareGapFromPreviousMinutes,
    startsAt: item.slot.startsAt,
    title: item.slot.title,
    travelFromPreviousMinutes: item.travelFromPreviousMinutes,
  })),
  totalPriceYen: bundle.totalPriceYen,
  totalTravelMinutes: bundle.totalTravelMinutes,
});

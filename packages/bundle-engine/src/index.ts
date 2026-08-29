import {
  SCHEMA_VERSION,
  type BundleSummary,
  type Intent,
  type Provider,
  type Slot,
} from "@serendipity/contracts";

export type SlotsByProvider = Readonly<Record<Provider, readonly Slot[]>>;
export type TravelTimes = Readonly<
  Record<string, Readonly<Record<string, number>>>
>;

export type ComposeBundlesInput = {
  bundleVersion: number;
  intent: Intent;
  slotsByProvider: SlotsByProvider;
  travelTimes: TravelTimes;
};

export type ComposeBundlesResult =
  | { ok: true; candidates: BundleSummary[] }
  | { ok: false; code: "NO_VALID_BUNDLE" };

const PROVIDER_ORDER = ["kiln", "nori", "loop"] as const;
const minute = 60_000;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const minutesBetween = (earlier: string, later: string): number =>
  (Date.parse(later) - Date.parse(earlier)) / minute;

const travelFor = (
  from: Slot,
  to: Slot,
  travelTimes: TravelTimes,
): number | null => {
  const value =
    travelTimes[from.location.locationId]?.[to.location.locationId] ?? null;
  return Number.isInteger(value) && value !== null && value >= 0 ? value : null;
};

const isFiniteSlot = (slot: Slot): boolean =>
  Number.isFinite(Date.parse(slot.startsAt)) &&
  Number.isFinite(Date.parse(slot.endsAt)) &&
  Number.isInteger(slot.priceYen) &&
  slot.priceYen >= 0 &&
  Number.isInteger(slot.originalPriceYen) &&
  slot.originalPriceYen >= slot.priceYen &&
  Number.isInteger(slot.capacityRemaining) &&
  slot.capacityRemaining >= 0 &&
  Number.isFinite(slot.noveltyScore);

export const isBundleFeasible = (
  slots: readonly Slot[],
  intent: Intent,
  travelTimes: TravelTimes,
): boolean => {
  if (slots.length !== PROVIDER_ORDER.length) return false;
  if (
    slots.some(
      (slot, index) =>
        slot.provider !== PROVIDER_ORDER[index] ||
        !isFiniteSlot(slot) ||
        slot.capacityRemaining < intent.partySize,
    )
  ) {
    return false;
  }

  const requestedDate = intent.startAt.slice(0, 10);
  if (
    intent.endAt.slice(0, 10) !== requestedDate ||
    slots.some(
      (slot) =>
        slot.startsAt.slice(0, 10) !== requestedDate ||
        slot.endsAt.slice(0, 10) !== requestedDate ||
        Date.parse(slot.endsAt) <= Date.parse(slot.startsAt),
    )
  ) {
    return false;
  }

  const first = slots[0];
  const last = slots[slots.length - 1];
  if (
    !first ||
    !last ||
    Date.parse(first.startsAt) < Date.parse(intent.startAt) ||
    Date.parse(last.endsAt) > Date.parse(intent.endAt)
  ) {
    return false;
  }

  if (
    slots.reduce((total, slot) => total + slot.priceYen, 0) >
      intent.totalBudgetYen ||
    slots.some((slot) =>
      slot.tags.some((tag) => intent.excludedTags.includes(tag)),
    )
  ) {
    return false;
  }

  for (let index = 1; index < slots.length; index += 1) {
    const previous = slots[index - 1];
    const current = slots[index];
    if (!previous || !current) return false;
    const travel = travelFor(previous, current, travelTimes);
    if (
      travel === null ||
      minutesBetween(previous.endsAt, current.startsAt) < travel
    ) {
      return false;
    }
  }

  return true;
};

const createBundleId = async (slots: readonly Slot[]): Promise<string> => {
  const identity = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    items: slots.map(({ provider, slotId, inventoryVersion }) => [
      provider,
      slotId,
      inventoryVersion,
    ]),
  });
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return `bundle-${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24)}`;
};

const scoreBundle = (
  slots: readonly [Slot, Slot, Slot],
  intent: Intent,
  totalTravelMinutes: number,
): Pick<BundleSummary, "score" | "scoreBreakdown" | "reasonCodes"> => {
  const bundleTags = new Set(slots.flatMap((slot) => slot.tags));
  const preferenceFit =
    intent.preferredTags.length === 0
      ? 0.5
      : intent.preferredTags.filter((tag) => bundleTags.has(tag)).length /
        intent.preferredTags.length;
  const novelty =
    slots.reduce((total, slot) => total + slot.noveltyScore, 0) / slots.length;
  const activityMinutes = slots.reduce(
    (total, slot) => total + minutesBetween(slot.startsAt, slot.endsAt),
    0,
  );
  const windowMinutes = minutesBetween(intent.startAt, intent.endAt);
  const timeUtilization = activityMinutes / windowMinutes;
  const discount =
    slots.reduce(
      (total, slot) =>
        total +
        (slot.originalPriceYen === 0
          ? 0
          : (slot.originalPriceYen - slot.priceYen) / slot.originalPriceYen),
      0,
    ) / slots.length;
  const travelBurden = totalTravelMinutes / 60;

  const rawBreakdown = {
    preferenceFit: clamp01(preferenceFit),
    novelty: clamp01(novelty),
    timeUtilization: clamp01(timeUtilization),
    discount: clamp01(discount),
    travelBurden: clamp01(travelBurden),
  };
  const rawScore =
    rawBreakdown.preferenceFit * 35 +
    rawBreakdown.novelty * 25 +
    rawBreakdown.timeUtilization * 15 +
    rawBreakdown.discount * 10 -
    rawBreakdown.travelBurden * 15;

  const reasonCandidates: Array<{
    include: boolean;
    code: BundleSummary["reasonCodes"][number];
  }> = [
    {
      include:
        intent.preferredTags.length > 0 && rawBreakdown.preferenceFit >= 2 / 3,
      code: "MATCHES_PREFERENCES",
    },
    { include: rawBreakdown.novelty >= 0.75, code: "HIGH_NOVELTY" },
    { include: rawBreakdown.travelBurden <= 0.5, code: "LOW_TRAVEL" },
    { include: rawBreakdown.discount >= 0.25, code: "GOOD_VALUE" },
    {
      include: rawBreakdown.timeUtilization >= 0.5,
      code: "USES_TIME_WELL",
    },
  ];

  return {
    score: round(Math.min(100, Math.max(0, rawScore)), 4),
    scoreBreakdown: {
      preferenceFit: round(rawBreakdown.preferenceFit, 6),
      novelty: round(rawBreakdown.novelty, 6),
      timeUtilization: round(rawBreakdown.timeUtilization, 6),
      discount: round(rawBreakdown.discount, 6),
      travelBurden: round(rawBreakdown.travelBurden, 6),
    },
    reasonCodes: reasonCandidates
      .filter(({ include }) => include)
      .slice(0, 3)
      .map(({ code }) => code),
  };
};

const toBundle = async (
  slots: readonly [Slot, Slot, Slot],
  intent: Intent,
  travelTimes: TravelTimes,
  bundleVersion: number,
): Promise<BundleSummary> => {
  const firstTravel = travelFor(slots[0], slots[1], travelTimes);
  const secondTravel = travelFor(slots[1], slots[2], travelTimes);
  if (firstTravel === null || secondTravel === null) {
    throw new Error("Feasible bundle lost a travel matrix pair");
  }
  const totalTravelMinutes = firstTravel + secondTravel;
  const score = scoreBundle(slots, intent, totalTravelMinutes);
  return {
    bundleId: await createBundleId(slots),
    bundleVersion,
    items: [
      {
        position: 0,
        slot: slots[0],
        travelFromPreviousMinutes: null,
        spareGapFromPreviousMinutes: null,
      },
      {
        position: 1,
        slot: slots[1],
        travelFromPreviousMinutes: firstTravel,
        spareGapFromPreviousMinutes:
          minutesBetween(slots[0].endsAt, slots[1].startsAt) - firstTravel,
      },
      {
        position: 2,
        slot: slots[2],
        travelFromPreviousMinutes: secondTravel,
        spareGapFromPreviousMinutes:
          minutesBetween(slots[1].endsAt, slots[2].startsAt) - secondTravel,
      },
    ],
    totalPriceYen: slots.reduce((total, slot) => total + slot.priceYen, 0),
    totalTravelMinutes,
    startsAt: slots[0].startsAt,
    endsAt: slots[2].endsAt,
    ...score,
  };
};

const compareBundles = (left: BundleSummary, right: BundleSummary): number =>
  right.score - left.score ||
  left.totalPriceYen - right.totalPriceYen ||
  Date.parse(left.endsAt) - Date.parse(right.endsAt) ||
  left.bundleId.localeCompare(right.bundleId);

export const composeBundles = async ({
  bundleVersion,
  intent,
  slotsByProvider,
  travelTimes,
}: ComposeBundlesInput): Promise<ComposeBundlesResult> => {
  const candidates: Array<readonly [Slot, Slot, Slot]> = [];
  for (const kiln of slotsByProvider.kiln) {
    for (const nori of slotsByProvider.nori) {
      for (const loop of slotsByProvider.loop) {
        const slots = [kiln, nori, loop] as const;
        if (isBundleFeasible(slots, intent, travelTimes))
          candidates.push(slots);
      }
    }
  }
  if (candidates.length === 0) return { ok: false, code: "NO_VALID_BUNDLE" };

  const bundles = await Promise.all(
    candidates.map((slots) =>
      toBundle(slots, intent, travelTimes, bundleVersion),
    ),
  );
  bundles.sort(compareBundles);
  return { ok: true, candidates: bundles.slice(0, 3) };
};

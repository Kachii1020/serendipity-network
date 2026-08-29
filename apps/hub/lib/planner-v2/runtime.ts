import "server-only";

import {
  composeEveningPlan,
  estimateCoordinateTravelV2,
  swapEveningPlanStop,
} from "@serendipity/bundle-engine/planner-v2";
import type {
  EveningPlanV2,
  PlaceEvidenceDataV2,
  PlaceDataPackV2,
  SearchPlanInputV2,
  SearchPlansDataV2,
  SwapPlanDataV2,
  SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";
import {
  validateEveningPlanV2,
  validatePlannerIntentV2,
  validateReviewedPlaceDataPackV2,
} from "@serendipity/contracts/planner-v2";

import {
  getPlaceEvidenceV2,
  SHIBUYA_ACTIVE_PACK_V2,
  SHIBUYA_REVIEWED_CLAIMS_V2,
} from "../../data/shibuya-v2";
import type { PlannerV2OperationResult } from "./handlers";

export const PLANNER_V2_PACK_VERSION = SHIBUYA_ACTIVE_PACK_V2.packVersion;

const cancelled = (): never => {
  throw new DOMException("The planner request was aborted.", "AbortError");
};

const checkSignal = (signal: AbortSignal): void => {
  if (signal.aborted) cancelled();
};

const ineligiblePack = (): PlannerV2OperationResult<never> => ({
  ok: false,
  error: {
    code: "INTERNAL_ERROR",
    message:
      "The planner source pack is not eligible for route planning. Try again after its evidence audit is complete.",
    retryable: false,
  },
});

const stalePack = (): PlannerV2OperationResult<never> => ({
  ok: false,
  error: {
    code: "STALE_DATA_PACK",
    message:
      "The planner source pack is outside its audited date horizon. Refresh after a new source audit.",
    retryable: false,
  },
});

export const isPlannerPackEligibleV2 = (dataPack: PlaceDataPackV2): boolean => {
  if (
    dataPack.status !== "ACTIVE" ||
    !validateReviewedPlaceDataPackV2(dataPack, SHIBUYA_REVIEWED_CLAIMS_V2).ok
  ) {
    return false;
  }
  const routable = dataPack.places.filter(
    ({ routeEligibility }) => routeEligibility.kind === "ROUTABLE",
  );
  return (
    routable.length >= 9 &&
    new Set(routable.map(({ category }) => category)).size >= 3 &&
    routable.every(
      ({ hoursProvenance, priceProvenance, weeklyHours }) =>
        hoursProvenance.kind === "PUBLISHED_WINDOWS" &&
        priceProvenance.kind === "PUBLISHED_AMOUNT" &&
        weeklyHours.length > 0,
    )
  );
};

export const isPlannerPackCurrentV2 = (
  dataPack: PlaceDataPackV2,
  now: Date,
  intent?: SearchPlanInputV2,
): boolean => {
  const generatedAt = Date.parse(dataPack.generatedAt);
  const validThrough = Date.parse(dataPack.validThrough);
  if (
    !Number.isFinite(generatedAt) ||
    !Number.isFinite(validThrough) ||
    now.getTime() < generatedAt ||
    now.getTime() > validThrough
  ) {
    return false;
  }
  return intent === undefined || Date.parse(intent.endAt) <= validThrough;
};

export const isSearchPlanEvidenceEligibleV2 = (
  plan: EveningPlanV2,
  dataPack: PlaceDataPackV2,
): boolean => {
  if (!validateEveningPlanV2(plan).ok) return false;
  const sourceIds = new Set(dataPack.sources.map(({ sourceId }) => sourceId));
  if (
    plan.packVersion !== dataPack.packVersion ||
    !dataPack.station.sourceIds.every((sourceId) => sourceIds.has(sourceId))
  ) {
    return false;
  }
  let previousCoordinates = dataPack.station.coordinates;
  let previousEnd = Date.parse(plan.intent.startAt);
  let previousName: string = dataPack.station.name;
  let totalMinPriceYen = 0;
  let totalMaxPriceYen = 0;
  let totalWalkMinutes = 0;
  const stopsEligible = plan.stops.every((stop) => {
    const place = dataPack.places.find(
      ({ placeId }) => placeId === stop.place.placeId,
    );
    if (
      !place ||
      place.routeEligibility.kind !== "ROUTABLE" ||
      place.hoursProvenance.kind !== "PUBLISHED_WINDOWS" ||
      place.priceProvenance.kind !== "PUBLISHED_AMOUNT" ||
      place.coordinates === null ||
      place.evidence.coordinates === null ||
      place.weeklyHours.length === 0
    ) {
      return false;
    }
    const references = [
      place.evidence.identity,
      place.evidence.address,
      place.evidence.coordinates,
      place.evidence.hours,
      place.evidence.price,
      place.evidence.publicAccess,
      place.evidence.officialLink,
    ];
    const identitySource = dataPack.sources.find(
      ({ sourceId }) => sourceId === place.evidence.identity.sourceId,
    );
    const expectedCheckedAt = [
      place.evidence.hours.checkedAt,
      place.evidence.price.checkedAt,
    ].sort()[1];
    const expectedTravel = estimateCoordinateTravelV2(
      previousCoordinates,
      place.coordinates,
    );
    const startsAt = Date.parse(stop.startsAt);
    const endsAt = Date.parse(stop.endsAt);
    const eligible =
      references.every(({ sourceId }) => sourceIds.has(sourceId)) &&
      stop.place.name === place.name &&
      stop.place.address === place.address &&
      stop.place.summary === place.summary &&
      stop.place.officialUrl === place.officialUrl &&
      JSON.stringify(stop.price) === JSON.stringify(place.price) &&
      JSON.stringify(stop.priceProvenance) ===
        JSON.stringify(place.priceProvenance) &&
      stop.travelMethod === "COORDINATE_ESTIMATE" &&
      stop.travelOriginLabel === previousName &&
      stop.travelFromPreviousMinutes === expectedTravel.minutes &&
      stop.travelFromPreviousDistanceMeters === expectedTravel.distanceMeters &&
      startsAt >= previousEnd + expectedTravel.minutes * 60_000 &&
      endsAt - startsAt === place.recommendedVisitMinutes * 60_000 &&
      endsAt <= Date.parse(plan.intent.endAt) &&
      /^Scheduled within published .+ hours/.test(stop.openingFit) &&
      stop.sourcePublisher === identitySource?.publisher &&
      stop.sourceCheckedAt === expectedCheckedAt;
    previousCoordinates = place.coordinates;
    previousEnd = endsAt;
    previousName = place.name;
    totalMinPriceYen += place.price.minYen;
    totalMaxPriceYen += place.price.maxYen;
    totalWalkMinutes += expectedTravel.minutes;
    return eligible;
  });
  return (
    stopsEligible &&
    plan.totals.minPriceYen === totalMinPriceYen &&
    plan.totals.maxPriceYen === totalMaxPriceYen &&
    plan.totals.totalWalkMinutes === totalWalkMinutes &&
    plan.totals.startsAt === plan.stops[0]?.startsAt &&
    plan.totals.endsAt === plan.stops.at(-1)?.endsAt
  );
};

export const searchEveningPlanV2 = (
  input: SearchPlanInputV2,
  signal: AbortSignal,
): Promise<PlannerV2OperationResult<SearchPlansDataV2>> =>
  searchEveningPlanAgainstPackV2(input, SHIBUYA_ACTIVE_PACK_V2, signal);

export const searchEveningPlanAgainstPackV2 = async (
  input: SearchPlanInputV2,
  dataPack: PlaceDataPackV2,
  signal: AbortSignal,
  asOf = new Date(),
): Promise<PlannerV2OperationResult<SearchPlansDataV2>> => {
  checkSignal(signal);
  if (!isPlannerPackEligibleV2(dataPack)) return ineligiblePack();
  if (!isPlannerPackCurrentV2(dataPack, asOf, input)) return stalePack();
  const result = await composeEveningPlan({
    asOf,
    dataPack,
    intent: input,
    reviewedClaims: SHIBUYA_REVIEWED_CLAIMS_V2,
  });
  checkSignal(signal);
  if (!result.ok) {
    return {
      ok: false,
      error: {
        code: "NO_VALID_PLAN",
        message:
          "No two- or three-stop route fits the selected time, reference budget, interests, and walking limit.",
        retryable: false,
      },
    };
  }
  if (!isSearchPlanEvidenceEligibleV2(result.plan, dataPack)) {
    return ineligiblePack();
  }

  return {
    ok: true,
    data: {
      candidateSetId: result.plan.candidateSetId,
      plan: result.plan,
      warnings: result.warnings,
    },
  };
};

export const swapEveningPlanV2 = (
  input: SwapPlanInputV2,
  signal: AbortSignal,
): Promise<PlannerV2OperationResult<SwapPlanDataV2>> => {
  return swapEveningPlan(input, signal);
};

const swapEveningPlan = async (
  input: SwapPlanInputV2,
  signal: AbortSignal,
): Promise<PlannerV2OperationResult<SwapPlanDataV2>> => {
  checkSignal(signal);
  if (!isPlannerPackEligibleV2(SHIBUYA_ACTIVE_PACK_V2)) {
    return ineligiblePack();
  }
  const asOf = new Date();
  if (!isPlannerPackCurrentV2(SHIBUYA_ACTIVE_PACK_V2, asOf, input.intent)) {
    return stalePack();
  }
  if (!validatePlannerIntentV2(input.intent, { now: asOf }).ok) {
    return {
      ok: false,
      error: {
        code: "STALE_PLAN",
        message: "The displayed plan is outside the current planning window.",
        retryable: false,
      },
    };
  }
  const current = await composeEveningPlan({
    asOf,
    dataPack: SHIBUYA_ACTIVE_PACK_V2,
    intent: input.intent,
    reviewedClaims: SHIBUYA_REVIEWED_CLAIMS_V2,
  });
  if (!current.ok) {
    return {
      ok: false,
      error: {
        code: "NO_VALID_PLAN",
        message: "The current planner intent no longer produces a route.",
        retryable: false,
      },
    };
  }
  if (current.plan.candidateSetId !== input.candidateSetId) {
    return {
      ok: false,
      error: {
        code: "STALE_DATA_PACK",
        message:
          "The place dataset changed. Build a fresh plan before swapping.",
        retryable: false,
      },
    };
  }
  if (input.plan.packVersion !== SHIBUYA_ACTIVE_PACK_V2.packVersion) {
    return {
      ok: false,
      error: {
        code: "STALE_DATA_PACK",
        message:
          "The place dataset changed. Build a fresh plan before swapping.",
        retryable: false,
      },
    };
  }

  const swapped = await swapEveningPlanStop({
    asOf,
    dataPack: SHIBUYA_ACTIVE_PACK_V2,
    intent: input.intent,
    plan: input.plan,
    preference: input.preference,
    reviewedClaims: SHIBUYA_REVIEWED_CLAIMS_V2,
    stopIndex: input.stopIndex,
  });
  checkSignal(signal);
  if (!swapped.ok) {
    return {
      ok: false,
      error: {
        code: swapped.code,
        message:
          swapped.code === "NO_REPLACEMENT"
            ? "No honest replacement preserves this stop and the current constraints. Try a different stop or adjust interests or walking distance."
            : "The displayed plan or place dataset changed. Build a fresh plan.",
        retryable: false,
      },
    };
  }
  if (!isSearchPlanEvidenceEligibleV2(swapped.plan, SHIBUYA_ACTIVE_PACK_V2)) {
    return ineligiblePack();
  }

  return {
    ok: true,
    data: {
      candidateSetId: swapped.plan.candidateSetId,
      plan: swapped.plan,
      preference: input.preference,
      replacedStopIndex: input.stopIndex,
      warnings: swapped.warnings,
    },
  };
};

export const readPlaceEvidenceV2 = (
  placeId: string,
): PlannerV2OperationResult<PlaceEvidenceDataV2> =>
  readPlaceEvidenceAgainstPackV2(
    placeId,
    SHIBUYA_ACTIVE_PACK_V2,
    getPlaceEvidenceV2,
  );

export const readPlaceEvidenceAgainstPackV2 = (
  placeId: string,
  dataPack: PlaceDataPackV2,
  getEvidence: (
    candidatePlaceId: string,
  ) => PlaceEvidenceDataV2["evidence"] | null,
  asOf = new Date(),
): PlannerV2OperationResult<PlaceEvidenceDataV2> => {
  if (!isPlannerPackEligibleV2(dataPack)) {
    return ineligiblePack();
  }
  if (!isPlannerPackCurrentV2(dataPack, asOf)) {
    return stalePack();
  }
  const evidence = getEvidence(placeId);
  return evidence
    ? { ok: true, data: { evidence } }
    : {
        ok: false,
        error: {
          code: "PLACE_NOT_FOUND",
          message: "That place is not present in the active source pack.",
          retryable: false,
        },
      };
};

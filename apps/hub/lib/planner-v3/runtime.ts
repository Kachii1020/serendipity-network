import "server-only";

import {
  composeEveningPlanV3,
  swapEveningPlanStopV3,
} from "@serendipity/bundle-engine/planner-v3";
import {
  isStrictTimestampV3,
  validateEveningPlanV3,
  type AreaDataPackV3,
  type GooglePlaceSignalV3,
  type PlaceEvidenceDataV3,
  type PlannerAreaV3,
  type PlannerIntentV3,
  type ReviewedPackClaimLedgerV3,
  type PlannerPublicErrorV3,
  type SearchPlansDataV3,
  type SwapPlanDataV3,
  type SwapPlanInputV3,
} from "@serendipity/contracts/planner-v3";

import {
  fetchGooglePlaceEnrichmentV3,
  type GooglePlaceEnrichmentV3,
} from "./google-places";
import {
  DEFAULT_AREA_REGISTRY_V3,
  type AreaRegistryEntryV3,
  type AreaRegistryV3,
} from "./area-registry";

export type PlannerV3OperationResult<T> =
  | Readonly<{ ok: true; data: T; area: PlannerAreaV3; packVersion: string }>
  | Readonly<{
      ok: false;
      error: PlannerPublicErrorV3;
      area: PlannerAreaV3 | null;
      packVersion: string | null;
    }>;

export type EvidenceWindowV3 = Readonly<{
  startsAt: string;
  endsAt: string;
}>;

type GoogleLookupV3 = typeof fetchGooglePlaceEnrichmentV3;

const error = (
  code: PlannerPublicErrorV3["code"],
  message: string,
  retryable = false,
): PlannerPublicErrorV3 => ({ code, message, retryable });

const cancelled = (): never => {
  throw new DOMException("The planner request was cancelled.", "AbortError");
};

const checkSignal = (signal?: AbortSignal): void => {
  if (signal?.aborted) cancelled();
};

const moneyLabel = (enrichment: GooglePlaceEnrichmentV3): string | null => {
  const start = enrichment.priceRange?.startPrice;
  const end = enrichment.priceRange?.endPrice;
  if (!start && !end) return null;
  const yen = (value: typeof start): string | null =>
    value ? `¥${Number(value.units).toLocaleString("en-US")}` : null;
  return [yen(start), yen(end)].filter((value) => value !== null).join("–");
};

const googleSignal = (
  placeId: string,
  enrichment: GooglePlaceEnrichmentV3,
): GooglePlaceSignalV3 | null => {
  if (enrichment.status !== "ENRICHED") return null;
  const businessStatus =
    enrichment.businessStatus === "OPERATIONAL" ||
    enrichment.businessStatus === "CLOSED_TEMPORARILY" ||
    enrichment.businessStatus === "CLOSED_PERMANENTLY"
      ? enrichment.businessStatus
      : "UNKNOWN";
  return {
    placeId,
    googlePlaceId: enrichment.placeId,
    businessStatus,
    openNow: enrichment.openForRequestedWindow,
    priceLevel: enrichment.priceLevel ?? null,
    priceRangeLabel: moneyLabel(enrichment),
    googleMapsUri: enrichment.googleMapsUri ?? null,
    attributions: enrichment.attributions.map(({ provider, providerUri }) => ({
      provider,
      uri: providerUri ?? null,
    })),
  };
};

const reviewedGooglePlaceIds = (pack: AreaDataPackV3): ReadonlySet<string> =>
  new Set(
    pack.places.flatMap(({ googlePlaceId, role }) =>
      role === "MEAL" && googlePlaceId ? [googlePlaceId] : [],
    ),
  );

const enrichPlan = async (
  entry: AreaRegistryEntryV3,
  plan: SearchPlansDataV3["plan"],
  googleLookup: GoogleLookupV3,
  signal?: AbortSignal,
): Promise<{
  closedPlaceIds: string[];
  googleSignals: GooglePlaceSignalV3[];
  warnings: string[];
}> => {
  const allowedPlaceIds = reviewedGooglePlaceIds(entry.pack);
  const calls = new Map<string, Promise<GooglePlaceEnrichmentV3>>();
  for (const stop of plan.stops) {
    const googlePlaceId = stop.place.googlePlaceId;
    if (
      stop.place.role !== "MEAL" ||
      !googlePlaceId ||
      calls.has(googlePlaceId)
    ) {
      continue;
    }
    calls.set(
      googlePlaceId,
      googleLookup({
        allowedPlaceIds,
        endsAt: stop.endsAt,
        placeId: googlePlaceId,
        ...(signal ? { signal } : {}),
        startsAt: stop.startsAt,
      }),
    );
    if (calls.size === 3) break;
  }

  const googleSignals: GooglePlaceSignalV3[] = [];
  const closedPlaceIds: string[] = [];
  const warnings: string[] = [];
  for (const [placeId, pending] of calls) {
    checkSignal(signal);
    const enrichment = await pending;
    const stop = plan.stops.find(
      ({ place }) => place.googlePlaceId === placeId,
    );
    const normalized = stop
      ? googleSignal(stop.place.placeId, enrichment)
      : null;
    if (normalized) {
      googleSignals.push(normalized);
      if (
        normalized.openNow === false ||
        !["OPERATIONAL", "UNKNOWN"].includes(normalized.businessStatus)
      ) {
        closedPlaceIds.push(normalized.placeId);
        warnings.push(`GOOGLE_LISTS_CLOSED:${normalized.placeId}`);
      }
    } else if (enrichment.status !== "DISABLED") {
      warnings.push(
        `GOOGLE_ENRICHMENT_UNAVAILABLE:${stop?.place.placeId ?? placeId}`,
      );
    }
  }
  return { closedPlaceIds, googleSignals, warnings };
};

const filteredEntry = (
  entry: AreaRegistryEntryV3,
  excludedPlaceIds: ReadonlySet<string>,
  date: string,
): AreaRegistryEntryV3 | null => {
  if (excludedPlaceIds.size === 0) return entry;
  const reviewed = entry.reviewedClaims[entry.pack.packVersion];
  if (!reviewed) return null;
  const excludedWeekday = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  const closeExcluded = (places: AreaDataPackV3["places"]) =>
    places.map((place) =>
      excludedPlaceIds.has(place.placeId)
        ? {
            ...place,
            weeklyHours: place.weeklyHours.flatMap((window) => {
              const days = window.days.filter((day) => day !== excludedWeekday);
              return days.length > 0 ? [{ ...window, days }] : [];
            }),
          }
        : place,
    );
  const places = closeExcluded(entry.pack.places);
  const pack: AreaDataPackV3 = { ...entry.pack, places };
  const reviewedClaims: ReviewedPackClaimLedgerV3 = {
    [entry.pack.packVersion]: {
      ...reviewed,
      pack: {
        ...reviewed.pack,
        places: closeExcluded(reviewed.pack.places),
      },
    },
  };
  return { ...entry, pack, reviewedClaims };
};

export class PlannerV3Runtime {
  readonly #clock: () => Date;
  readonly #googleLookup: GoogleLookupV3;
  readonly #registry: AreaRegistryV3;

  constructor(
    options: {
      clock?: () => Date;
      googleLookup?: GoogleLookupV3;
      registry?: AreaRegistryV3;
    } = {},
  ) {
    this.#clock = options.clock ?? (() => new Date());
    this.#googleLookup = options.googleLookup ?? fetchGooglePlaceEnrichmentV3;
    this.#registry = options.registry ?? DEFAULT_AREA_REGISTRY_V3;
  }

  async search(
    intent: PlannerIntentV3,
    signal?: AbortSignal,
  ): Promise<PlannerV3OperationResult<SearchPlansDataV3>> {
    checkSignal(signal);
    const asOf = this.#clock();
    const resolved = this.#registry.resolve(intent.area, { asOf, intent });
    if (!resolved.ok) {
      return {
        ok: false,
        area: intent.area,
        packVersion: this.#registry.get(intent.area)?.pack.packVersion ?? null,
        error: error(
          resolved.code,
          resolved.code === "AREA_NOT_ACTIVE"
            ? "That Tokyo hub is not active for planning."
            : "That hub's source pack is outside its audited horizon.",
        ),
      };
    }
    const excludedPlaceIds = new Set<string>();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const entry = filteredEntry(
        resolved.entry,
        excludedPlaceIds,
        intent.startAt.slice(0, 10),
      );
      if (!entry) break;
      const result = await composeEveningPlanV3({
        asOf,
        dataPack: entry.pack,
        intent,
        reviewedClaims: entry.reviewedClaims,
      });
      checkSignal(signal);
      if (!result.ok) {
        const code =
          result.code === "VALIDATION_ERROR" ? "VALIDATION_ERROR" : result.code;
        return {
          ok: false,
          area: intent.area,
          packVersion: resolved.entry.pack.packVersion,
          error: error(
            code,
            code === "NO_VALID_PLAN"
              ? "No route fits the requested time, budget, walking, meal, and interest constraints."
              : "The area's source pack is stale or the request is invalid.",
          ),
        };
      }
      if (!validateEveningPlanV3(result.plan).ok) {
        return {
          ok: false,
          area: intent.area,
          packVersion: resolved.entry.pack.packVersion,
          error: error(
            "INTERNAL_ERROR",
            "The planner produced an invalid route.",
            true,
          ),
        };
      }
      const google = await enrichPlan(
        entry,
        result.plan,
        this.#googleLookup,
        signal,
      );
      if (google.closedPlaceIds.length > 0) {
        google.closedPlaceIds.forEach((placeId) =>
          excludedPlaceIds.add(placeId),
        );
        continue;
      }
      return {
        ok: true,
        area: intent.area,
        packVersion: resolved.entry.pack.packVersion,
        data: {
          candidateSetId: result.candidateSetId,
          plan: result.plan,
          warnings: [...new Set([...result.warnings, ...google.warnings])],
          googleSignals: google.googleSignals,
        },
      };
    }
    return {
      ok: false,
      area: intent.area,
      packVersion: resolved.entry.pack.packVersion,
      error: error(
        "NO_VALID_PLAN",
        "No route remains after Google listed the reviewed meal candidates closed.",
      ),
    };
  }

  async swap(
    input: SwapPlanInputV3,
    signal?: AbortSignal,
  ): Promise<PlannerV3OperationResult<SwapPlanDataV3>> {
    checkSignal(signal);
    const asOf = this.#clock();
    const resolved = this.#registry.resolve(input.intent.area, {
      asOf,
      intent: input.intent,
    });
    if (!resolved.ok) {
      return {
        ok: false,
        area: input.intent.area,
        packVersion:
          this.#registry.get(input.intent.area)?.pack.packVersion ?? null,
        error: error(resolved.code, "The area's source pack is not active."),
      };
    }
    const candidateEntry = resolved.entry;
    const result = await swapEveningPlanStopV3({
      ...input,
      asOf,
      dataPack: candidateEntry.pack,
      reviewedClaims: candidateEntry.reviewedClaims,
    });
    checkSignal(signal);
    if (!result.ok) {
      return {
        ok: false,
        area: input.intent.area,
        packVersion: resolved.entry.pack.packVersion,
        error: error(
          result.code,
          result.code === "NO_REPLACEMENT"
            ? "No same-kind replacement preserves the current constraints."
            : "The displayed plan or area pack is stale or invalid.",
        ),
      };
    }
    if (!validateEveningPlanV3(result.plan).ok) {
      return {
        ok: false,
        area: input.intent.area,
        packVersion: resolved.entry.pack.packVersion,
        error: error(
          "INTERNAL_ERROR",
          "The planner produced an invalid replacement.",
          true,
        ),
      };
    }
    const google = await enrichPlan(
      candidateEntry,
      result.plan,
      this.#googleLookup,
      signal,
    );
    if (google.closedPlaceIds.length > 0) {
      return {
        ok: false,
        area: input.intent.area,
        packVersion: resolved.entry.pack.packVersion,
        error: error(
          "NO_REPLACEMENT",
          "Google lists the replacement meal closed; the current plan was kept unchanged.",
        ),
      };
    }
    return {
      ok: true,
      area: input.intent.area,
      packVersion: resolved.entry.pack.packVersion,
      data: {
        candidateSetId: result.candidateSetId,
        plan: result.plan,
        replacedStopIndex: result.replacedStopIndex,
        preference: result.preference,
        warnings: [...new Set([...result.warnings, ...google.warnings])],
        googleSignals: google.googleSignals,
      },
    };
  }

  async evidence(
    area: PlannerAreaV3,
    placeId: string,
    window?: EvidenceWindowV3,
    signal?: AbortSignal,
  ): Promise<PlannerV3OperationResult<PlaceEvidenceDataV3>> {
    checkSignal(signal);
    const resolved = this.#registry.resolve(area, { asOf: this.#clock() });
    if (!resolved.ok) {
      return {
        ok: false,
        area,
        packVersion: this.#registry.get(area)?.pack.packVersion ?? null,
        error: error(resolved.code, "The area's source pack is not active."),
      };
    }
    const place = resolved.entry.pack.places.find(
      (candidate) => candidate.placeId === placeId,
    );
    const evidence = resolved.entry.getEvidence(placeId);
    if (!place || !evidence) {
      return {
        ok: false,
        area,
        packVersion: resolved.entry.pack.packVersion,
        error: error(
          "PLACE_NOT_FOUND",
          "That place is not in the selected hub.",
        ),
      };
    }
    let signalValue: GooglePlaceSignalV3 | null = null;
    if (window) {
      if (
        !isStrictTimestampV3(window.startsAt) ||
        !window.startsAt.endsWith("+09:00") ||
        !isStrictTimestampV3(window.endsAt) ||
        !window.endsAt.endsWith("+09:00") ||
        Date.parse(window.endsAt) <= Date.parse(window.startsAt) ||
        Date.parse(window.endsAt) - Date.parse(window.startsAt) !==
          place.recommendedVisitMinutes * 60_000
      ) {
        return {
          ok: false,
          area,
          packVersion: resolved.entry.pack.packVersion,
          error: error(
            "VALIDATION_ERROR",
            "The evidence time window is invalid.",
          ),
        };
      }
      if (place.role === "MEAL" && place.googlePlaceId) {
        const enrichment = await this.#googleLookup({
          allowedPlaceIds: reviewedGooglePlaceIds(resolved.entry.pack),
          endsAt: window.endsAt,
          placeId: place.googlePlaceId,
          ...(signal ? { signal } : {}),
          startsAt: window.startsAt,
        });
        signalValue = googleSignal(place.placeId, enrichment);
      }
    }
    return {
      ok: true,
      area,
      packVersion: resolved.entry.pack.packVersion,
      data: { evidence, googleSignal: signalValue },
    };
  }
}

export const DEFAULT_PLANNER_V3_RUNTIME = new PlannerV3Runtime();

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { FromSchema } from "json-schema-to-ts";

import {
  ERROR_CODES,
  PROVIDERS,
  SCHEMA_VERSION,
  errorSchema,
} from "./schemas/common";
import { bundleSummarySchema } from "./schemas/bundle";
import { areaDataPackSchema } from "./schemas/area-pack";
import {
  failureEnvelopeSchema,
  providerSearchEnvelopeSchema,
  resultEnvelopeSchema,
} from "./schemas/envelope";
import { intentSchema } from "./schemas/intent";
import {
  confirmBundleDataSchema,
  confirmBundleInputSchema,
  bundleReloadDataSchema,
  findOptionsDataSchema,
  findOptionsInputSchema,
  holdBundleDataSchema,
  holdBundleInputSchema,
  providerConfirmDataSchema,
  providerConfirmInputSchema,
  providerHoldDataSchema,
  providerHoldInputSchema,
  providerHoldStatusDataSchema,
  providerHoldStatusInputSchema,
  providerReleaseDataSchema,
  providerReleaseInputSchema,
  providerSearchDataSchema,
  providerSearchInputSchema,
  releaseBundleDataSchema,
  releaseBundleInputSchema,
  showBundleDataSchema,
  showBundleInputSchema,
} from "./schemas/operations";
import { slotSchema } from "./schemas/slot";
import {
  demoCancelSlotDataSchema,
  demoCancelSlotInputSchema,
  providerHoldHttpDataSchema,
} from "./schemas/provider-http";
import {
  directComposeDataSchema,
  directComposeInputSchema,
  directPrepareConfirmationDataSchema,
  directPrepareConfirmationInputSchema,
  directPrepareHoldDataSchema,
  directPrepareHoldInputSchema,
  directPrepareReleaseDataSchema,
  directPrepareReleaseInputSchema,
  directRecordConfirmationDataSchema,
  directRecordConfirmationInputSchema,
  directRecordHoldDataSchema,
  directRecordHoldInputSchema,
  directRecordReleaseDataSchema,
  directRecordReleaseInputSchema,
  providerToolConfirmInputSchema,
  providerToolHoldInputSchema,
  providerToolReleaseInputSchema,
} from "./schemas/fallback";

export * from "./schemas/bundle";
export * from "./schemas/area-pack";
export * from "./schemas/common";
export * from "./schemas/envelope";
export * from "./schemas/intent";
export * from "./schemas/operations";
export * from "./schemas/slot";
export * from "./schemas/provider-http";
export * from "./schemas/fallback";
export * from "./audit";
export { assertPublicPayloadSafe, enforceResultSize } from "./public-safety";

export type Intent = FromSchema<typeof intentSchema>;
export type Slot = FromSchema<typeof slotSchema>;
export type AreaDataPack = FromSchema<typeof areaDataPackSchema>;
export type BundleSummary = FromSchema<typeof bundleSummarySchema>;
export type ProviderSearchInput = FromSchema<typeof providerSearchInputSchema>;
export type ProviderSearchData = FromSchema<typeof providerSearchDataSchema>;
export type ProviderSearchEnvelope = FromSchema<
  typeof providerSearchEnvelopeSchema
>;
export type ProviderHoldInput = FromSchema<typeof providerHoldInputSchema>;
export type ProviderHoldData = FromSchema<typeof providerHoldDataSchema>;
export type ProviderHoldStatusInput = FromSchema<
  typeof providerHoldStatusInputSchema
>;
export type ProviderHoldStatusData = FromSchema<
  typeof providerHoldStatusDataSchema
>;
export type ProviderConfirmInput = FromSchema<
  typeof providerConfirmInputSchema
>;
export type ProviderConfirmData = FromSchema<typeof providerConfirmDataSchema>;
export type ProviderReleaseInput = FromSchema<
  typeof providerReleaseInputSchema
>;
export type ProviderReleaseData = FromSchema<typeof providerReleaseDataSchema>;
export type FindOptionsInput = FromSchema<typeof findOptionsInputSchema>;
export type FindOptionsData = FromSchema<typeof findOptionsDataSchema>;
export type ShowBundleInput = FromSchema<typeof showBundleInputSchema>;
export type ShowBundleData = FromSchema<typeof showBundleDataSchema>;
export type HoldBundleInput = FromSchema<typeof holdBundleInputSchema>;
export type HoldBundleData = FromSchema<typeof holdBundleDataSchema>;
export type ConfirmBundleInput = FromSchema<typeof confirmBundleInputSchema>;
export type ConfirmBundleData = FromSchema<typeof confirmBundleDataSchema>;
export type ReleaseBundleInput = FromSchema<typeof releaseBundleInputSchema>;
export type ReleaseBundleData = FromSchema<typeof releaseBundleDataSchema>;
export type BundleReloadData = FromSchema<typeof bundleReloadDataSchema>;
export type PublicError = FromSchema<typeof errorSchema>;
export type Provider = (typeof PROVIDERS)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ProviderHoldHttpData = FromSchema<
  typeof providerHoldHttpDataSchema
>;
export type DemoCancelSlotInput = FromSchema<typeof demoCancelSlotInputSchema>;
export type DemoCancelSlotData = FromSchema<typeof demoCancelSlotDataSchema>;
export type ProviderToolHoldInput = FromSchema<
  typeof providerToolHoldInputSchema
>;
export type ProviderToolConfirmInput = FromSchema<
  typeof providerToolConfirmInputSchema
>;
export type ProviderToolReleaseInput = FromSchema<
  typeof providerToolReleaseInputSchema
>;
export type DirectComposeInput = FromSchema<typeof directComposeInputSchema>;
export type DirectComposeData = FromSchema<typeof directComposeDataSchema>;
export type DirectPrepareHoldInput = FromSchema<
  typeof directPrepareHoldInputSchema
>;
export type DirectPrepareHoldData = FromSchema<
  typeof directPrepareHoldDataSchema
>;
export type DirectRecordHoldInput = FromSchema<
  typeof directRecordHoldInputSchema
>;
export type DirectRecordHoldData = FromSchema<
  typeof directRecordHoldDataSchema
>;
export type DirectPrepareReleaseInput = FromSchema<
  typeof directPrepareReleaseInputSchema
>;
export type DirectPrepareReleaseData = FromSchema<
  typeof directPrepareReleaseDataSchema
>;
export type DirectRecordReleaseInput = FromSchema<
  typeof directRecordReleaseInputSchema
>;
export type DirectRecordReleaseData = FromSchema<
  typeof directRecordReleaseDataSchema
>;
export type DirectPrepareConfirmationInput = FromSchema<
  typeof directPrepareConfirmationInputSchema
>;
export type DirectPrepareConfirmationData = FromSchema<
  typeof directPrepareConfirmationDataSchema
>;
export type DirectRecordConfirmationInput = FromSchema<
  typeof directRecordConfirmationInputSchema
>;
export type DirectRecordConfirmationData = FromSchema<
  typeof directRecordConfirmationDataSchema
>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "VALIDATION_ERROR" | "UNSUPPORTED_SCHEMA_VERSION";
      issues: string[];
    };

const ajv = new Ajv({ allErrors: true, strict: true });

const formatIssues = (errors: ErrorObject[] | null | undefined): string[] =>
  errors?.map(
    (error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
  ) ?? ["/ is invalid"];

const hasUnsupportedVersion = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "schemaVersion" in value &&
  (value as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION;

const validateWith = <T>(
  validator: ValidateFunction,
  value: unknown,
  semanticIssues: (candidate: T) => string[] = () => [],
): ValidationResult<T> => {
  if (hasUnsupportedVersion(value)) {
    return {
      ok: false,
      code: "UNSUPPORTED_SCHEMA_VERSION",
      issues: [`/schemaVersion must equal ${SCHEMA_VERSION}`],
    };
  }
  if (!validator(value)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      issues: formatIssues(validator.errors),
    };
  }
  const candidate = value as T;
  const issues = semanticIssues(candidate);
  return issues.length > 0
    ? { ok: false, code: "VALIDATION_ERROR", issues }
    : { ok: true, value: candidate };
};

const chronologyIssues = (value: {
  startAt: string;
  endAt: string;
}): string[] => {
  const issues: string[] = [];
  if (Date.parse(value.endAt) <= Date.parse(value.startAt)) {
    issues.push("/endAt must be later than /startAt");
  }
  if (value.startAt.slice(0, 10) !== value.endAt.slice(0, 10)) {
    issues.push("/startAt and /endAt must share the same local date");
  }
  return issues;
};

const intentValidator = ajv.compile(intentSchema);
const slotValidator = ajv.compile(slotSchema);
const areaDataPackValidator = ajv.compile(areaDataPackSchema);
const bundleValidator = ajv.compile(bundleSummarySchema);
const providerSearchEnvelopeValidator = ajv.compile(
  providerSearchEnvelopeSchema,
);

export const contractValidators = {
  intent: intentValidator,
  slot: slotValidator,
  areaDataPack: areaDataPackValidator,
  bundleSummary: bundleValidator,
  error: ajv.compile(errorSchema),
  failureEnvelope: ajv.compile(failureEnvelopeSchema),
  providerSearchEnvelope: providerSearchEnvelopeValidator,
  providerSearchInput: ajv.compile(providerSearchInputSchema),
  providerSearchData: ajv.compile(providerSearchDataSchema),
  providerHoldInput: ajv.compile(providerHoldInputSchema),
  providerHoldData: ajv.compile(providerHoldDataSchema),
  providerHoldStatusInput: ajv.compile(providerHoldStatusInputSchema),
  providerHoldStatusData: ajv.compile(providerHoldStatusDataSchema),
  providerConfirmInput: ajv.compile(providerConfirmInputSchema),
  providerConfirmData: ajv.compile(providerConfirmDataSchema),
  providerReleaseInput: ajv.compile(providerReleaseInputSchema),
  providerReleaseData: ajv.compile(providerReleaseDataSchema),
  providerHoldHttpData: ajv.compile(providerHoldHttpDataSchema),
  demoCancelSlotInput: ajv.compile(demoCancelSlotInputSchema),
  demoCancelSlotData: ajv.compile(demoCancelSlotDataSchema),
  providerResultEnvelope: ajv.compile(
    resultEnvelopeSchema({ type: "object" } as const),
  ),
  findOptionsInput: ajv.compile(findOptionsInputSchema),
  findOptionsData: ajv.compile(findOptionsDataSchema),
  showBundleInput: ajv.compile(showBundleInputSchema),
  showBundleData: ajv.compile(showBundleDataSchema),
  holdBundleInput: ajv.compile(holdBundleInputSchema),
  holdBundleData: ajv.compile(holdBundleDataSchema),
  confirmBundleInput: ajv.compile(confirmBundleInputSchema),
  confirmBundleData: ajv.compile(confirmBundleDataSchema),
  releaseBundleInput: ajv.compile(releaseBundleInputSchema),
  releaseBundleData: ajv.compile(releaseBundleDataSchema),
  bundleReloadData: ajv.compile(bundleReloadDataSchema),
  providerToolHoldInput: ajv.compile(providerToolHoldInputSchema),
  providerToolConfirmInput: ajv.compile(providerToolConfirmInputSchema),
  providerToolReleaseInput: ajv.compile(providerToolReleaseInputSchema),
  directComposeInput: ajv.compile(directComposeInputSchema),
  directComposeData: ajv.compile(directComposeDataSchema),
  directPrepareHoldInput: ajv.compile(directPrepareHoldInputSchema),
  directPrepareHoldData: ajv.compile(directPrepareHoldDataSchema),
  directRecordHoldInput: ajv.compile(directRecordHoldInputSchema),
  directRecordHoldData: ajv.compile(directRecordHoldDataSchema),
  directPrepareReleaseInput: ajv.compile(directPrepareReleaseInputSchema),
  directPrepareReleaseData: ajv.compile(directPrepareReleaseDataSchema),
  directRecordReleaseInput: ajv.compile(directRecordReleaseInputSchema),
  directRecordReleaseData: ajv.compile(directRecordReleaseDataSchema),
  directPrepareConfirmationInput: ajv.compile(
    directPrepareConfirmationInputSchema,
  ),
  directPrepareConfirmationData: ajv.compile(
    directPrepareConfirmationDataSchema,
  ),
  directRecordConfirmationInput: ajv.compile(
    directRecordConfirmationInputSchema,
  ),
  directRecordConfirmationData: ajv.compile(directRecordConfirmationDataSchema),
} as const satisfies Record<string, ValidateFunction>;

export const validateIntent = (value: unknown): ValidationResult<Intent> =>
  validateWith<Intent>(intentValidator, value, chronologyIssues);

export const validateSlot = (value: unknown): ValidationResult<Slot> =>
  validateWith<Slot>(slotValidator, value, (slot) => {
    const issues = chronologyIssues({
      startAt: slot.startsAt,
      endAt: slot.endsAt,
    });
    if (slot.originalPriceYen < slot.priceYen) {
      issues.push("/originalPriceYen must be at least /priceYen");
    }
    return issues;
  });

export type AreaPackPromotionGates = Readonly<{
  protectedReset: boolean;
  productionE2E: boolean;
  reliability: boolean;
}>;

export type AreaPackPromotionEvaluation = Readonly<{
  eligible: boolean;
  issues: readonly string[];
}>;

export const ACTIVE_AREA_SLUGS = ["shibuya"] as const;

const providerOriginIsExactHttps = (value: string): boolean => {
  if (value.includes("*")) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
};

const timezoneIsIana = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
};

const travelEdgeKey = (fromLocationId: string, toLocationId: string): string =>
  JSON.stringify([fromLocationId, toLocationId]);

const areaPackSemanticIssues = (pack: AreaDataPack): string[] => {
  const issues: string[] = [];
  if (!timezoneIsIana(pack.area.timezone)) {
    issues.push("/area/timezone must be a valid IANA timezone");
  }
  if (pack.status === "ACTIVE" && pack.area.slug !== "shibuya") {
    issues.push(
      "/status may be ACTIVE only for the evidenced shibuya launch network",
    );
  }

  const providerEntries = new Map<
    Provider,
    AreaDataPack["providers"][number]
  >();
  const origins = new Set<string>();
  const slotsById = new Map<string, Slot>();
  const locationOwners = new Map<string, Provider>();
  const locationIds = new Set<string>();

  for (const [providerIndex, entry] of pack.providers.entries()) {
    if (providerEntries.has(entry.provider)) {
      issues.push(`/providers/${providerIndex}/provider must be unique`);
    } else {
      providerEntries.set(entry.provider, entry);
    }

    if (!providerOriginIsExactHttps(entry.origin)) {
      issues.push(
        `/providers/${providerIndex}/origin must be one exact HTTPS origin`,
      );
    } else if (origins.has(entry.origin)) {
      issues.push(`/providers/${providerIndex}/origin must be unique`);
    }
    origins.add(entry.origin);

    for (const [slotIndex, slot] of entry.slots.entries()) {
      const slotPath = `/providers/${providerIndex}/slots/${slotIndex}`;
      const slotResult = validateSlot(slot);
      if (!slotResult.ok) {
        issues.push(...slotResult.issues.map((issue) => `${slotPath}${issue}`));
      }
      if (slot.provider !== entry.provider) {
        issues.push(`${slotPath}/provider must match its Provider pack entry`);
      }
      if (slotsById.has(slot.slotId)) {
        issues.push(`${slotPath}/slotId must be unique across the area pack`);
      } else {
        slotsById.set(slot.slotId, slot);
      }

      const owner = locationOwners.get(slot.location.locationId);
      if (owner !== undefined && owner !== entry.provider) {
        issues.push(
          `${slotPath}/location/locationId must not alias another Provider location`,
        );
      } else {
        locationOwners.set(slot.location.locationId, entry.provider);
      }
      locationIds.add(slot.location.locationId);
    }
  }

  for (const provider of PROVIDERS) {
    if (!providerEntries.has(provider)) {
      issues.push(`/providers must include exactly one ${provider} entry`);
    }
  }

  const expectedTravelEdges = new Map<
    string,
    Readonly<{ fromLocationId: string; toLocationId: string }>
  >();
  for (const fromLocationId of locationIds) {
    for (const toLocationId of locationIds) {
      if (fromLocationId !== toLocationId) {
        expectedTravelEdges.set(travelEdgeKey(fromLocationId, toLocationId), {
          fromLocationId,
          toLocationId,
        });
      }
    }
  }

  const travelMinutes = new Map<string, number>();
  for (const [edgeIndex, edge] of pack.directedTravelMinutes.entries()) {
    const key = travelEdgeKey(edge.fromLocationId, edge.toLocationId);
    if (!expectedTravelEdges.has(key)) {
      issues.push(
        `/directedTravelMinutes/${edgeIndex} is an extra edge outside the distinct location pairs`,
      );
      continue;
    }
    if (travelMinutes.has(key)) {
      issues.push(`/directedTravelMinutes/${edgeIndex} duplicates an edge`);
      continue;
    }
    travelMinutes.set(key, edge.minutes);
  }
  for (const [expectedEdge, pair] of expectedTravelEdges) {
    if (!travelMinutes.has(expectedEdge)) {
      issues.push(
        `/directedTravelMinutes is missing ${pair.fromLocationId} -> ${pair.toLocationId}`,
      );
    }
  }

  const windowStart = Date.parse(pack.serviceWindow.startsAt);
  const windowEnd = Date.parse(pack.serviceWindow.endsAt);
  if (
    windowEnd <= windowStart ||
    pack.serviceWindow.startsAt.slice(0, 10) !==
      pack.serviceWindow.endsAt.slice(0, 10)
  ) {
    issues.push(
      "/serviceWindow/endsAt must be later than startsAt on the same local date",
    );
  }

  const routeIsFeasible = (route: readonly Slot[]): boolean => {
    if (route.length !== PROVIDERS.length) return false;
    if (
      route.some(
        (slot, index) =>
          slot.provider !== PROVIDERS[index] ||
          slot.capacityRemaining < pack.serviceWindow.partySize ||
          Date.parse(slot.startsAt) < windowStart ||
          Date.parse(slot.endsAt) > windowEnd ||
          Date.parse(slot.endsAt) <= Date.parse(slot.startsAt),
      ) ||
      route.reduce((total, slot) => total + slot.priceYen, 0) >
        pack.serviceWindow.totalBudgetYen
    ) {
      return false;
    }

    for (let index = 1; index < route.length; index += 1) {
      const previous = route[index - 1];
      const current = route[index];
      if (!previous || !current) return false;
      const minutes = travelMinutes.get(
        travelEdgeKey(
          previous.location.locationId,
          current.location.locationId,
        ),
      );
      if (
        minutes === undefined ||
        Date.parse(current.startsAt) - Date.parse(previous.endsAt) <
          minutes * 60_000
      ) {
        return false;
      }
    }
    return true;
  };

  const fixtureRoute = pack.fixtureSlotIds
    .map((slotId) => slotsById.get(slotId))
    .filter((slot): slot is Slot => slot !== undefined);
  if (
    fixtureRoute.length !== PROVIDERS.length ||
    !routeIsFeasible(fixtureRoute)
  ) {
    issues.push(
      "/fixtureSlotIds must identify a feasible kiln -> nori -> loop route",
    );
  }

  const kilnSlots = providerEntries.get("kiln")?.slots ?? [];
  const noriSlots = providerEntries.get("nori")?.slots ?? [];
  const loopSlots = providerEntries.get("loop")?.slots ?? [];
  let completeRouteExists = false;
  routeSearch: for (const kilnSlot of kilnSlots) {
    for (const noriSlot of noriSlots) {
      for (const loopSlot of loopSlots) {
        if (routeIsFeasible([kilnSlot, noriSlot, loopSlot])) {
          completeRouteExists = true;
          break routeSearch;
        }
      }
    }
  }
  if (!completeRouteExists) {
    issues.push(
      "/providers do not contain a complete feasible three-Provider route",
    );
  }

  return issues;
};

export const validateAreaDataPack = (
  value: unknown,
): ValidationResult<AreaDataPack> =>
  validateWith<AreaDataPack>(
    areaDataPackValidator,
    value,
    areaPackSemanticIssues,
  );

const promotionGateIssues = (gates: AreaPackPromotionGates): string[] => [
  ...(gates.protectedReset ? [] : ["/promotion/protectedReset must pass"]),
  ...(gates.reliability ? [] : ["/promotion/reliability must pass"]),
  ...(gates.productionE2E ? [] : ["/promotion/productionE2E must pass"]),
];

export const evaluateAreaPackPromotion = (
  value: unknown,
  gates: AreaPackPromotionGates,
): AreaPackPromotionEvaluation => {
  const validation = validateAreaDataPack(value);
  if (!validation.ok) {
    return { eligible: false, issues: validation.issues };
  }
  const issues = [
    ...(validation.value.status === "CANDIDATE"
      ? []
      : ["/status must be CANDIDATE before promotion"]),
    ...promotionGateIssues(gates),
  ];
  return { eligible: issues.length === 0, issues };
};

export const canExposeAreaDataPack = (
  value: unknown,
  gates: AreaPackPromotionGates,
): boolean => {
  const validation = validateAreaDataPack(value);
  return (
    validation.ok &&
    validation.value.status === "ACTIVE" &&
    ACTIVE_AREA_SLUGS.includes(
      validation.value.area.slug as (typeof ACTIVE_AREA_SLUGS)[number],
    ) &&
    promotionGateIssues(gates).length === 0
  );
};

export const validateBundleSummary = (
  value: unknown,
): ValidationResult<BundleSummary> =>
  validateWith<BundleSummary>(bundleValidator, value, (bundle) => {
    const providers = bundle.items.map((item) => item.slot.provider);
    const positions = bundle.items.map((item) => item.position);
    const issues: string[] = [];
    if (new Set(providers).size !== PROVIDERS.length) {
      issues.push("/items must contain one item per Provider");
    }
    if (positions.some((position, index) => position !== index)) {
      issues.push("/items positions must be 0, 1, 2 in order");
    }
    return issues;
  });

export const validateProviderSearchEnvelope = (
  value: unknown,
): ValidationResult<ProviderSearchEnvelope> =>
  validateWith<ProviderSearchEnvelope>(
    providerSearchEnvelopeValidator,
    value,
    (envelope) => {
      if (!envelope.ok) return [];
      return envelope.data.slots.some(
        (slot) => slot.provider !== envelope.data.provider,
      )
        ? ["/data/slots Provider must match /data/provider"]
        : [];
    },
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const sanitizeError = (value: unknown): PublicError => {
  const source = isRecord(value) ? value : {};
  const code = ERROR_CODES.includes(source.code as ErrorCode)
    ? (source.code as ErrorCode)
    : "INTERNAL_ERROR";
  const message =
    typeof source.message === "string" && source.message.length > 0
      ? source.message.slice(0, 240)
      : "Something went wrong.";
  const sanitized: PublicError = {
    code,
    message,
    retryable: typeof source.retryable === "boolean" ? source.retryable : true,
  };
  if (PROVIDERS.includes(source.provider as Provider)) {
    sanitized.provider = source.provider as Provider;
  }
  if (
    typeof source.safeReference === "string" &&
    source.safeReference.length > 0 &&
    source.safeReference.length <= 128
  ) {
    sanitized.safeReference = source.safeReference;
  }
  return sanitized;
};

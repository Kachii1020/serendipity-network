import "server-only";

type FetchLike = typeof globalThis.fetch;

export type GoogleAttributionV3 = Readonly<{
  provider: string;
  providerUri?: string;
}>;

export type GoogleMoneyV3 = Readonly<{
  currencyCode: string;
  units: string;
  nanos?: number;
}>;

export type GooglePlaceEnrichmentV3 = Readonly<{
  attributions: readonly GoogleAttributionV3[];
  businessStatus?:
    | "OPERATIONAL"
    | "CLOSED_TEMPORARILY"
    | "CLOSED_PERMANENTLY"
    | "FUTURE_OPENING";
  checkedAt: string;
  googleMapsUri?: string;
  openForRequestedWindow: boolean | null;
  placeId: string;
  priceLevel?: string;
  priceRange?: Readonly<{
    endPrice?: GoogleMoneyV3;
    startPrice?: GoogleMoneyV3;
  }>;
  status: "DISABLED" | "ENRICHED" | "UNAVAILABLE";
}>;

type GooglePeriodPoint = Readonly<{
  day?: number;
  hour?: number;
  minute?: number;
}>;

type GooglePeriod = Readonly<{
  close?: GooglePeriodPoint;
  open?: GooglePeriodPoint;
}>;

const FIELD_MASK = [
  "id",
  "businessStatus",
  "currentOpeningHours.periods",
  "priceLevel",
  "priceRange",
  "googleMapsUri",
  "attributions",
].join(",");

const safeText = (value: unknown, max = 300): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  !/[<>]/.test(value);

const safeHttps = (value: unknown): value is string => {
  if (!safeText(value, 500)) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const money = (value: unknown): GoogleMoneyV3 | undefined => {
  if (
    !record(value) ||
    value.currencyCode !== "JPY" ||
    typeof value.units !== "string"
  ) {
    return undefined;
  }
  const units = value.units;
  if (!/^\d{1,9}$/.test(units)) return undefined;
  const nanos = Number(value.nanos ?? 0);
  if (!Number.isInteger(nanos) || nanos < 0 || nanos > 999_999_999) {
    return undefined;
  }
  return nanos === 0
    ? { currencyCode: "JPY", units }
    : { currencyCode: "JPY", nanos, units };
};

const minuteOfWeek = (point: GooglePeriodPoint): number | null => {
  if (
    !Number.isInteger(point.day) ||
    !Number.isInteger(point.hour) ||
    !Number.isInteger(point.minute) ||
    point.day! < 0 ||
    point.day! > 6 ||
    point.hour! < 0 ||
    point.hour! > 23 ||
    point.minute! < 0 ||
    point.minute! > 59
  ) {
    return null;
  }
  return point.day! * 1440 + point.hour! * 60 + point.minute!;
};

const tokyoMinuteOfWeek = (timestamp: string): number | null => {
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).formatToParts(parsed);
  const weekday = parts.find(({ type }) => type === "weekday")?.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekday ?? "",
  );
  const hour = Number(parts.find(({ type }) => type === "hour")?.value);
  const minute = Number(parts.find(({ type }) => type === "minute")?.value);
  return day >= 0 && Number.isFinite(hour) && Number.isFinite(minute)
    ? day * 1440 + hour * 60 + minute
    : null;
};

const coversWindow = (
  periods: readonly GooglePeriod[],
  startsAt: string,
  endsAt: string,
): boolean | null => {
  const start = tokyoMinuteOfWeek(startsAt);
  const end = tokyoMinuteOfWeek(endsAt);
  if (start === null || end === null) return null;
  for (const period of periods) {
    const opens = period.open ? minuteOfWeek(period.open) : null;
    const closes = period.close ? minuteOfWeek(period.close) : null;
    if (opens === null) continue;
    if (closes === null) return true;
    const normalizedClose = closes <= opens ? closes + 7 * 1440 : closes;
    const normalizedEnd = end < start ? end + 7 * 1440 : end;
    if (start >= opens && normalizedEnd <= normalizedClose) return true;
  }
  return periods.length > 0 ? false : null;
};

const unavailable = (
  placeId: string,
  status: "DISABLED" | "UNAVAILABLE",
  clock: () => Date,
): GooglePlaceEnrichmentV3 => ({
  attributions: [],
  checkedAt: clock().toISOString(),
  openForRequestedWindow: null,
  placeId,
  status,
});

export const fetchGooglePlaceEnrichmentV3 = async ({
  allowedPlaceIds,
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
  clock = () => new Date(),
  enabled = process.env.GOOGLE_PLACES_ENABLED === "true",
  endsAt,
  fetchImpl = globalThis.fetch,
  placeId,
  signal,
  startsAt,
}: {
  readonly allowedPlaceIds: ReadonlySet<string>;
  readonly apiKey?: string;
  readonly clock?: () => Date;
  readonly enabled?: boolean;
  readonly endsAt: string;
  readonly fetchImpl?: FetchLike;
  readonly placeId: string;
  readonly signal?: AbortSignal;
  readonly startsAt: string;
}): Promise<GooglePlaceEnrichmentV3> => {
  if (!allowedPlaceIds.has(placeId)) {
    return unavailable(placeId, "UNAVAILABLE", clock);
  }
  if (!enabled || !apiKey) return unavailable(placeId, "DISABLED", clock);
  const timeout = AbortSignal.timeout(2_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetchImpl(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        signal: combined,
      },
    );
    if (!response.ok) return unavailable(placeId, "UNAVAILABLE", clock);
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > 32_768) {
      return unavailable(placeId, "UNAVAILABLE", clock);
    }
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.id !== placeId) {
      return unavailable(placeId, "UNAVAILABLE", clock);
    }
    const businessStatus = [
      "OPERATIONAL",
      "CLOSED_TEMPORARILY",
      "CLOSED_PERMANENTLY",
      "FUTURE_OPENING",
    ].includes(String(value.businessStatus))
      ? (value.businessStatus as GooglePlaceEnrichmentV3["businessStatus"])
      : undefined;
    const hours = record(value.currentOpeningHours)
      ? value.currentOpeningHours.periods
      : undefined;
    const periods: GooglePeriod[] = Array.isArray(hours)
      ? hours.filter(record).map((period) => ({
          ...(record(period.close) ? { close: period.close } : {}),
          ...(record(period.open) ? { open: period.open } : {}),
        }))
      : [];
    const attributions: GoogleAttributionV3[] = Array.isArray(
      value.attributions,
    )
      ? value.attributions.flatMap((item) => {
          if (!record(item) || !safeText(item.provider, 120)) return [];
          return [
            {
              provider: item.provider,
              ...(safeHttps(item.providerUri)
                ? { providerUri: item.providerUri }
                : {}),
            },
          ];
        })
      : [];
    const priceRange = record(value.priceRange)
      ? {
          ...(money(value.priceRange.startPrice)
            ? { startPrice: money(value.priceRange.startPrice)! }
            : {}),
          ...(money(value.priceRange.endPrice)
            ? { endPrice: money(value.priceRange.endPrice)! }
            : {}),
        }
      : undefined;
    const explicitlyClosed =
      businessStatus !== undefined && businessStatus !== "OPERATIONAL";
    return {
      attributions,
      ...(businessStatus ? { businessStatus } : {}),
      checkedAt: clock().toISOString(),
      ...(safeHttps(value.googleMapsUri)
        ? { googleMapsUri: value.googleMapsUri }
        : {}),
      openForRequestedWindow: explicitlyClosed
        ? false
        : coversWindow(periods, startsAt, endsAt),
      placeId,
      ...(safeText(value.priceLevel, 80)
        ? { priceLevel: value.priceLevel }
        : {}),
      ...(priceRange && Object.keys(priceRange).length > 0
        ? { priceRange }
        : {}),
      status: "ENRICHED",
    };
  } catch {
    return unavailable(placeId, "UNAVAILABLE", clock);
  }
};

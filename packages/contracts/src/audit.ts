import { PROVIDERS } from "./schemas/common";

type Provider = (typeof PROVIDERS)[number];

export type SafeAuditFacts = Partial<{
  bundleId: string;
  candidateCount: number;
  failedProvider: Provider;
  httpStatus: number;
  retryCount: number;
  slotCount: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBoundedCount = (value: unknown): value is number =>
  Number.isInteger(value) &&
  typeof value === "number" &&
  value >= 0 &&
  value <= 10_000;

const isProvider = (value: unknown): value is Provider =>
  typeof value === "string" && PROVIDERS.some((provider) => provider === value);

/** Projects arbitrary input onto the small set of facts approved for durable logs. */
export const buildSafeAuditFacts = (value: unknown): SafeAuditFacts => {
  if (!isRecord(value)) return {};

  const safe: SafeAuditFacts = {};
  if (
    typeof value.bundleId === "string" &&
    value.bundleId.length > 0 &&
    value.bundleId.length <= 128
  ) {
    safe.bundleId = value.bundleId;
  }
  if (isBoundedCount(value.candidateCount)) {
    safe.candidateCount = value.candidateCount;
  }
  if (isProvider(value.failedProvider)) {
    safe.failedProvider = value.failedProvider;
  }
  if (
    typeof value.httpStatus === "number" &&
    Number.isInteger(value.httpStatus) &&
    value.httpStatus >= 100 &&
    value.httpStatus <= 599
  ) {
    safe.httpStatus = value.httpStatus;
  }
  if (isBoundedCount(value.retryCount)) {
    safe.retryCount = value.retryCount;
  }
  if (isBoundedCount(value.slotCount)) {
    safe.slotCount = value.slotCount;
  }
  return safe;
};

export type AuditStatus = "STARTED" | "SUCCESS" | "ERROR" | "CANCELLED";

export type AuditEvent = {
  browserSessionId?: string;
  bundleSessionId?: string;
  correlationId: string;
  durationMs?: number;
  errorCode?: string;
  facts?: unknown;
  operation: string;
  origin: string;
  providerId?: string;
  status: AuditStatus;
};

export type AuditRow = {
  browser_session_id: string | null;
  bundle_session_id: string | null;
  correlation_id: string;
  duration_ms: number | null;
  error_code: string | null;
  operation: string;
  origin: string;
  provider_id: string | null;
  safe_payload: SafeAuditFacts;
  status: AuditStatus;
};

const boundedText = (
  value: string,
  name: string,
  maxLength: number,
): string => {
  if (value.length === 0 || value.length > maxLength) {
    throw new Error(`${name} must contain 1-${maxLength} characters`);
  }
  return value;
};

export const buildAuditRow = (event: AuditEvent): AuditRow => ({
  browser_session_id: event.browserSessionId ?? null,
  bundle_session_id: event.bundleSessionId ?? null,
  correlation_id: event.correlationId,
  duration_ms:
    event.durationMs !== undefined &&
    Number.isInteger(event.durationMs) &&
    event.durationMs >= 0
      ? event.durationMs
      : null,
  error_code:
    event.errorCode === undefined
      ? null
      : boundedText(event.errorCode, "errorCode", 80),
  operation: boundedText(event.operation, "operation", 80),
  origin: boundedText(event.origin, "origin", 255),
  provider_id: event.providerId ?? null,
  safe_payload: buildSafeAuditFacts(event.facts),
  status: event.status,
});

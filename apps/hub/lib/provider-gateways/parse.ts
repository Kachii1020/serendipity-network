import {
  assertPublicPayloadSafe,
  contractValidators,
  enforceResultSize,
  sanitizeError,
  type Provider,
} from "@serendipity/contracts";

import {
  gatewayFailure,
  type ProviderGatewayResult,
  type ProviderResultMeta,
} from "./types";

type Envelope = {
  data?: unknown;
  error?: unknown;
  meta?: unknown;
  ok?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isMeta = (value: unknown): value is ProviderResultMeta =>
  isRecord(value) &&
  typeof value.completedAt === "string" &&
  typeof value.correlationId === "string" &&
  typeof value.origin === "string";

export const parseEnvelopeJson = (
  serialized: string,
  provider: Provider,
): Envelope | ProviderGatewayResult<never> => {
  if (!enforceResultSize(serialized).ok) {
    return gatewayFailure(
      provider,
      "VALIDATION_ERROR",
      "Provider result exceeded the public size limit.",
      "invalid",
      false,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    return gatewayFailure(
      provider,
      "VALIDATION_ERROR",
      "Provider returned malformed JSON.",
      "invalid",
      false,
    );
  }
  if (!contractValidators.providerResultEnvelope(value) || !isRecord(value)) {
    return gatewayFailure(
      provider,
      "VALIDATION_ERROR",
      "Provider result did not match the shared envelope.",
      "invalid",
      false,
    );
  }
  return value;
};

export const parsePublicProviderEnvelope = <T>(
  serialized: string,
  provider: Provider,
  validateData: (value: unknown) => boolean,
): ProviderGatewayResult<T> => {
  const envelope = parseEnvelopeJson(serialized, provider);
  if ("failureType" in envelope) return envelope;
  const meta = isMeta(envelope.meta) ? envelope.meta : undefined;
  if (envelope.ok === false) {
    const error = sanitizeError(envelope.error);
    return {
      error: { ...error, provider: error.provider ?? provider },
      failureType: "provider",
      ...(meta ? { meta } : {}),
      ok: false,
    };
  }
  if (
    envelope.ok !== true ||
    !validateData(envelope.data) ||
    !isRecord(envelope.data) ||
    envelope.data.provider !== provider ||
    !meta
  ) {
    return gatewayFailure(
      provider,
      "VALIDATION_ERROR",
      "Provider data did not match the requested operation.",
      "invalid",
      false,
    );
  }
  const safe = assertPublicPayloadSafe(envelope.data);
  if (!safe.ok) {
    return gatewayFailure(
      provider,
      "VALIDATION_ERROR",
      "Provider data contained a private field.",
      "invalid",
      false,
    );
  }
  return { data: envelope.data as T, meta, ok: true };
};

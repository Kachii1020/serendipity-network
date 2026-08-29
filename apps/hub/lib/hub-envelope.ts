import {
  SCHEMA_VERSION,
  assertPublicPayloadSafe,
  contractValidators,
  enforceResultSize,
  type PublicError,
} from "@serendipity/contracts";
import { parseExactOrigin } from "@serendipity/provider-config";

export type HubEnvelopeContext = {
  clock?: () => Date;
  correlationId?: () => string;
  origin: string;
};

const meta = (context: HubEnvelopeContext) => ({
  completedAt: (context.clock ?? (() => new Date()))().toISOString(),
  correlationId: context.correlationId?.() ?? globalThis.crypto.randomUUID(),
  origin: parseExactOrigin(context.origin),
});

const assertEnvelope = (envelope: unknown): void => {
  if (!contractValidators.providerResultEnvelope(envelope)) {
    throw new Error("Hub envelope violated the shared result contract");
  }
  const safe = assertPublicPayloadSafe(envelope);
  if (!safe.ok) throw new Error("Hub envelope contained a private field");
  if (!enforceResultSize(envelope).ok) {
    throw new Error("Hub envelope exceeded the public size limit");
  }
};

export const createHubSuccessEnvelope = <T>(
  data: T,
  context: HubEnvelopeContext,
) => {
  const envelope = {
    data,
    meta: meta(context),
    ok: true as const,
    schemaVersion: SCHEMA_VERSION,
  };
  assertEnvelope(envelope);
  return envelope;
};

export const createHubFailureEnvelope = (
  error: PublicError,
  context: HubEnvelopeContext,
) => {
  const envelope = {
    error,
    meta: meta(context),
    ok: false as const,
    schemaVersion: SCHEMA_VERSION,
  };
  assertEnvelope(envelope);
  return envelope;
};

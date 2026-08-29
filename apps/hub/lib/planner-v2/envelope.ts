import "server-only";

import { randomUUID } from "node:crypto";

import {
  PLANNER_SCHEMA_VERSION,
  validatePlannerEnvelopeV2,
  type PlannerEnvelopeV2,
  type PlannerErrorCodeV2,
} from "@serendipity/contracts/planner-v2";
import { assertPublicPayloadSafe } from "@serendipity/contracts";

export const PLANNER_V2_MAX_RESPONSE_BYTES = 65_536;

export type PlannerV2PublicError = {
  code: PlannerErrorCodeV2;
  message: string;
  retryable: boolean;
};

export type PlannerV2EnvelopeContext = {
  clock?: () => Date;
  correlationId?: () => string;
  origin: string;
  packVersion: string;
};

const exactResponseOrigin = (value: string): string => {
  const parsed = new URL(value);
  const localHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error("Planner response origin must use HTTPS outside localhost");
  }
  return parsed.origin;
};

const createMeta = (context: PlannerV2EnvelopeContext) => ({
  completedAt: (context.clock ?? (() => new Date()))().toISOString(),
  correlationId: context.correlationId?.() ?? randomUUID(),
  origin: exactResponseOrigin(context.origin),
  packVersion: context.packVersion,
});

export const createPlannerSuccessEnvelope = <T>(
  data: T,
  context: PlannerV2EnvelopeContext,
): PlannerEnvelopeV2<T> => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  ok: true,
  data,
  meta: createMeta(context),
});

export const createPlannerFailureEnvelope = (
  error: PlannerV2PublicError,
  context: PlannerV2EnvelopeContext,
): PlannerEnvelopeV2<never> => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  ok: false,
  error,
  meta: createMeta(context),
});

const serializeSafeEnvelope = (
  envelope: PlannerEnvelopeV2<unknown>,
): string | undefined => {
  if (
    !validatePlannerEnvelopeV2(envelope).ok ||
    !assertPublicPayloadSafe(envelope).ok
  ) {
    return undefined;
  }
  const serialized = JSON.stringify(envelope);
  return new TextEncoder().encode(serialized).byteLength <=
    PLANNER_V2_MAX_RESPONSE_BYTES
    ? serialized
    : undefined;
};

const responseHeaders = (correlationId: string): Headers =>
  new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-correlation-id": correlationId,
  });

export const plannerJsonResponse = (
  envelope: PlannerEnvelopeV2<unknown>,
  status: number,
  context: PlannerV2EnvelopeContext,
): Response => {
  const serialized = serializeSafeEnvelope(envelope);
  if (serialized) {
    return new Response(serialized, {
      headers: responseHeaders(envelope.meta.correlationId),
      status,
    });
  }

  const fallback = createPlannerFailureEnvelope(
    {
      code: "INTERNAL_ERROR",
      message: "The planner could not return a safe result.",
      retryable: true,
    },
    context,
  );
  const fallbackSerialized = serializeSafeEnvelope(fallback);
  if (!fallbackSerialized) {
    throw new Error("Planner fallback envelope violated the response boundary");
  }
  return new Response(fallbackSerialized, {
    headers: responseHeaders(fallback.meta.correlationId),
    status: 500,
  });
};

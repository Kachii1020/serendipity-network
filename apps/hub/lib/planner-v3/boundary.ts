import "server-only";

import { randomUUID } from "node:crypto";

import {
  PLANNER_V3_AREAS,
  PLANNER_V3_SCHEMA_VERSION,
  type PlannerAreaV3,
  type PlannerEnvelopeV3,
  type PlannerPublicErrorV3,
} from "@serendipity/contracts/planner-v3";
import { validatePlannerEnvelopeV3Client } from "@serendipity/contracts/planner-v3-shared";
import { assertPublicPayloadSafe } from "@serendipity/contracts/public-safety";

import type { PlannerV3OperationResult } from "./runtime";

export const PLANNER_V3_MAX_REQUEST_BYTES = 16_384;
export const PLANNER_V3_MAX_RESPONSE_BYTES = 65_536;

export type PlannerV3EnvelopeContext = Readonly<{
  area: PlannerAreaV3 | null;
  clock?: () => Date;
  correlationId: string;
  origin: string;
  packVersion: string | null;
}>;

const exactOrigin = (value: string): string => {
  const parsed = new URL(value);
  const local =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !local) {
    throw new Error("Planner v3 responses require a secure origin");
  }
  return parsed.origin;
};

const meta = (context: PlannerV3EnvelopeContext) => ({
  correlationId: context.correlationId,
  origin: exactOrigin(context.origin),
  completedAt: (context.clock ?? (() => new Date()))().toISOString(),
  packVersion: context.packVersion,
  area: context.area,
});

export const createPlannerV3SuccessEnvelope = <T>(
  data: T,
  context: PlannerV3EnvelopeContext,
): PlannerEnvelopeV3<T> => ({
  schemaVersion: PLANNER_V3_SCHEMA_VERSION,
  ok: true,
  data,
  meta: meta(context),
});

export const createPlannerV3FailureEnvelope = (
  error: PlannerPublicErrorV3,
  context: PlannerV3EnvelopeContext,
): PlannerEnvelopeV3<never> => ({
  schemaVersion: PLANNER_V3_SCHEMA_VERSION,
  ok: false,
  error,
  meta: meta(context),
});

const responseHeaders = (correlationId: string): Headers =>
  new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-correlation-id": correlationId,
  });

const serializeEnvelope = (
  envelope: PlannerEnvelopeV3<unknown>,
): string | null => {
  if (
    !validatePlannerEnvelopeV3Client(envelope) ||
    !assertPublicPayloadSafe(envelope).ok
  ) {
    return null;
  }
  const serialized = JSON.stringify(envelope);
  return new TextEncoder().encode(serialized).byteLength <=
    PLANNER_V3_MAX_RESPONSE_BYTES
    ? serialized
    : null;
};

export const plannerV3JsonResponse = (
  envelope: PlannerEnvelopeV3<unknown>,
  status: number,
  context: PlannerV3EnvelopeContext,
): Response => {
  const serialized = serializeEnvelope(envelope);
  if (serialized) {
    return new Response(serialized, {
      headers: responseHeaders(envelope.meta.correlationId),
      status,
    });
  }
  const fallback = createPlannerV3FailureEnvelope(
    {
      code: "INTERNAL_ERROR",
      message: "The planner could not return a safe result.",
      retryable: true,
    },
    context,
  );
  const safeFallback = serializeEnvelope(fallback);
  if (!safeFallback) throw new Error("Unsafe planner v3 fallback envelope");
  return new Response(safeFallback, {
    headers: responseHeaders(fallback.meta.correlationId),
    status: 500,
  });
};

const correlationPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const plannerV3CorrelationId = (request: Request): string => {
  const candidate = request.headers.get("x-correlation-id")?.trim();
  return candidate && correlationPattern.test(candidate)
    ? candidate
    : randomUUID();
};

export const plannerV3AreaFromValue = (
  value: unknown,
): PlannerAreaV3 | null => {
  if (typeof value !== "object" || value === null || !("area" in value)) {
    return null;
  }
  const area = (value as { area?: unknown }).area;
  return PLANNER_V3_AREAS.find((candidate) => candidate === area) ?? null;
};

export const parsePlannerV3Json = async (
  request: Request,
): Promise<
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{
      ok: false;
      code: "INVALID_JSON" | "TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE";
    }>
> => {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0];
  if (mediaType !== "application/json") {
    return { ok: false, code: "UNSUPPORTED_MEDIA_TYPE" };
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > PLANNER_V3_MAX_REQUEST_BYTES
  ) {
    return { ok: false, code: "TOO_LARGE" };
  }
  const serialized = await request.text();
  if (
    new TextEncoder().encode(serialized).byteLength >
    PLANNER_V3_MAX_REQUEST_BYTES
  ) {
    return { ok: false, code: "TOO_LARGE" };
  }
  try {
    return { ok: true, value: JSON.parse(serialized) as unknown };
  } catch {
    return { ok: false, code: "INVALID_JSON" };
  }
};

export const plannerV3StatusForError = (
  code: PlannerPublicErrorV3["code"],
): number => {
  if (code === "NO_VALID_PLAN" || code === "NO_REPLACEMENT") return 200;
  if (code === "PLACE_NOT_FOUND") return 404;
  if (
    code === "AREA_NOT_ACTIVE" ||
    code === "STALE_DATA_PACK" ||
    code === "STALE_PLAN"
  ) {
    return 409;
  }
  if (code === "CANCELLED") return 499;
  if (code === "VALIDATION_ERROR" || code === "UNSUPPORTED_SCHEMA_VERSION") {
    return 400;
  }
  return 500;
};

type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      code: "VALIDATION_ERROR" | "UNSUPPORTED_SCHEMA_VERSION";
      issues: string[];
    }>;

export const createPlannerV3PostHandler = <TInput, TData>(options: {
  execute(
    input: TInput,
    signal: AbortSignal,
  ): Promise<PlannerV3OperationResult<TData>> | PlannerV3OperationResult<TData>;
  validate(value: unknown): ValidationResult<TInput>;
}): ((request: Request) => Promise<Response>) =>
  async function post(request: Request): Promise<Response> {
    const correlationId = plannerV3CorrelationId(request);
    const origin = new URL(request.url).origin;
    const baseContext = {
      area: null,
      correlationId,
      origin,
      packVersion: null,
    } as const;
    const parsed = await parsePlannerV3Json(request);
    if (!parsed.ok) {
      const status =
        parsed.code === "TOO_LARGE"
          ? 413
          : parsed.code === "UNSUPPORTED_MEDIA_TYPE"
            ? 415
            : 400;
      return plannerV3JsonResponse(
        createPlannerV3FailureEnvelope(
          {
            code: "VALIDATION_ERROR",
            message:
              parsed.code === "TOO_LARGE"
                ? "The request exceeded the 16 KB limit."
                : parsed.code === "UNSUPPORTED_MEDIA_TYPE"
                  ? "The request must use application/json."
                  : "The request body was not valid JSON.",
            retryable: false,
          },
          baseContext,
        ),
        status,
        baseContext,
      );
    }
    const area = plannerV3AreaFromValue(parsed.value);
    const validation = options.validate(parsed.value);
    if (!validation.ok) {
      const context = { ...baseContext, area };
      return plannerV3JsonResponse(
        createPlannerV3FailureEnvelope(
          {
            code: validation.code,
            message: "The request did not match the planner v3 contract.",
            retryable: false,
          },
          context,
        ),
        400,
        context,
      );
    }
    try {
      const result = await options.execute(validation.value, request.signal);
      const context = {
        area: result.area,
        correlationId,
        origin,
        packVersion: result.packVersion,
      };
      const envelope = result.ok
        ? createPlannerV3SuccessEnvelope(result.data, context)
        : createPlannerV3FailureEnvelope(result.error, context);
      return plannerV3JsonResponse(
        envelope,
        result.ok ? 200 : plannerV3StatusForError(result.error.code),
        context,
      );
    } catch (cause) {
      const cancelled =
        request.signal.aborted ||
        (cause instanceof Error && cause.name === "AbortError");
      const context = { ...baseContext, area };
      return plannerV3JsonResponse(
        createPlannerV3FailureEnvelope(
          {
            code: cancelled ? "CANCELLED" : "INTERNAL_ERROR",
            message: cancelled
              ? "The planner request was cancelled."
              : "The planner request could not be completed.",
            retryable: true,
          },
          context,
        ),
        cancelled ? 499 : 500,
        context,
      );
    }
  };

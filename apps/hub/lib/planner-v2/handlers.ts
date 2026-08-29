import "server-only";

import {
  createPlannerFailureEnvelope,
  createPlannerSuccessEnvelope,
  plannerJsonResponse,
  type PlannerV2EnvelopeContext,
  type PlannerV2PublicError,
} from "./envelope";
import { parsePlannerJson, plannerRequestCorrelationId } from "./request";

export type PlannerV2OperationResult<T> =
  { data: T; ok: true } | { error: PlannerV2PublicError; ok: false };

export type PlannerV2PostDependencies<TInput, TData> = {
  execute: (
    input: TInput,
    signal: AbortSignal,
  ) =>
    PlannerV2OperationResult<TData> | Promise<PlannerV2OperationResult<TData>>;
  validate: (value: unknown) =>
    | { ok: true; value: TInput }
    | {
        code: "UNSUPPORTED_SCHEMA_VERSION" | "VALIDATION_ERROR";
        issues: readonly string[];
        ok: false;
      };
  packVersion: string;
};

const failure = (
  context: PlannerV2EnvelopeContext,
  error: PlannerV2PublicError,
  status: number,
): Response =>
  plannerJsonResponse(
    createPlannerFailureEnvelope(error, context),
    status,
    context,
  );

const requestContext = (
  request: Request,
  correlationId: string,
  packVersion: string,
): PlannerV2EnvelopeContext => ({
  correlationId: () => correlationId,
  origin: new URL(request.url).origin,
  packVersion,
});

const requestError = (
  reason: "INVALID_JSON" | "TOO_LARGE",
): PlannerV2PublicError => ({
  code: "VALIDATION_ERROR",
  message:
    reason === "TOO_LARGE"
      ? "The planner request exceeded the 16 KB limit."
      : "The planner request was not valid JSON.",
  retryable: false,
});

const validationError = (
  code: "UNSUPPORTED_SCHEMA_VERSION" | "VALIDATION_ERROR",
): PlannerV2PublicError => ({
  code,
  message:
    code === "UNSUPPORTED_SCHEMA_VERSION"
      ? "The planner schema version is not supported."
      : "The request did not match the planner contract.",
  retryable: false,
});

const isAbortError = (cause: unknown, signal: AbortSignal): boolean =>
  signal.aborted ||
  (cause instanceof Error &&
    (cause.name === "AbortError" || /abort/i.test(cause.message)));

export const plannerStatusForError = (code: string): number => {
  switch (code) {
    case "NO_VALID_PLAN":
    case "NO_REPLACEMENT":
      return 200;
    case "PLACE_NOT_FOUND":
      return 404;
    case "STALE_DATA_PACK":
    case "STALE_PLAN":
      return 409;
    case "CANCELLED":
      return 499;
    case "UNSUPPORTED_SCHEMA_VERSION":
    case "VALIDATION_ERROR":
      return 400;
    case "INTERNAL_ERROR":
    case "STORAGE_LIMIT_REACHED":
    case "STORAGE_CORRUPT":
    case "STORAGE_UNAVAILABLE":
      return 500;
    default:
      return 500;
  }
};

export const createPlannerPostHandler = <TInput, TData>(
  dependencies: PlannerV2PostDependencies<TInput, TData>,
): ((request: Request) => Promise<Response>) =>
  async function plannerPost(request: Request): Promise<Response> {
    const correlationId = plannerRequestCorrelationId(request);
    const context = requestContext(
      request,
      correlationId,
      dependencies.packVersion,
    );
    let parsed: Awaited<ReturnType<typeof parsePlannerJson>>;
    try {
      parsed = await parsePlannerJson(request);
    } catch (cause) {
      const cancelled = isAbortError(cause, request.signal);
      return failure(
        context,
        cancelled
          ? {
              code: "CANCELLED",
              message: "The planner request was cancelled.",
              retryable: true,
            }
          : {
              code: "INTERNAL_ERROR",
              message: "The planner request body could not be read.",
              retryable: true,
            },
        cancelled ? 499 : 500,
      );
    }
    if (!parsed.ok) {
      return failure(context, requestError(parsed.reason), 400);
    }

    const validated = dependencies.validate(parsed.value);
    if (!validated.ok) {
      return failure(context, validationError(validated.code), 400);
    }

    try {
      const result = await dependencies.execute(
        validated.value,
        request.signal,
      );
      if (!result.ok) {
        return failure(
          context,
          result.error,
          plannerStatusForError(result.error.code),
        );
      }
      return plannerJsonResponse(
        createPlannerSuccessEnvelope(result.data, context),
        200,
        context,
      );
    } catch (cause) {
      const publicError: PlannerV2PublicError = isAbortError(
        cause,
        request.signal,
      )
        ? {
            code: "CANCELLED",
            message: "The planner request was cancelled.",
            retryable: true,
          }
        : {
            code: "INTERNAL_ERROR",
            message: "The planner request could not be completed.",
            retryable: true,
          };
      return failure(
        context,
        publicError,
        plannerStatusForError(publicError.code),
      );
    }
  };

export type PlannerV2EvidenceDependencies<TData> = {
  getEvidence: (
    placeId: string,
  ) =>
    PlannerV2OperationResult<TData> | Promise<PlannerV2OperationResult<TData>>;
  packVersion: string;
};

const PLACE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createPlannerEvidenceHandler = <TData>(
  dependencies: PlannerV2EvidenceDependencies<TData>,
): ((request: Request, placeId: string) => Promise<Response>) =>
  async function plannerEvidence(
    request: Request,
    placeId: string,
  ): Promise<Response> {
    const correlationId = plannerRequestCorrelationId(request);
    const context = requestContext(
      request,
      correlationId,
      dependencies.packVersion,
    );
    if (
      placeId.length === 0 ||
      placeId.length > 128 ||
      !PLACE_ID_PATTERN.test(placeId)
    ) {
      return failure(context, validationError("VALIDATION_ERROR"), 400);
    }

    try {
      const result = await dependencies.getEvidence(placeId);
      if (!result.ok) {
        return failure(
          context,
          result.error,
          plannerStatusForError(result.error.code),
        );
      }
      return plannerJsonResponse(
        createPlannerSuccessEnvelope(result.data, context),
        200,
        context,
      );
    } catch {
      return failure(
        context,
        {
          code: "INTERNAL_ERROR",
          message: "The place evidence could not be loaded.",
          retryable: true,
        },
        500,
      );
    }
  };

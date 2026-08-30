import {
  PLANNER_V3_AREAS,
  isStrictTimestampV3,
} from "@serendipity/contracts/planner-v3";

import {
  createPlannerV3FailureEnvelope,
  createPlannerV3SuccessEnvelope,
  plannerV3CorrelationId,
  plannerV3JsonResponse,
  plannerV3StatusForError,
} from "../../../../../../../../lib/planner-v3/boundary";
import { DEFAULT_PLANNER_V3_RUNTIME } from "../../../../../../../../lib/planner-v3/runtime";

export const dynamic = "force-dynamic";

const placeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ area: string; placeId: string }> },
): Promise<Response> {
  const correlationId = plannerV3CorrelationId(request);
  const origin = new URL(request.url).origin;
  const { area: rawArea, placeId } = await context.params;
  const area = PLANNER_V3_AREAS.find((candidate) => candidate === rawArea);
  const emptyContext = {
    area: area ?? null,
    correlationId,
    origin,
    packVersion: null,
  } as const;
  const url = new URL(request.url);
  const allowedQueries = new Set(["startsAt", "endsAt"]);
  const unknownQuery = [...url.searchParams.keys()].some(
    (key) => !allowedQueries.has(key),
  );
  const startsAt = url.searchParams.get("startsAt");
  const endsAt = url.searchParams.get("endsAt");
  const completeWindow = startsAt !== null && endsAt !== null;
  const partialWindow = (startsAt === null) !== (endsAt === null);

  if (
    !area ||
    !placeIdPattern.test(placeId) ||
    unknownQuery ||
    partialWindow ||
    (completeWindow &&
      (!isStrictTimestampV3(startsAt) ||
        !startsAt.endsWith("+09:00") ||
        !isStrictTimestampV3(endsAt) ||
        !endsAt.endsWith("+09:00")))
  ) {
    return plannerV3JsonResponse(
      createPlannerV3FailureEnvelope(
        {
          code: "VALIDATION_ERROR",
          message: "The evidence request was invalid.",
          retryable: false,
        },
        emptyContext,
      ),
      400,
      emptyContext,
    );
  }

  try {
    const result = await DEFAULT_PLANNER_V3_RUNTIME.evidence(
      area,
      placeId,
      completeWindow ? { endsAt, startsAt } : undefined,
      request.signal,
    );
    const responseContext = {
      area: result.area,
      correlationId,
      origin,
      packVersion: result.packVersion,
    };
    return plannerV3JsonResponse(
      result.ok
        ? createPlannerV3SuccessEnvelope(result.data, responseContext)
        : createPlannerV3FailureEnvelope(result.error, responseContext),
      result.ok ? 200 : plannerV3StatusForError(result.error.code),
      responseContext,
    );
  } catch (cause) {
    const cancelled =
      request.signal.aborted ||
      (cause instanceof Error && cause.name === "AbortError");
    return plannerV3JsonResponse(
      createPlannerV3FailureEnvelope(
        {
          code: cancelled ? "CANCELLED" : "INTERNAL_ERROR",
          message: cancelled
            ? "The evidence request was cancelled."
            : "The evidence request could not be completed.",
          retryable: true,
        },
        emptyContext,
      ),
      cancelled ? 499 : 500,
      emptyContext,
    );
  }
}

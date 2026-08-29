import { createHash, timingSafeEqual } from "node:crypto";

import { createHubSupabaseClient } from "../../../../lib/server/supabase";
import { requestCorrelationId } from "../../../../lib/server/request";
import {
  routeFailure,
  routeSuccess,
} from "../../../../lib/server/route-response";

export const dynamic = "force-dynamic";

type DemoResetDependencies = {
  demoMode: boolean;
  hubOrigin: string;
  operatorSecret: string | null;
  reset: () => Promise<{ deletedHolds: number; restoredSlots: number }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const equalSecret = (left: string, right: string): boolean => {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
};

export const createDemoResetHandler =
  (dependencies: DemoResetDependencies) =>
  async (request: Request): Promise<Response> => {
    const correlationId = requestCorrelationId(request);
    const context = {
      correlationId,
      hubOrigin: dependencies.hubOrigin,
    };
    const presented = request.headers.get("x-serendipity-operator-secret");
    if (
      !dependencies.demoMode ||
      !dependencies.operatorSecret ||
      !presented ||
      !equalSecret(presented, dependencies.operatorSecret)
    ) {
      return routeFailure(
        {
          code: "TOOL_NOT_FOUND",
          message: "This endpoint is not available.",
          retryable: false,
        },
        404,
        context,
      );
    }
    try {
      const result = await dependencies.reset();
      return routeSuccess(
        {
          deletedHolds: result.deletedHolds,
          restoredSlots: result.restoredSlots,
          status: "RESET",
        },
        context,
      );
    } catch {
      return routeFailure(
        {
          code: "INTERNAL_ERROR",
          message: "The demo state could not be reset.",
          retryable: true,
        },
        500,
        context,
      );
    }
  };

const defaultHandler = (): ReturnType<typeof createDemoResetHandler> => {
  const hubOrigin =
    process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";
  return createDemoResetHandler({
    demoMode: process.env.DEMO_MODE === "true",
    hubOrigin,
    operatorSecret: process.env.DEMO_OPERATOR_SECRET?.trim() ?? null,
    async reset() {
      const client = createHubSupabaseClient();
      const rpcResult = (await client.rpc("reset_demo_state", {
        p_operator_scope: "serendipity-demo-v1",
      })) as unknown as { data: unknown; error: unknown };
      if (rpcResult.error) {
        throw new Error("reset_demo_state failed");
      }
      const { data } = rpcResult;
      const rows: unknown[] = Array.isArray(data)
        ? (data as unknown[])
        : [data];
      const row: unknown = rows[0];
      if (
        !isRecord(row) ||
        typeof row.deleted_holds !== "number" ||
        typeof row.restored_slots !== "number"
      ) {
        throw new Error("reset_demo_state returned an invalid result");
      }
      return {
        deletedHolds: row.deleted_holds,
        restoredSlots: row.restored_slots,
      };
    },
  });
};

export async function POST(request: Request): Promise<Response> {
  return defaultHandler()(request);
}

import { handleManualHold } from "../../../../../lib/server/manual-handlers";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  return handleManualHold(request, sessionId);
}

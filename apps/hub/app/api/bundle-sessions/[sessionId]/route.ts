import { handleBundleReload } from "../../../../lib/server/manual-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  return handleBundleReload(request, sessionId);
}

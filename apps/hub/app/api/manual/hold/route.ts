import { handleManualHold } from "../../../../lib/server/manual-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleManualHold(request);
}

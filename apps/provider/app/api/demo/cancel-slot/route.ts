import { getProviderApi } from "../../../../lib/server/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return getProviderApi().cancelDemoSlot(request);
}

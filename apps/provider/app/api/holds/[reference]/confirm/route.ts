import { getProviderApi } from "../../../../../lib/server/runtime";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ reference: string }> },
): Promise<Response> {
  const { reference } = await context.params;
  return getProviderApi().confirm(request, reference);
}

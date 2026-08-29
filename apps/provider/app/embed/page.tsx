import { randomUUID } from "node:crypto";
import { Suspense } from "react";

import { createScopedAccessToken } from "../../lib/server/security";
import { readProviderApiEnv } from "../../lib/server/runtime";
import { ProviderCard } from "./provider-card";
import { ProviderRuntime } from "./provider-runtime";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.phase0 === "1") {
    return (
      <Suspense
        fallback={<main className="provider-page">Preparing Provider…</main>}
      >
        <ProviderCard />
      </Suspense>
    );
  }

  const requestedSession =
    typeof params.session === "string" ? params.session : "";
  const browserSessionId = UUID_PATTERN.test(requestedSession)
    ? requestedSession
    : randomUUID();
  const environment = readProviderApiEnv();
  const accessToken = createScopedAccessToken(
    {
      audience: "provider-api",
      browserSessionId,
      expiresAt: Math.floor(Date.now() / 1_000) + 15 * 60,
      provider: environment.provider,
    },
    environment.accessSecret,
  );
  const exposedHubOrigin =
    process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";

  return (
    <Suspense
      fallback={<main className="provider-page">Preparing Provider…</main>}
    >
      <ProviderRuntime
        accessToken={accessToken}
        browserSessionId={browserSessionId}
        exposedHubOrigin={exposedHubOrigin}
      />
    </Suspense>
  );
}

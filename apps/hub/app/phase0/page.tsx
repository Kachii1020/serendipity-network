import { Suspense } from "react";

import { Phase0Hub } from "../../components/phase0-hub";

export default function Phase0Page() {
  const providerOrigins = (
    process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
    "http://localhost:3101,http://localhost:3102,http://localhost:3103"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (
    <Suspense
      fallback={<main className="shell">Preparing Phase 0 harness…</main>}
    >
      <Phase0Hub providerOrigins={providerOrigins.slice(0, 2)} />
    </Suspense>
  );
}

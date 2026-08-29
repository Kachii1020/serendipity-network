import type { Metadata } from "next";
import type { ReactNode } from "react";
import { resolveProviderConfig } from "@serendipity/provider-config";

import "@serendipity/ui/tokens.css";
import "./globals.css";

export function generateMetadata(): Metadata {
  const config = resolveProviderConfig(
    process.env.NEXT_PUBLIC_PROVIDER_SLUG ?? "kiln",
  );
  return {
    description: `${config.displayName}, an independent Serendipity Network Provider`,
    title: `${config.displayName} · Serendipity Provider`,
  };
}

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

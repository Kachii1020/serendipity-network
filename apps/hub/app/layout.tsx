import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import "./globals.css";
import "./marketing.css";
import "./planner-v2.css";
import "./planner-v3.css";
import "@serendipity/ui/tokens.css";
import "@serendipity/ui/primitives.css";

const inter = localFont({
  display: "swap",
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
});

const display = localFont({
  display: "swap",
  src: "./fonts/barlow-condensed-bold-latin.woff2",
  variable: "--font-display",
  weight: "700",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100",
  ),
  description:
    "Build a source-backed Tokyo evening across Shibuya, Shinjuku, or Ikebukuro with official menu prices.",
  openGraph: {
    description:
      "Two or three real Tokyo stops, official price evidence, and one feasible evening plan.",
    siteName: "Serendipity",
    title: "Serendipity · Build a source-backed Tokyo night",
    type: "website",
  },
  title: {
    default: "Serendipity · Build a source-backed Tokyo night",
    template: "%s · Serendipity",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "Two or three real Tokyo stops, official price evidence, and one feasible evening plan.",
    title: "Serendipity · Build a source-backed Tokyo night",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#dceeff",
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${display.variable}`}>
        {children}
      </body>
    </html>
  );
}

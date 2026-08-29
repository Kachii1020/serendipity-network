import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import "./globals.css";
import "./marketing.css";
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
    "Compose a spontaneous city night across independent live Provider sites. Launch network: Shibuya.",
  openGraph: {
    description:
      "One spontaneous Shibuya night, composed across three independent demo Providers.",
    siteName: "Serendipity",
    title: "Serendipity · Three places, one unexpectedly good night",
    type: "website",
  },
  title: {
    default: "Serendipity · Three places, one unexpectedly good night",
    template: "%s · Serendipity",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "One spontaneous Shibuya night, composed across three independent demo Providers.",
    title: "Serendipity · Three places, one unexpectedly good night",
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

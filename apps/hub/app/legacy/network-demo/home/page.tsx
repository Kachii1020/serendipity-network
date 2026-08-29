import type { Metadata } from "next";

import { LandingPage } from "../../../../components/marketing/landing-page";

export const metadata: Metadata = {
  description: "Archived product landing page for the Serendipity v1 demo.",
  robots: { follow: false, index: false },
  title: "Legacy Serendipity network demo",
};

export default function LegacyNetworkDemoHomePage() {
  return <LandingPage plannerHref="/legacy/network-demo" />;
}

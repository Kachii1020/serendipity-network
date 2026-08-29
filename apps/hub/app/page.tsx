import type { Metadata } from "next";

import { LandingPage } from "../components/marketing/landing-page";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Turn one free Shibuya evening into a feasible three-stop demo route across independent Provider sites.",
  title: "Three places, one unexpectedly good night",
};

export default function HomePage() {
  return <LandingPage />;
}

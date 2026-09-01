import type { Metadata } from "next";
import { connection } from "next/server";

import { PlannerLandingV3 } from "../components/planner-v3/planner-landing";
import {
  defaultPlannerFormV3,
  earliestPlannerStartV3,
  tokyoDateV3,
} from "../components/planner-v3/planner-query";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Build a source-backed Tokyo evening across Shibuya, Shinjuku, or Ikebukuro with official menu prices.",
  robots: { follow: true, index: true },
  title: "Build a source-backed Tokyo night",
};

export default async function HomePage() {
  await connection();
  const now = new Date();
  const defaults = defaultPlannerFormV3(now);
  return (
    <PlannerLandingV3
      defaults={defaults}
      earliestStartToday={earliestPlannerStartV3(defaults.date, now)}
      homePath="/"
      maxDate={tokyoDateV3(7, now)}
      minDate={defaults.date}
      plannerPath="/plan"
    />
  );
}

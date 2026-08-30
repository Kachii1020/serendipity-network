import type { Metadata } from "next";
import { connection } from "next/server";

import { PlannerLandingV3 } from "../../components/planner-v3/planner-landing";
import {
  defaultPlannerFormV3,
  earliestPlannerStartV3,
  tokyoDateV3,
} from "../../components/planner-v3/planner-query";

export const metadata: Metadata = {
  description:
    "Build a source-backed Tokyo route across Shibuya, Shinjuku, or Ikebukuro with an optional meal and official menu prices.",
  robots: { follow: false, index: false },
  title: "Tokyo 3-hub meal planner preview",
};

export default async function PlannerV3LandingPage() {
  await connection();
  const now = new Date();
  const defaults = defaultPlannerFormV3(now);
  return (
    <PlannerLandingV3
      defaults={defaults}
      earliestStartToday={earliestPlannerStartV3(defaults.date, now)}
      maxDate={tokyoDateV3(7, now)}
      minDate={defaults.date}
    />
  );
}

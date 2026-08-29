import type { Metadata } from "next";
import { connection } from "next/server";

import { PlannerLanding } from "../components/planner-v2/planner-landing";
import {
  defaultPlannerForm,
  earliestPlannerStart,
  tokyoDate,
} from "../components/planner-v2/planner-query";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../data/shibuya-v2";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Build a feasible Shibuya route from real places with published hours, visible price bases, walking estimates, and sources.",
  title: "A Shibuya plan you can verify",
};

export default async function HomePage() {
  await connection();
  const now = new Date();
  const defaults = defaultPlannerForm(now);
  const minDate = defaults.date;
  const requestedMaxDate = tokyoDate(7, now);
  const sourcePackValidThrough = SHIBUYA_ACTIVE_PACK_V2.validThrough.slice(
    0,
    10,
  );
  const maxDate =
    requestedMaxDate < sourcePackValidThrough
      ? requestedMaxDate
      : sourcePackValidThrough;
  const sourceById = new Map(
    SHIBUYA_ACTIVE_PACK_V2.sources.map((source) => [source.sourceId, source]),
  );
  const sampleIds = [
    "kawamoto-puppet-gallery",
    "hachilabo-science-center",
    "komorebi-owada-library",
  ];
  const sampleStops = sampleIds
    .map((placeId) =>
      SHIBUYA_ACTIVE_PACK_V2.places.find((place) => place.placeId === placeId),
    )
    .flatMap((place) =>
      place?.routeEligibility.kind === "ROUTABLE" ? [place] : [],
    )
    .map((place) => ({
      category: place.category,
      name: place.name,
      priceLabel:
        place.priceProvenance.kind ===
        "PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED"
          ? "¥0 planner reference · no mandatory admission price published"
          : place.price.minYen === place.price.maxYen
            ? `Published ¥${place.price.maxYen.toLocaleString("en-US")} · ${place.price.label}`
            : `¥${place.price.minYen.toLocaleString("en-US")}–¥${place.price.maxYen.toLocaleString("en-US")} · ${place.price.label}`,
      publisher:
        sourceById.get(place.evidence.identity.sourceId)?.publisher ??
        "Published source",
    }));

  return (
    <PlannerLanding
      available={minDate <= sourcePackValidThrough}
      defaults={defaults}
      earliestStartToday={earliestPlannerStart(minDate, now)}
      maxDate={maxDate}
      minDate={minDate}
      sampleStops={sampleStops}
      sourcePackValidThrough={sourcePackValidThrough}
    />
  );
}

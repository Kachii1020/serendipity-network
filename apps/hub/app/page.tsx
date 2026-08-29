import type { Metadata } from "next";
import { connection } from "next/server";

import { PlannerLanding } from "../components/planner-v2/planner-landing";
import {
  defaultPlannerForm,
  tokyoDate,
} from "../components/planner-v2/planner-query";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../data/shibuya-v2";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Build a feasible Shibuya route from real places with published hours, reference prices, walking estimates, and visible sources.",
  title: "A Shibuya plan you can verify",
};

export default async function HomePage() {
  await connection();
  const now = new Date();
  const sourceById = new Map(
    SHIBUYA_ACTIVE_PACK_V2.sources.map((source) => [source.sourceId, source]),
  );
  const sampleIds = [
    "kawamoto-puppet-gallery",
    "komorebi-owada-library",
    "miyashita-park",
  ];
  const sampleStops = sampleIds
    .map((placeId) =>
      SHIBUYA_ACTIVE_PACK_V2.places.find((place) => place.placeId === placeId),
    )
    .filter((place) => place !== undefined)
    .map((place) => ({
      category: place.category,
      name: place.name,
      priceLabel:
        place.price.kind === "FREE"
          ? "Free reference price"
          : place.price.minYen === place.price.maxYen
            ? `¥${place.price.maxYen.toLocaleString("en-US")} · ${place.price.label}`
            : `¥${place.price.minYen.toLocaleString("en-US")}–¥${place.price.maxYen.toLocaleString("en-US")} · ${place.price.label}`,
      publisher:
        sourceById.get(place.evidence.identity.sourceId)?.publisher ??
        "Published source",
    }));

  return (
    <PlannerLanding
      defaults={defaultPlannerForm(now)}
      maxDate={tokyoDate(7, now)}
      minDate={tokyoDate(0, now)}
      sampleStops={sampleStops}
    />
  );
}

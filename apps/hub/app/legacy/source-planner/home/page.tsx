import type { Metadata } from "next";
import { connection } from "next/server";

import { PlannerLanding } from "../../../../components/planner-v2/planner-landing";
import {
  defaultPlannerForm,
  earliestPlannerStart,
  tokyoDate,
} from "../../../../components/planner-v2/planner-query";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../../../../data/shibuya-v2";

export const metadata: Metadata = {
  description: "Archived source-backed Shibuya planner v2 landing.",
  robots: { follow: false, index: false },
  title: "Legacy Shibuya planner home",
};

export default async function LegacySourcePlannerHomePage() {
  await connection();
  const now = new Date();
  const defaults = defaultPlannerForm(now);
  const minDate = defaults.date;
  const sourcePackValidThrough = SHIBUYA_ACTIVE_PACK_V2.validThrough.slice(
    0,
    10,
  );
  const maxDate = [tokyoDate(7, now), sourcePackValidThrough].sort()[0]!;
  const sourceById = new Map(
    SHIBUYA_ACTIVE_PACK_V2.sources.map((source) => [source.sourceId, source]),
  );
  const sampleStops = [
    "kawamoto-puppet-gallery",
    "hachilabo-science-center",
    "komorebi-owada-library",
  ]
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
        place.price.minYen === place.price.maxYen
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
      homePath="/legacy/source-planner/home"
      maxDate={maxDate}
      minDate={minDate}
      plannerPath="/legacy/source-planner"
      sampleStops={sampleStops}
      sourcePackValidThrough={sourcePackValidThrough}
    />
  );
}

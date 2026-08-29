import {
  type PlaceDataPackV2,
  type PlaceEvidenceV2,
  validatePlaceDataPackV2,
} from "@serendipity/contracts/planner-v2";

import rawPack from "./shibuya.places.v2.json";

const validation = validatePlaceDataPackV2(rawPack);

if (!validation.ok) {
  throw new Error(
    `Invalid bundled Shibuya planner data: ${validation.issues.join("; ")}`,
  );
}

export const SHIBUYA_ACTIVE_PACK_V2: PlaceDataPackV2 = validation.value;
export const SHIBUYA_DATA_PACK_V2 = SHIBUYA_ACTIVE_PACK_V2;
export const SHIBUYA_PLACE_DATA_PACK_V2 = SHIBUYA_ACTIVE_PACK_V2;

const FEATURED_PLACE_IDS = [
  "kawamoto-puppet-gallery",
  "komorebi-owada-library",
  "miyashita-park",
] as const;
const FEATURED_PLACE_ID_SET = new Set<string>(FEATURED_PLACE_IDS);

export const getShibuyaPlaceSamplesV2 = (count = 3) => {
  const featured = FEATURED_PLACE_IDS.map((placeId) =>
    SHIBUYA_ACTIVE_PACK_V2.places.find((place) => place.placeId === placeId),
  ).filter((place) => place !== undefined);
  const remaining = SHIBUYA_ACTIVE_PACK_V2.places.filter(
    ({ placeId }) => !FEATURED_PLACE_ID_SET.has(placeId),
  );
  return [...featured, ...remaining]
    .slice(0, Math.max(0, count))
    .map((place) => ({
      placeId: place.placeId,
      name: place.name,
      category: place.category,
      summary: place.summary,
      price: place.price,
      officialUrl: place.officialUrl,
    }));
};

export const getPlaceEvidenceV2 = (placeId: string): PlaceEvidenceV2 | null => {
  const place = SHIBUYA_ACTIVE_PACK_V2.places.find(
    (candidate) => candidate.placeId === placeId,
  );
  if (!place) return null;

  const sourceIds = new Set([
    place.evidence.identity.sourceId,
    place.evidence.location.sourceId,
    place.evidence.hours.sourceId,
    place.evidence.price.sourceId,
    place.evidence.officialLink.sourceId,
  ]);
  const sourceById = new Map(
    SHIBUYA_ACTIVE_PACK_V2.sources.map((source) => [source.sourceId, source]),
  );
  const makeClaim = (
    kind: "IDENTITY" | "ADDRESS" | "HOURS" | "PRICE" | "OFFICIAL_LINK",
    value: string,
    sourceId: string,
    checkedAt: string,
  ) => {
    const source = sourceById.get(sourceId);
    if (!source) {
      throw new Error(`Missing bundled evidence source: ${sourceId}`);
    }
    return {
      kind,
      value,
      publisher: source.publisher,
      sourceTitle: source.title,
      sourceUrl: source.url,
      checkedAt,
    } as const;
  };
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hoursValue = place.weeklyHours
    .map(
      ({ days, opens, closes }) =>
        `${days.map((day) => weekdayNames[day]).join(", ")} ${opens}-${closes}`,
    )
    .join("; ");
  const priceValue = `${place.price.label}: ¥${place.price.minYen.toLocaleString("en-US")}${
    place.price.maxYen === place.price.minYen
      ? ""
      : `-¥${place.price.maxYen.toLocaleString("en-US")}`
  }`;

  return {
    schemaVersion: "2",
    packVersion: SHIBUYA_ACTIVE_PACK_V2.packVersion,
    placeId: place.placeId,
    placeName: place.name,
    officialUrl: place.officialUrl,
    evidenceAsOf: SHIBUYA_ACTIVE_PACK_V2.generatedAt,
    claims: {
      identity: makeClaim(
        "IDENTITY",
        place.name,
        place.evidence.identity.sourceId,
        place.evidence.identity.checkedAt,
      ),
      address: makeClaim(
        "ADDRESS",
        place.address,
        place.evidence.location.sourceId,
        place.evidence.location.checkedAt,
      ),
      hours: makeClaim(
        "HOURS",
        hoursValue,
        place.evidence.hours.sourceId,
        place.evidence.hours.checkedAt,
      ),
      price: makeClaim(
        "PRICE",
        priceValue,
        place.evidence.price.sourceId,
        place.evidence.price.checkedAt,
      ),
      officialLink: makeClaim(
        "OFFICIAL_LINK",
        place.officialUrl,
        place.evidence.officialLink.sourceId,
        place.evidence.officialLink.checkedAt,
      ),
    },
    sources: SHIBUYA_ACTIVE_PACK_V2.sources.filter(({ sourceId }) =>
      sourceIds.has(sourceId),
    ),
  };
};

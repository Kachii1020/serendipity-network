import {
  type AreaDataPackV3,
  type EvidenceClaimV3,
  type PlaceEvidenceV3,
  type PlannerAreaV3,
  type ReviewedPackClaimLedgerV3,
  validateAreaDataPackV3,
  validateReviewedPackClaimsV3,
} from "@serendipity/contracts/planner-v3";

import rawPacks from "./area-packs.v3.json";
import ikebukuroReviewedClaims from "./ikebukuro.reviewed-claims.v3.json";
import shibuyaReviewedClaims from "./shibuya.reviewed-claims.v3.json";
import shinjukuReviewedClaims from "./shinjuku.reviewed-claims.v3.json";

const rawReviewedClaims = {
  shibuya: shibuyaReviewedClaims,
  shinjuku: shinjukuReviewedClaims,
  ikebukuro: ikebukuroReviewedClaims,
} as const;

const validatedEntries = rawPacks.map((rawPack) => {
  const validation = validateAreaDataPackV3(rawPack);
  if (!validation.ok) {
    throw new Error(
      `Invalid bundled v3 ${String(rawPack.area)} data: ${validation.issues.join("; ")}`,
    );
  }
  const ledger = rawReviewedClaims[
    validation.value.area
  ] as ReviewedPackClaimLedgerV3;
  const reviewed = validateReviewedPackClaimsV3(validation.value, ledger);
  if (!reviewed.ok) {
    throw new Error(
      `Unreviewed bundled v3 ${validation.value.area} data: ${reviewed.issue}`,
    );
  }
  return [
    validation.value.area,
    { pack: validation.value, reviewedClaims: ledger },
  ] as const;
});

export const AREA_REGISTRY_V3 = Object.fromEntries(validatedEntries) as Record<
  PlannerAreaV3,
  Readonly<{
    pack: AreaDataPackV3;
    reviewedClaims: ReviewedPackClaimLedgerV3;
  }>
>;

export const SHIBUYA_ACTIVE_PACK_V3 = AREA_REGISTRY_V3.shibuya.pack;
export const SHINJUKU_ACTIVE_PACK_V3 = AREA_REGISTRY_V3.shinjuku.pack;
export const IKEBUKURO_ACTIVE_PACK_V3 = AREA_REGISTRY_V3.ikebukuro.pack;

export const TOKYO_AREA_PACKS_V3 = [
  SHIBUYA_ACTIVE_PACK_V3,
  SHINJUKU_ACTIVE_PACK_V3,
  IKEBUKURO_ACTIVE_PACK_V3,
] as const;

export const getAreaDataPackV3 = (area: PlannerAreaV3): AreaDataPackV3 =>
  AREA_REGISTRY_V3[area].pack;

export const getReviewedPackClaimsV3 = (
  area: PlannerAreaV3,
): ReviewedPackClaimLedgerV3 => AREA_REGISTRY_V3[area].reviewedClaims;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getPlaceEvidenceV3 = (
  area: PlannerAreaV3,
  placeId: string,
): PlaceEvidenceV3 | null => {
  const pack = getAreaDataPackV3(area);
  const place = pack.places.find((candidate) => candidate.placeId === placeId);
  if (!place) return null;

  const sourceById = new Map(
    pack.sources.map((source) => [source.sourceId, source]),
  );
  const makeClaim = (
    kind: EvidenceClaimV3["kind"],
    value: string,
    reference: { sourceId: string; checkedAt: string },
  ): EvidenceClaimV3 => {
    const source = sourceById.get(reference.sourceId);
    if (!source) {
      throw new Error(`Missing reviewed v3 source: ${reference.sourceId}`);
    }
    return {
      kind,
      value,
      publisher: source.publisher,
      sourceTitle: source.title,
      sourceUrl: source.url,
      checkedAt: reference.checkedAt,
    };
  };
  const sourceIds = new Set(
    Object.values(place.evidence)
      .filter((reference) => reference !== null)
      .map((reference) => reference.sourceId),
  );
  const hours = place.weeklyHours
    .map(
      (window) =>
        `${window.days.map((day) => WEEKDAYS[day]).join(", ")} ${window.opens}-${window.closes}`,
    )
    .join("; ");
  const price = `¥${place.price.minYen.toLocaleString("en-US")}${
    place.price.maxYen === place.price.minYen
      ? ""
      : `-¥${place.price.maxYen.toLocaleString("en-US")}`
  } per ${place.price.kind === "PER_GROUP" ? "group" : "person"}: ${place.price.label}`;

  return {
    schemaVersion: "3",
    packVersion: pack.packVersion,
    area,
    placeId: place.placeId,
    placeName: place.name,
    officialUrl: place.officialUrl,
    evidenceAsOf: pack.generatedAt,
    claims: {
      identity: makeClaim("IDENTITY", place.name, place.evidence.identity),
      address: makeClaim("ADDRESS", place.address, place.evidence.address),
      coordinates: makeClaim(
        "COORDINATES",
        `${place.coordinates.latitude}, ${place.coordinates.longitude}`,
        place.evidence.coordinates,
      ),
      hours: makeClaim("HOURS", hours, place.evidence.hours),
      price: makeClaim("PRICE", price, place.evidence.price),
      publicAccess: makeClaim(
        "PUBLIC_ACCESS",
        "The official source supports public visitor access during published hours; this is not live availability.",
        place.evidence.publicAccess,
      ),
      officialLink: makeClaim(
        "OFFICIAL_LINK",
        place.officialUrl,
        place.evidence.officialLink,
      ),
      menu: place.evidence.menu
        ? makeClaim(
            "MENU",
            `${place.price.label}. Actual orders, taxes, service charges, and extras may differ.`,
            place.evidence.menu,
          )
        : null,
    },
    sources: pack.sources.filter((source) => sourceIds.has(source.sourceId)),
  };
};

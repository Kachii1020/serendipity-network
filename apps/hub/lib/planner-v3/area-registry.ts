import "server-only";

import { validateActiveAreaDataPackV3 } from "@serendipity/bundle-engine/planner-v3";
import type {
  AreaDataPackV3,
  PlaceEvidenceV3,
  PlannerAreaV3,
  PlannerIntentV3,
  ReviewedPackClaimLedgerV3,
} from "@serendipity/contracts/planner-v3";

import { AREA_REGISTRY_V3, getPlaceEvidenceV3 } from "../../data/planner-v3";

export type AreaRegistryEntryV3 = Readonly<{
  pack: AreaDataPackV3;
  reviewedClaims: ReviewedPackClaimLedgerV3;
  getEvidence(placeId: string): PlaceEvidenceV3 | null;
}>;

export type AreaResolutionV3 =
  | Readonly<{ ok: true; entry: AreaRegistryEntryV3; warnings: string[] }>
  | Readonly<{
      ok: false;
      code: "AREA_NOT_ACTIVE" | "STALE_DATA_PACK";
    }>;

export class AreaRegistryV3 {
  readonly #entries: ReadonlyMap<PlannerAreaV3, AreaRegistryEntryV3>;

  constructor(entries: Readonly<Record<PlannerAreaV3, AreaRegistryEntryV3>>) {
    this.#entries = new Map(
      Object.entries(entries) as Array<[PlannerAreaV3, AreaRegistryEntryV3]>,
    );
  }

  get(area: PlannerAreaV3): AreaRegistryEntryV3 | undefined {
    return this.#entries.get(area);
  }

  resolve(
    area: PlannerAreaV3,
    options: Readonly<{ asOf?: Date; intent?: PlannerIntentV3 }> = {},
  ): AreaResolutionV3 {
    const entry = this.#entries.get(area);
    if (!entry) return { ok: false, code: "AREA_NOT_ACTIVE" };
    const gate = validateActiveAreaDataPackV3(
      entry.pack,
      entry.reviewedClaims,
      options.asOf ?? new Date(),
      options.intent,
    );
    if (!gate.ok) {
      return {
        ok: false,
        code:
          gate.reason === "INACTIVE_DATA_PACK" ||
          gate.reason === "AREA_MISMATCH"
            ? "AREA_NOT_ACTIVE"
            : "STALE_DATA_PACK",
      };
    }
    return { ok: true, entry, warnings: gate.warnings };
  }
}

export const DEFAULT_AREA_REGISTRY_V3 = new AreaRegistryV3(
  Object.fromEntries(
    Object.entries(AREA_REGISTRY_V3).map(([area, entry]) => [
      area,
      {
        ...entry,
        getEvidence: (placeId: string) =>
          getPlaceEvidenceV3(area as PlannerAreaV3, placeId),
      },
    ]),
  ) as Record<PlannerAreaV3, AreaRegistryEntryV3>,
);

import type {
  EveningPlanV2,
  PlaceEvidenceV2,
  PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";

export const SAVED_PLAN_STORAGE_KEY = "serendipity.saved-itineraries.v2";
export const SAVED_PLAN_LIMIT = 10;
export const SAVED_PLAN_STORAGE_LIMIT_BYTES = 256 * 1024;

export type SavedPlanRecordV2 = {
  readonly evidence: Readonly<Record<string, PlaceEvidenceV2>>;
  readonly intent: PlannerIntentV2;
  readonly itinerary: EveningPlanV2;
  readonly savedAt: string;
  readonly savedPlanId: string;
};

type SavedPlanDocumentV2 = {
  readonly records: readonly SavedPlanRecordV2[];
  readonly schemaVersion: "2";
};

export type SavedPlanLoadResult = {
  readonly corrupt: boolean;
  readonly records: readonly SavedPlanRecordV2[];
};

export type SavedPlanMutationResult =
  | {
      readonly ok: true;
      readonly status: "ALREADY_SAVED" | "DELETED" | "NOT_FOUND" | "SAVED";
      readonly records: readonly SavedPlanRecordV2[];
      readonly savedPlanId: string;
    }
  | {
      readonly ok: false;
      readonly code:
        "STORAGE_CORRUPT" | "STORAGE_LIMIT_REACHED" | "STORAGE_UNAVAILABLE";
      readonly message: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validSavedRecord = (value: unknown): value is SavedPlanRecordV2 =>
  isRecord(value) &&
  typeof value.savedPlanId === "string" &&
  value.savedPlanId.length > 0 &&
  typeof value.savedAt === "string" &&
  Number.isFinite(Date.parse(value.savedAt)) &&
  isRecord(value.intent) &&
  value.intent.schemaVersion === "2" &&
  isRecord(value.itinerary) &&
  typeof value.itinerary.planId === "string" &&
  isRecord(value.evidence);

export const loadSavedPlans = (
  storage: Pick<Storage, "getItem">,
): SavedPlanLoadResult => {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVED_PLAN_STORAGE_KEY);
  } catch {
    return { corrupt: true, records: [] };
  }
  if (raw === null) return { corrupt: false, records: [] };
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.schemaVersion !== "2" ||
      !Array.isArray(value.records)
    ) {
      return { corrupt: true, records: [] };
    }
    const records = value.records.filter(validSavedRecord);
    return {
      corrupt: records.length !== value.records.length,
      records: records.slice(0, SAVED_PLAN_LIMIT),
    };
  } catch {
    return { corrupt: true, records: [] };
  }
};

const persist = (
  storage: Pick<Storage, "setItem">,
  records: readonly SavedPlanRecordV2[],
): SavedPlanMutationResult | undefined => {
  const document: SavedPlanDocumentV2 = { records, schemaVersion: "2" };
  const serialized = JSON.stringify(document);
  if (
    new TextEncoder().encode(serialized).byteLength >
    SAVED_PLAN_STORAGE_LIMIT_BYTES
  ) {
    return {
      ok: false,
      code: "STORAGE_LIMIT_REACHED",
      message: "Saved plans have reached the 256 KiB safety limit.",
    };
  }
  try {
    storage.setItem(SAVED_PLAN_STORAGE_KEY, serialized);
  } catch {
    return {
      ok: false,
      code: "STORAGE_UNAVAILABLE",
      message: "This browser could not store the plan.",
    };
  }
  return undefined;
};

export const savePlanSnapshot = (
  storage: Pick<Storage, "getItem" | "setItem">,
  record: SavedPlanRecordV2,
): SavedPlanMutationResult => {
  const loaded = loadSavedPlans(storage);
  if (loaded.corrupt) {
    return {
      ok: false,
      code: "STORAGE_CORRUPT",
      message:
        "Some saved-plan data is invalid. Existing browser data was left unchanged.",
    };
  }
  const existing = loaded.records.find(
    ({ savedPlanId }) => savedPlanId === record.savedPlanId,
  );
  if (existing) {
    return {
      ok: true,
      records: loaded.records,
      savedPlanId: existing.savedPlanId,
      status: "ALREADY_SAVED",
    };
  }
  if (loaded.records.length >= SAVED_PLAN_LIMIT) {
    return {
      ok: false,
      code: "STORAGE_LIMIT_REACHED",
      message: "Delete a saved plan before saving another one.",
    };
  }
  const records = [record, ...loaded.records];
  const failure = persist(storage, records);
  return (
    failure ?? {
      ok: true,
      records,
      savedPlanId: record.savedPlanId,
      status: "SAVED",
    }
  );
};

export const deletePlanSnapshot = (
  storage: Pick<Storage, "getItem" | "setItem">,
  savedPlanId: string,
): SavedPlanMutationResult => {
  const loaded = loadSavedPlans(storage);
  if (loaded.corrupt) {
    return {
      ok: false,
      code: "STORAGE_CORRUPT",
      message:
        "Some saved-plan data is invalid. Existing browser data was left unchanged.",
    };
  }
  const records = loaded.records.filter(
    (record) => record.savedPlanId !== savedPlanId,
  );
  if (records.length === loaded.records.length) {
    return {
      ok: true,
      records,
      savedPlanId,
      status: "NOT_FOUND",
    };
  }
  const failure = persist(storage, records);
  return (
    failure ?? {
      ok: true,
      records,
      savedPlanId,
      status: "DELETED",
    }
  );
};

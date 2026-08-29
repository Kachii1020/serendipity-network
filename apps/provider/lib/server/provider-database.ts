import "server-only";

import type {
  Provider,
  ProviderSearchInput,
  Slot,
} from "@serendipity/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CancelDemoSlotDatabaseResult,
  ConfirmHoldDatabaseInput,
  ConfirmHoldDatabaseResult,
  CreateHoldDatabaseInput,
  CreateHoldDatabaseResult,
  HoldStatusDatabaseInput,
  HoldStatusDatabaseResult,
  ProviderDatabase,
  ProviderProfile,
  ReleaseHoldDatabaseInput,
  ReleaseHoldDatabaseResult,
} from "./provider-api";

type QueryResponse = {
  data: unknown;
  error: unknown;
};

const asQueryResponse = (value: unknown): QueryResponse => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Provider database returned an invalid response");
  }
  const response = value as Record<string, unknown>;
  return { data: response.data, error: response.error };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isRecord) ? value : [];

const firstRecord = (value: unknown): Record<string, unknown> => {
  const first = records(value)[0];
  if (!first) throw new Error("Provider database returned no result row");
  return first;
};

const nullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const nullableScalarString = (value: unknown): string | null =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "bigint"
    ? String(value)
    : null;

const requiredScalarString = (value: unknown, field: string): string => {
  const parsed = nullableScalarString(value);
  if (parsed === null) {
    throw new Error(`Provider database field ${field} is invalid`);
  }
  return parsed;
};

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Provider database field ${field} is invalid`);
  }
  return value;
};

const booleanValue = (value: unknown): boolean => value === true;

const throwOnError = (response: QueryResponse): void => {
  if (response.error) throw new Error("Provider database operation failed");
};

const category = (value: unknown): Slot["category"] => {
  if (value === "workshop" || value === "food" || value === "culture") {
    return value;
  }
  throw new Error("Provider category is invalid");
};

const status = (
  value: unknown,
): "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED" | null =>
  value === "HELD" ||
  value === "CONFIRMED" ||
  value === "RELEASED" ||
  value === "EXPIRED"
    ? value
    : null;

const cancelledStatus = (
  value: unknown,
): "ACTIVE" | "CANCELLED" | "SOLD_OUT" | null =>
  value === "ACTIVE" || value === "CANCELLED" || value === "SOLD_OUT"
    ? value
    : null;

const numberValue = (value: unknown, field: string): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Provider database field ${field} is invalid`);
  }
  return parsed;
};

const integerValue = (value: unknown, field: string): number => {
  const parsed = numberValue(value, field);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Provider database field ${field} is invalid`);
  }
  return parsed;
};

const textArray = (value: unknown): string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];

const rpc = async (
  client: SupabaseClient,
  name: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const response = asQueryResponse(await client.rpc(name, input));
  throwOnError(response);
  return firstRecord(response.data);
};

export const createSupabaseProviderDatabase = (
  client: SupabaseClient,
): ProviderDatabase => ({
  async getProviderProfile(provider: Provider): Promise<ProviderProfile> {
    const response = asQueryResponse(
      await client
        .from("providers")
        .select("id, category")
        .eq("slug", provider)
        .eq("active", true)
        .maybeSingle(),
    );
    throwOnError(response);
    if (!isRecord(response.data)) {
      throw new Error("Configured Provider was not found");
    }
    return {
      category: category(response.data.category),
      id: requiredString(response.data.id, "providers.id"),
      provider,
    };
  },

  async searchSlots(
    profile: ProviderProfile,
    input: ProviderSearchInput,
  ): Promise<Slot[]> {
    const slotResponse = asQueryResponse(
      await client
        .from("slots")
        .select(
          "id, provider_id, location_id, title, starts_at, ends_at, price_yen, original_price_yen, capacity_remaining, tags, novelty_score, inventory_version",
        )
        .eq("provider_id", profile.id)
        .eq("status", "ACTIVE")
        .gte("starts_at", input.startAt)
        .lte("ends_at", input.endAt)
        .lte("price_yen", input.maxPriceYen)
        .gte("capacity_remaining", input.partySize)
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(30),
    );
    throwOnError(slotResponse);
    const excludedTags = new Set<string>(input.excludedTags);
    const slotRows = records(slotResponse.data).filter((row) =>
      textArray(row.tags).every((tag) => !excludedTags.has(tag)),
    );
    const locationIds = [
      ...new Set(
        slotRows.map((row) =>
          requiredString(row.location_id, "slots.location_id"),
        ),
      ),
    ];
    if (locationIds.length === 0) return [];

    const locationResponse = asQueryResponse(
      await client
        .from("locations")
        .select("id, name, address_short, map_x, map_y")
        .eq("provider_id", profile.id)
        .eq("active", true)
        .in("id", locationIds),
    );
    throwOnError(locationResponse);
    const locationById = new Map(
      records(locationResponse.data).map((row) => [
        requiredString(row.id, "locations.id"),
        row,
      ]),
    );

    return slotRows.slice(0, 10).map((row) => {
      const locationId = requiredString(row.location_id, "slots.location_id");
      const location = locationById.get(locationId);
      if (!location) throw new Error("Slot location is unavailable");
      return {
        capacityRemaining: integerValue(
          row.capacity_remaining,
          "slots.capacity_remaining",
        ),
        category: profile.category,
        endsAt: requiredString(row.ends_at, "slots.ends_at"),
        inventoryVersion: requiredScalarString(
          row.inventory_version,
          "slots.inventory_version",
        ),
        location: {
          addressShort: requiredString(
            location.address_short,
            "locations.address_short",
          ),
          locationId,
          mapX: numberValue(location.map_x, "locations.map_x"),
          mapY: numberValue(location.map_y, "locations.map_y"),
          name: requiredString(location.name, "locations.name"),
        },
        noveltyScore: numberValue(row.novelty_score, "slots.novelty_score"),
        originalPriceYen: integerValue(
          row.original_price_yen,
          "slots.original_price_yen",
        ),
        priceYen: integerValue(row.price_yen, "slots.price_yen"),
        provider: profile.provider,
        slotId: requiredString(row.id, "slots.id"),
        startsAt: requiredString(row.starts_at, "slots.starts_at"),
        tags: textArray(row.tags) as Slot["tags"],
        title: requiredString(row.title, "slots.title"),
      };
    });
  },

  async createHold(
    input: CreateHoldDatabaseInput,
  ): Promise<CreateHoldDatabaseResult> {
    const row = await rpc(client, "create_slot_hold", {
      p_browser_session_id: input.browserSessionId,
      p_client_request_id: input.clientRequestId,
      p_creation_idempotency_hash: input.idempotencyHash,
      p_expected_inventory_version: input.expectedInventoryVersion,
      p_now: input.now,
      p_proposed_hold_id: input.holdId,
      p_provider_id: input.providerId,
      p_quantity: input.quantity,
      p_request_hash: input.requestHash,
      p_slot_id: input.slotId,
      p_token_hash: input.tokenHash,
    });
    return {
      errorCode: nullableString(row.error_code),
      expiresAt: nullableString(row.expires_at),
      holdId: nullableString(row.hold_id),
      inventoryVersion: nullableScalarString(row.inventory_version),
      ok: booleanValue(row.ok),
      slotId: nullableString(row.slot_id),
      status: status(row.status),
    };
  },

  async getHoldStatus(
    input: HoldStatusDatabaseInput,
  ): Promise<HoldStatusDatabaseResult> {
    const row = await rpc(client, "get_hold_status", {
      p_browser_session_id: input.browserSessionId,
      p_client_request_id: input.clientRequestId,
      p_provider_id: input.providerId,
      p_token_hash: input.tokenHash,
    });
    return {
      errorCode: nullableString(row.error_code),
      expiresAt: nullableString(row.expires_at),
      holdId: nullableString(row.hold_id),
      ok: booleanValue(row.ok),
      reservationRef: nullableString(row.reservation_ref),
      slotId: nullableString(row.slot_id),
      status: status(row.status),
    };
  },

  async confirmHold(
    input: ConfirmHoldDatabaseInput,
  ): Promise<ConfirmHoldDatabaseResult> {
    const row = await rpc(client, "confirm_slot_hold", {
      p_idempotency_hash: input.idempotencyHash,
      p_now: input.now,
      p_provider_id: input.providerId,
      p_request_hash: input.requestHash,
      p_token_hash: input.tokenHash,
    });
    return {
      confirmedAt: nullableString(row.confirmed_at),
      errorCode: nullableString(row.error_code),
      holdId: nullableString(row.hold_id),
      ok: booleanValue(row.ok),
      reservationRef: nullableString(row.reservation_ref),
      status: status(row.status),
    };
  },

  async releaseHold(
    input: ReleaseHoldDatabaseInput,
  ): Promise<ReleaseHoldDatabaseResult> {
    const row = await rpc(client, "release_slot_hold", {
      p_idempotency_hash: input.idempotencyHash,
      p_now: input.now,
      p_provider_id: input.providerId,
      p_request_hash: input.requestHash,
      p_token_hash: input.tokenHash,
    });
    return {
      capacityRestored: booleanValue(row.capacity_restored),
      errorCode: nullableString(row.error_code),
      holdId: nullableString(row.hold_id),
      ok: booleanValue(row.ok),
      slotId: nullableString(row.slot_id),
      status: status(row.status),
    };
  },

  async cancelDemoSlot(
    providerId: string,
    slotId: string,
  ): Promise<CancelDemoSlotDatabaseResult> {
    const row = await rpc(client, "cancel_demo_slot", {
      p_provider_id: providerId,
      p_slot_id: slotId,
    });
    return {
      errorCode: nullableString(row.error_code),
      inventoryVersion: nullableScalarString(row.inventory_version),
      ok: booleanValue(row.ok),
      status: cancelledStatus(row.status),
    };
  },
});

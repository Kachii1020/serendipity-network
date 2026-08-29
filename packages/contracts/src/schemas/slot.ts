import {
  opaqueIdSchema,
  providerSchema,
  TAGS,
  timestampSchema,
} from "./common";

export const locationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["locationId", "name", "addressShort", "mapX", "mapY"],
  properties: {
    locationId: opaqueIdSchema,
    name: { type: "string", minLength: 1, maxLength: 80 },
    addressShort: { type: "string", minLength: 1, maxLength: 120 },
    mapX: { type: "number", minimum: 0, maximum: 100 },
    mapY: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

export const slotSchema = {
  $comment: "serendipity.slot.v1",
  type: "object",
  additionalProperties: false,
  required: [
    "slotId",
    "provider",
    "title",
    "category",
    "startsAt",
    "endsAt",
    "priceYen",
    "originalPriceYen",
    "capacityRemaining",
    "location",
    "tags",
    "noveltyScore",
    "inventoryVersion",
  ],
  properties: {
    slotId: opaqueIdSchema,
    provider: providerSchema,
    title: { type: "string", minLength: 1, maxLength: 120 },
    category: { enum: ["workshop", "food", "culture"] },
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    priceYen: { type: "integer", minimum: 0, maximum: 100_000 },
    originalPriceYen: { type: "integer", minimum: 0, maximum: 100_000 },
    capacityRemaining: { type: "integer", minimum: 0 },
    location: locationSchema,
    tags: {
      type: "array",
      items: { enum: TAGS },
      maxItems: 12,
      uniqueItems: true,
    },
    noveltyScore: { type: "number", minimum: 0, maximum: 1 },
    inventoryVersion: opaqueIdSchema,
  },
} as const;

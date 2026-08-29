import {
  PROVIDERS,
  SCHEMA_VERSION,
  opaqueIdSchema,
  timestampSchema,
} from "./common";
import { slotSchema } from "./slot";

export const AREA_PACK_STATUSES = ["CANDIDATE", "ACTIVE"] as const;

export const areaPackOriginSchema = {
  type: "string",
  minLength: 9,
  maxLength: 240,
  pattern: "^https://[^\\s/*?#]+(?::\\d+)?$",
} as const;

export const areaDataPackSchema = {
  $comment: "serendipity.area-data-pack.v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "packVersion",
    "area",
    "status",
    "providers",
    "directedTravelMinutes",
    "serviceWindow",
    "fixtureSlotIds",
  ],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    packVersion: {
      type: "string",
      pattern: "^[1-9]\\d*\\.\\d+\\.\\d+$",
      maxLength: 32,
    },
    area: {
      type: "object",
      additionalProperties: false,
      required: [
        "slug",
        "displayName",
        "timezone",
        "currency",
        "localizedBoundaryCopy",
      ],
      properties: {
        slug: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          maxLength: 64,
        },
        displayName: { type: "string", minLength: 1, maxLength: 80 },
        timezone: {
          type: "string",
          pattern: "^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$",
          maxLength: 64,
        },
        currency: { const: "JPY" },
        localizedBoundaryCopy: {
          type: "string",
          minLength: 1,
          maxLength: 240,
        },
      },
    },
    status: { enum: AREA_PACK_STATUSES },
    providers: {
      type: "array",
      minItems: PROVIDERS.length,
      maxItems: PROVIDERS.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "origin", "slots"],
        properties: {
          provider: { enum: PROVIDERS },
          origin: areaPackOriginSchema,
          slots: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: slotSchema,
          },
        },
      },
    },
    directedTravelMinutes: {
      type: "array",
      maxItems: 9_900,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fromLocationId", "toLocationId", "minutes"],
        properties: {
          fromLocationId: opaqueIdSchema,
          toLocationId: opaqueIdSchema,
          minutes: { type: "integer", minimum: 0, maximum: 240 },
        },
      },
    },
    serviceWindow: {
      type: "object",
      additionalProperties: false,
      required: ["startsAt", "endsAt", "totalBudgetYen", "partySize"],
      properties: {
        startsAt: timestampSchema,
        endsAt: timestampSchema,
        totalBudgetYen: { type: "integer", minimum: 0, maximum: 300_000 },
        partySize: { type: "integer", minimum: 1, maximum: 12 },
      },
    },
    fixtureSlotIds: {
      type: "array",
      minItems: PROVIDERS.length,
      maxItems: PROVIDERS.length,
      uniqueItems: true,
      items: opaqueIdSchema,
    },
  },
} as const;

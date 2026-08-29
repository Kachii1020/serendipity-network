import { providerHoldDataSchema } from "./operations";
import { opaqueIdSchema, providerSchema, SCHEMA_VERSION } from "./common";

export const providerHoldHttpDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["publicResult", "holdToken"],
  properties: {
    publicResult: providerHoldDataSchema,
    holdToken: { type: "string", minLength: 32, maxLength: 512 },
  },
} as const;

export const demoCancelSlotInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "slotId"],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    slotId: opaqueIdSchema,
  },
} as const;

export const demoCancelSlotDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provider", "slotId", "status", "inventoryVersion"],
  properties: {
    provider: providerSchema,
    slotId: opaqueIdSchema,
    status: { const: "CANCELLED" },
    inventoryVersion: opaqueIdSchema,
  },
} as const;

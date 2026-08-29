import { SCHEMA_VERSION, tagArraySchema, timestampSchema } from "./common";

export const intentSchema = {
  $comment: "serendipity.intent.v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "area",
    "startAt",
    "endAt",
    "totalBudgetYen",
    "partySize",
    "preferredTags",
    "excludedTags",
  ],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    area: { const: "shibuya" },
    startAt: timestampSchema,
    endAt: timestampSchema,
    totalBudgetYen: { type: "integer", minimum: 1, maximum: 100_000 },
    partySize: { const: 1 },
    preferredTags: tagArraySchema,
    excludedTags: tagArraySchema,
  },
} as const;

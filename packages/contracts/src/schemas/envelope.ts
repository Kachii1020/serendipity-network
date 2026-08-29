import { errorSchema, resultMetaSchema, SCHEMA_VERSION } from "./common";
import { providerSearchDataSchema } from "./operations";

export const failureEnvelopeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "ok", "error", "meta"],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    ok: { const: false },
    error: errorSchema,
    meta: resultMetaSchema,
  },
} as const;

export const providerSearchEnvelopeSchema = {
  $comment: "serendipity.provider-search-envelope.v1",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "ok", "data", "meta"],
      properties: {
        schemaVersion: { const: SCHEMA_VERSION },
        ok: { const: true },
        data: providerSearchDataSchema,
        meta: resultMetaSchema,
      },
    },
    failureEnvelopeSchema,
  ],
} as const;

export const resultEnvelopeSchema = <const TData extends object>(
  dataSchema: TData,
) =>
  ({
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "ok", "data", "meta"],
        properties: {
          schemaVersion: { const: SCHEMA_VERSION },
          ok: { const: true },
          data: dataSchema,
          meta: resultMetaSchema,
        },
      },
      failureEnvelopeSchema,
    ],
  }) as const;

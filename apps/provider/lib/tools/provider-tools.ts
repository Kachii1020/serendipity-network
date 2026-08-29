import {
  assertPublicPayloadSafe,
  contractValidators,
  enforceResultSize,
  providerHoldStatusInputSchema,
  providerSearchInputSchema,
  providerToolConfirmInputSchema,
  providerToolHoldInputSchema,
  providerToolReleaseInputSchema,
  SCHEMA_VERSION,
  type ErrorCode,
  type Provider,
  type ProviderConfirmInput,
  type ProviderHoldHttpData,
  type ProviderHoldInput,
  type ProviderHoldStatusData,
  type ProviderHoldStatusInput,
  type ProviderReleaseInput,
  type ProviderSearchData,
  type ProviderSearchInput,
  type ProviderToolConfirmInput,
  type ProviderToolHoldInput,
  type ProviderToolReleaseInput,
} from "@serendipity/contracts";
import {
  registerTool,
  type RegistrationHandle,
  type ToolDefinition,
} from "@serendipity/webmcp";

export type ProviderToolOperation =
  "SEARCH" | "HOLD" | "STATUS" | "CONFIRM" | "RELEASE";

export type ProviderToolEvent = {
  readonly errorCode?: ErrorCode;
  readonly operation: ProviderToolOperation;
  readonly phase: "STARTED" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  readonly resultCount?: number;
  readonly terminalStatus?: ProviderHoldStatusData["status"];
};

export type ProviderTokenStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

export type ProviderToolDependencies = {
  readonly accessToken: string;
  readonly browserSessionId: string;
  readonly fetcher: typeof fetch;
  readonly now: () => Date;
  readonly onEvent: (event: ProviderToolEvent) => void;
  readonly origin: string;
  readonly provider: Provider;
  readonly storage: ProviderTokenStorage;
  readonly uuid: () => string;
};

type PublicFailure = {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly provider: Provider;
  };
  readonly meta: {
    readonly completedAt: string;
    readonly correlationId: string;
    readonly origin: string;
  };
  readonly ok: false;
  readonly schemaVersion: typeof SCHEMA_VERSION;
};

type ProviderEnvelope =
  | PublicFailure
  | {
      readonly data: unknown;
      readonly meta: {
        readonly completedAt: string;
        readonly correlationId: string;
        readonly origin: string;
      };
      readonly ok: true;
      readonly schemaVersion: typeof SCHEMA_VERSION;
    };

const errorCopy: Record<ErrorCode, string> = {
  ALREADY_CONFIRMED: "This hold is already confirmed.",
  BUNDLE_NOT_FOUND: "The bundle was not found.",
  CANCELLED: "The Provider operation was cancelled.",
  COMPENSATION_INCOMPLETE: "The release result needs attention.",
  CONFIRMATION_INCONSISTENT: "The confirmation result needs attention.",
  HOLD_EXPIRED: "This hold has expired.",
  HOLD_NOT_FOUND: "This hold could not be recovered.",
  HOLD_RELEASED: "This hold was already released.",
  IDEMPOTENCY_CONFLICT: "The operation key was already used.",
  INTERNAL_ERROR: "The Provider could not complete the request.",
  NO_VALID_BUNDLE: "No matching bundle was found.",
  ORIGIN_MISMATCH: "The request origin is not allowed.",
  PROVIDER_OFFLINE: "The Provider is offline.",
  PROVIDER_TIMEOUT: "The Provider took too long to respond.",
  RECONCILIATION_REQUIRED: "The result needs to be checked.",
  SLOT_NOT_FOUND: "The activity was not found.",
  SLOT_UNAVAILABLE: "The activity is no longer available.",
  STALE_BUNDLE: "The selected bundle is out of date.",
  TOOL_NOT_FOUND: "The Provider tool is unavailable.",
  UNSUPPORTED_SCHEMA_VERSION: "The schema version is not supported.",
  VALIDATION_ERROR: "The request did not match the Provider contract.",
  WEBMCP_PERMISSION_DENIED: "Provider authorization failed.",
  WEBMCP_UNAVAILABLE: "WebMCP is unavailable.",
};

const retryableErrors = new Set<ErrorCode>([
  "INTERNAL_ERROR",
  "PROVIDER_OFFLINE",
  "PROVIDER_TIMEOUT",
  "RECONCILIATION_REQUIRED",
  "SLOT_UNAVAILABLE",
]);

export const tokenStorageKey = (
  provider: Provider,
  browserSessionId: string,
  safeReference: string,
): string =>
  `serendipity.provider.${provider}.hold.${browserSessionId}.${safeReference}`;

const localFailure = (
  dependencies: ProviderToolDependencies,
  code: ErrorCode,
): PublicFailure => ({
  error: {
    code,
    message: errorCopy[code],
    provider: dependencies.provider,
    retryable: retryableErrors.has(code),
  },
  meta: {
    completedAt: dependencies.now().toISOString(),
    correlationId: dependencies.uuid(),
    origin: dependencies.origin,
  },
  ok: false,
  schemaVersion: SCHEMA_VERSION,
});

const serializePublic = (value: ProviderEnvelope): string => {
  if (!contractValidators.providerResultEnvelope(value)) {
    throw new Error("Provider result violated the shared envelope contract");
  }
  if (!assertPublicPayloadSafe(value).ok) {
    throw new Error("Provider result contained a private field");
  }
  if (!enforceResultSize(value).ok) {
    throw new Error("Provider result exceeded the public size limit");
  }
  return JSON.stringify(value);
};

const isSuccess = (
  envelope: ProviderEnvelope,
): envelope is Extract<ProviderEnvelope, { ok: true }> => envelope.ok;

const parseEnvelope = async (response: Response): Promise<ProviderEnvelope> => {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 65_536) {
    throw new Error("Provider returned an oversized response");
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Provider returned invalid JSON");
  }
  if (!contractValidators.providerResultEnvelope(value)) {
    throw new Error("Provider returned an invalid envelope");
  }
  return value as ProviderEnvelope;
};

const requestProvider = async (
  dependencies: ProviderToolDependencies,
  path: string,
  input: unknown,
  signal: AbortSignal | undefined,
  privateHeaders: HeadersInit = {},
): Promise<{ envelope: ProviderEnvelope; response: Response }> => {
  const response = await dependencies.fetcher(
    new URL(path, dependencies.origin),
    {
      body: JSON.stringify(input),
      headers: {
        authorization: `Bearer ${dependencies.accessToken}`,
        "content-type": "application/json",
        ...Object.fromEntries(new Headers(privateHeaders)),
      },
      method: "POST",
      ...(signal ? { signal } : {}),
    },
  );
  return { envelope: await parseEnvelope(response), response };
};

const invalidInput = (
  dependencies: ProviderToolDependencies,
  input: unknown,
  validator: (value: unknown) => boolean,
): string | null => {
  if (!validator(input)) {
    const unsupported =
      typeof input === "object" &&
      input !== null &&
      "schemaVersion" in input &&
      (input as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION;
    return serializePublic(
      localFailure(
        dependencies,
        unsupported ? "UNSUPPORTED_SCHEMA_VERSION" : "VALIDATION_ERROR",
      ),
    );
  }
  const browserSessionId = (input as { browserSessionId?: unknown })
    .browserSessionId;
  return browserSessionId !== undefined &&
    browserSessionId !== dependencies.browserSessionId
    ? serializePublic(localFailure(dependencies, "WEBMCP_PERMISSION_DENIED"))
    : null;
};

const validatedPublicResult = (
  envelope: ProviderEnvelope,
  validator: (value: unknown) => boolean,
): string => {
  if (isSuccess(envelope) && !validator(envelope.data)) {
    throw new Error("Provider returned invalid operation data");
  }
  return serializePublic(envelope);
};

const emitFailure = (
  dependencies: ProviderToolDependencies,
  operation: ProviderToolOperation,
  envelope: ProviderEnvelope,
): void => {
  if (!isSuccess(envelope)) {
    dependencies.onEvent({
      errorCode: envelope.error.code,
      operation,
      phase: "FAILED",
    });
  }
};

const protocolFailure = (
  dependencies: ProviderToolDependencies,
  operation: ProviderToolOperation,
  error: unknown,
): never => {
  dependencies.onEvent({
    operation,
    phase:
      error instanceof DOMException && error.name === "AbortError"
        ? "UNKNOWN"
        : "FAILED",
  });
  throw error;
};

const derivePrivateIdempotencyKey = async (
  provider: Provider,
  operation: "confirm" | "hold" | "release",
  stableReference: string,
): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `serendipity:${provider}:${operation}:${stableReference}:v1`,
    ),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const createProviderToolDefinitions = (
  dependencies: ProviderToolDependencies,
): readonly ToolDefinition[] => {
  const prefix = dependencies.provider;

  return [
    {
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      description: `Search the current ${prefix} Provider inventory without reserving capacity.`,
      execute: async (rawInput, options) => {
        const invalid = invalidInput(
          dependencies,
          rawInput,
          contractValidators.providerSearchInput,
        );
        if (invalid) return invalid;
        const input = rawInput as ProviderSearchInput;
        dependencies.onEvent({ operation: "SEARCH", phase: "STARTED" });
        try {
          const { envelope } = await requestProvider(
            dependencies,
            "/api/slots",
            input,
            options?.signal,
          );
          if (isSuccess(envelope)) {
            if (!contractValidators.providerSearchData(envelope.data)) {
              throw new Error("Provider returned invalid search data");
            }
            const data = envelope.data as ProviderSearchData;
            dependencies.onEvent({
              operation: "SEARCH",
              phase: "SUCCEEDED",
              resultCount: data.slots.length,
            });
          } else emitFailure(dependencies, "SEARCH", envelope);
          return validatedPublicResult(
            envelope,
            contractValidators.providerSearchData,
          );
        } catch (error) {
          return protocolFailure(dependencies, "SEARCH", error);
        }
      },
      inputSchema: providerSearchInputSchema,
      name: `${prefix}_search_slots`,
      title: `${prefix} search slots`,
    },
    {
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      description: `Hold one selected ${prefix} Provider slot idempotently.`,
      execute: async (rawInput, options) => {
        const invalid = invalidInput(
          dependencies,
          rawInput,
          contractValidators.providerToolHoldInput,
        );
        if (invalid) return invalid;
        const input = rawInput as ProviderToolHoldInput;
        const privateInput: ProviderHoldInput = {
          ...input,
          idempotencyKey: await derivePrivateIdempotencyKey(
            dependencies.provider,
            "hold",
            input.clientRequestId,
          ),
        };
        dependencies.onEvent({ operation: "HOLD", phase: "STARTED" });
        try {
          const { envelope } = await requestProvider(
            dependencies,
            "/api/holds",
            privateInput,
            options?.signal,
          );
          if (!isSuccess(envelope)) {
            emitFailure(dependencies, "HOLD", envelope);
            return serializePublic(envelope);
          }
          if (!contractValidators.providerHoldHttpData(envelope.data)) {
            throw new Error("Provider returned invalid private hold data");
          }
          const data = envelope.data as ProviderHoldHttpData;
          dependencies.storage.setItem(
            tokenStorageKey(
              dependencies.provider,
              input.browserSessionId,
              data.publicResult.holdSafeReference,
            ),
            data.holdToken,
          );
          const publicEnvelope: ProviderEnvelope = {
            ...envelope,
            data: data.publicResult,
          };
          dependencies.onEvent({ operation: "HOLD", phase: "SUCCEEDED" });
          return validatedPublicResult(
            publicEnvelope,
            contractValidators.providerHoldData,
          );
        } catch (error) {
          return protocolFailure(dependencies, "HOLD", error);
        }
      },
      inputSchema: providerToolHoldInputSchema,
      name: `${prefix}_hold_slot`,
      title: `${prefix} hold slot`,
    },
    {
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      description: `Read one ${prefix} hold status by its safe reference or creation request ID.`,
      execute: async (rawInput, options) => {
        const invalid = invalidInput(
          dependencies,
          rawInput,
          contractValidators.providerHoldStatusInput,
        );
        if (invalid) return invalid;
        const input = rawInput as ProviderHoldStatusInput;
        dependencies.onEvent({ operation: "STATUS", phase: "STARTED" });
        const path = input.holdSafeReference
          ? `/api/holds/${encodeURIComponent(input.holdSafeReference)}`
          : "/api/holds/status";
        try {
          const { envelope, response } = await requestProvider(
            dependencies,
            path,
            input,
            options?.signal,
          );
          if (isSuccess(envelope)) {
            if (!contractValidators.providerHoldStatusData(envelope.data)) {
              throw new Error("Provider returned invalid hold status data");
            }
            const data = envelope.data as ProviderHoldStatusData;
            const key = tokenStorageKey(
              dependencies.provider,
              input.browserSessionId,
              data.holdSafeReference,
            );
            const recovered = response.headers.get(
              "x-serendipity-recovered-hold-token",
            );
            if (data.status === "HELD" && recovered) {
              dependencies.storage.setItem(key, recovered);
            } else if (data.status !== "HELD") {
              dependencies.storage.removeItem(key);
            }
            dependencies.onEvent({
              operation: "STATUS",
              phase: "SUCCEEDED",
              terminalStatus: data.status,
            });
          } else emitFailure(dependencies, "STATUS", envelope);
          return validatedPublicResult(
            envelope,
            contractValidators.providerHoldStatusData,
          );
        } catch (error) {
          return protocolFailure(dependencies, "STATUS", error);
        }
      },
      inputSchema: providerHoldStatusInputSchema,
      name: `${prefix}_get_hold_status`,
      title: `${prefix} get hold status`,
    },
    {
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      description: `Confirm one active ${prefix} hold using its Provider-owned private token.`,
      execute: async (rawInput, options) => {
        const invalid = invalidInput(
          dependencies,
          rawInput,
          contractValidators.providerToolConfirmInput,
        );
        if (invalid) return invalid;
        const input = rawInput as ProviderToolConfirmInput;
        const privateInput: ProviderConfirmInput = {
          ...input,
          idempotencyKey: await derivePrivateIdempotencyKey(
            dependencies.provider,
            "confirm",
            input.holdSafeReference,
          ),
        };
        const key = tokenStorageKey(
          dependencies.provider,
          input.browserSessionId,
          input.holdSafeReference,
        );
        const holdToken = dependencies.storage.getItem(key);
        if (!holdToken) {
          dependencies.onEvent({
            errorCode: "HOLD_NOT_FOUND",
            operation: "CONFIRM",
            phase: "FAILED",
          });
          return serializePublic(localFailure(dependencies, "HOLD_NOT_FOUND"));
        }
        dependencies.onEvent({ operation: "CONFIRM", phase: "STARTED" });
        try {
          const { envelope } = await requestProvider(
            dependencies,
            `/api/holds/${encodeURIComponent(input.holdSafeReference)}/confirm`,
            privateInput,
            options?.signal,
            { "x-serendipity-hold-token": holdToken },
          );
          if (isSuccess(envelope)) {
            if (!contractValidators.providerConfirmData(envelope.data)) {
              throw new Error("Provider returned invalid confirmation data");
            }
            dependencies.storage.removeItem(key);
            dependencies.onEvent({
              operation: "CONFIRM",
              phase: "SUCCEEDED",
            });
          } else {
            emitFailure(dependencies, "CONFIRM", envelope);
            if (
              ["ALREADY_CONFIRMED", "HOLD_EXPIRED", "HOLD_RELEASED"].includes(
                envelope.error.code,
              )
            ) {
              dependencies.storage.removeItem(key);
            }
          }
          return validatedPublicResult(
            envelope,
            contractValidators.providerConfirmData,
          );
        } catch (error) {
          return protocolFailure(dependencies, "CONFIRM", error);
        }
      },
      inputSchema: providerToolConfirmInputSchema,
      name: `${prefix}_confirm_hold`,
      title: `${prefix} confirm hold`,
    },
    {
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      description: `Release one active ${prefix} hold idempotently.`,
      execute: async (rawInput, options) => {
        const invalid = invalidInput(
          dependencies,
          rawInput,
          contractValidators.providerToolReleaseInput,
        );
        if (invalid) return invalid;
        const input = rawInput as ProviderToolReleaseInput;
        const privateInput: ProviderReleaseInput = {
          ...input,
          idempotencyKey: await derivePrivateIdempotencyKey(
            dependencies.provider,
            "release",
            input.holdSafeReference,
          ),
        };
        const key = tokenStorageKey(
          dependencies.provider,
          input.browserSessionId,
          input.holdSafeReference,
        );
        const holdToken = dependencies.storage.getItem(key);
        if (!holdToken) {
          dependencies.onEvent({
            errorCode: "HOLD_NOT_FOUND",
            operation: "RELEASE",
            phase: "FAILED",
          });
          return serializePublic(localFailure(dependencies, "HOLD_NOT_FOUND"));
        }
        dependencies.onEvent({ operation: "RELEASE", phase: "STARTED" });
        try {
          const { envelope } = await requestProvider(
            dependencies,
            `/api/holds/${encodeURIComponent(input.holdSafeReference)}/release`,
            privateInput,
            options?.signal,
            { "x-serendipity-hold-token": holdToken },
          );
          if (isSuccess(envelope)) {
            if (!contractValidators.providerReleaseData(envelope.data)) {
              throw new Error("Provider returned invalid release data");
            }
            dependencies.storage.removeItem(key);
            dependencies.onEvent({
              operation: "RELEASE",
              phase: "SUCCEEDED",
            });
          } else {
            emitFailure(dependencies, "RELEASE", envelope);
            if (
              ["ALREADY_CONFIRMED", "HOLD_EXPIRED", "HOLD_RELEASED"].includes(
                envelope.error.code,
              )
            ) {
              dependencies.storage.removeItem(key);
            }
          }
          return validatedPublicResult(
            envelope,
            contractValidators.providerReleaseData,
          );
        } catch (error) {
          return protocolFailure(dependencies, "RELEASE", error);
        }
      },
      inputSchema: providerToolReleaseInputSchema,
      name: `${prefix}_release_hold`,
      title: `${prefix} release hold`,
    },
  ];
};

export const registerProviderTools = (
  definitions: readonly ToolDefinition[],
  options: {
    readonly exposedTo: readonly string[];
    readonly source?: Document;
  },
): RegistrationHandle => {
  const handles = definitions.map((definition) =>
    registerTool(
      definition,
      { exposedTo: options.exposedTo },
      options.source ?? document,
    ),
  );
  return {
    dispose: () => handles.forEach((handle) => handle.dispose()),
    ready: Promise.all(handles.map(({ ready }) => ready)).then(() => undefined),
  };
};

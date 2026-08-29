import "server-only";

import {
  ERROR_CODES,
  SCHEMA_VERSION,
  contractValidators,
  validateSlot,
  type DemoCancelSlotData,
  type DemoCancelSlotInput,
  type ErrorCode,
  type Provider,
  type ProviderConfirmData,
  type ProviderConfirmInput,
  type ProviderHoldData,
  type ProviderHoldHttpData,
  type ProviderHoldInput,
  type ProviderHoldStatusData,
  type ProviderHoldStatusInput,
  type ProviderReleaseData,
  type ProviderReleaseInput,
  type ProviderSearchData,
  type ProviderSearchInput,
  type Slot,
} from "@serendipity/contracts";

import {
  createHoldToken,
  hashSecret,
  secretsEqual,
  verifyHoldToken,
  verifyScopedAccessToken,
} from "./security";
import { verifyHubInterserviceRequest } from "./interservice";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 32_768;

type ProviderCategory = Slot["category"];

export type ProviderProfile = {
  category: ProviderCategory;
  id: string;
  provider: Provider;
};

export type CreateHoldDatabaseInput = {
  browserSessionId: string;
  clientRequestId: string;
  expectedInventoryVersion: string;
  holdId: string;
  idempotencyHash: string;
  now: string;
  providerId: string;
  quantity: 1;
  requestHash: string;
  slotId: string;
  tokenHash: string;
};

export type CreateHoldDatabaseResult = {
  errorCode: string | null;
  expiresAt: string | null;
  holdId: string | null;
  inventoryVersion: string | null;
  ok: boolean;
  slotId: string | null;
  status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED" | null;
};

export type HoldStatusDatabaseInput = {
  browserSessionId: string;
  clientRequestId: string | null;
  providerId: string;
  tokenHash: string | null;
};

export type HoldStatusDatabaseResult = {
  errorCode: string | null;
  expiresAt: string | null;
  holdId: string | null;
  ok: boolean;
  reservationRef: string | null;
  slotId: string | null;
  status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED" | null;
};

export type ConfirmHoldDatabaseInput = {
  idempotencyHash: string;
  now: string;
  providerId: string;
  requestHash: string;
  tokenHash: string;
};

export type ConfirmHoldDatabaseResult = {
  confirmedAt: string | null;
  errorCode: string | null;
  holdId: string | null;
  ok: boolean;
  reservationRef: string | null;
  status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED" | null;
};

export type ReleaseHoldDatabaseInput = {
  idempotencyHash: string;
  now: string;
  providerId: string;
  requestHash: string;
  tokenHash: string;
};

export type ReleaseHoldDatabaseResult = {
  capacityRestored: boolean;
  errorCode: string | null;
  holdId: string | null;
  ok: boolean;
  slotId: string | null;
  status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED" | null;
};

export type CancelDemoSlotDatabaseResult = {
  errorCode: string | null;
  inventoryVersion: string | null;
  ok: boolean;
  status: "ACTIVE" | "CANCELLED" | "SOLD_OUT" | null;
};

export type ProviderDatabase = {
  cancelDemoSlot: (
    providerId: string,
    slotId: string,
  ) => Promise<CancelDemoSlotDatabaseResult>;
  confirmHold: (
    input: ConfirmHoldDatabaseInput,
  ) => Promise<ConfirmHoldDatabaseResult>;
  createHold: (
    input: CreateHoldDatabaseInput,
  ) => Promise<CreateHoldDatabaseResult>;
  getHoldStatus: (
    input: HoldStatusDatabaseInput,
  ) => Promise<HoldStatusDatabaseResult>;
  getProviderProfile: (provider: Provider) => Promise<ProviderProfile>;
  releaseHold: (
    input: ReleaseHoldDatabaseInput,
  ) => Promise<ReleaseHoldDatabaseResult>;
  searchSlots: (
    profile: ProviderProfile,
    input: ProviderSearchInput,
  ) => Promise<Slot[]>;
};

export type ProviderApiDependencies = {
  accessSecret: string;
  clock: () => Date;
  database: ProviderDatabase;
  demoMode: boolean;
  demoOperatorSecret: string | null;
  holdSecret: string;
  interserviceSecret?: string;
  provider: Provider;
  uuid: () => string;
};

type AccessClaims =
  | { browserSessionId: string; interservice: false }
  | { browserSessionId: null; interservice: true };

type ResultMeta = {
  completedAt: string;
  correlationId: string;
  origin: string;
};

const isErrorCode = (value: string | null): value is ErrorCode =>
  value !== null && ERROR_CODES.some((code) => code === value);

const correlationId = (request: Request, uuid: () => string): string => {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  return supplied && supplied.length <= 128 ? supplied : uuid();
};

const responseHeaders = (id: string): HeadersInit => ({
  "cache-control": "no-store",
  "x-correlation-id": id,
});

const errorStatus = (code: ErrorCode): number => {
  switch (code) {
    case "VALIDATION_ERROR":
    case "UNSUPPORTED_SCHEMA_VERSION":
      return 400;
    case "WEBMCP_PERMISSION_DENIED":
    case "ORIGIN_MISMATCH":
      return 403;
    case "SLOT_NOT_FOUND":
    case "HOLD_NOT_FOUND":
    case "TOOL_NOT_FOUND":
      return 404;
    case "HOLD_EXPIRED":
      return 410;
    case "SLOT_UNAVAILABLE":
    case "HOLD_RELEASED":
    case "ALREADY_CONFIRMED":
    case "IDEMPOTENCY_CONFLICT":
      return 409;
    default:
      return 500;
  }
};

const errorMessage = (code: ErrorCode): string => {
  const messages: Partial<Record<ErrorCode, string>> = {
    ALREADY_CONFIRMED: "The hold is already confirmed.",
    HOLD_EXPIRED: "The hold has expired.",
    HOLD_NOT_FOUND: "The hold was not found.",
    HOLD_RELEASED: "The hold was already released.",
    IDEMPOTENCY_CONFLICT: "The operation key was reused for another request.",
    INTERNAL_ERROR: "The Provider could not complete the request.",
    ORIGIN_MISMATCH: "The request origin is not allowed.",
    SLOT_NOT_FOUND: "The slot was not found.",
    SLOT_UNAVAILABLE: "The slot is no longer available.",
    TOOL_NOT_FOUND: "This endpoint is not available.",
    UNSUPPORTED_SCHEMA_VERSION: "The schema version is not supported.",
    VALIDATION_ERROR: "The request did not match the Provider contract.",
    WEBMCP_PERMISSION_DENIED: "Provider authorization failed.",
  };
  return messages[code] ?? "The Provider could not complete the request.";
};

export const createProviderApi = (dependencies: ProviderApiDependencies) => {
  const meta = (request: Request): ResultMeta => ({
    completedAt: dependencies.clock().toISOString(),
    correlationId: correlationId(request, dependencies.uuid),
    origin: new URL(request.url).origin,
  });

  const failure = (
    request: Request,
    code: ErrorCode,
    status = errorStatus(code),
  ): Response => {
    const responseMeta = meta(request);
    const envelope = {
      error: {
        code,
        message: errorMessage(code),
        retryable: [
          "INTERNAL_ERROR",
          "PROVIDER_OFFLINE",
          "PROVIDER_TIMEOUT",
          "SLOT_UNAVAILABLE",
        ].includes(code),
      },
      meta: responseMeta,
      ok: false as const,
      schemaVersion: SCHEMA_VERSION,
    };
    if (!contractValidators.failureEnvelope(envelope)) {
      throw new Error("Provider failure envelope violated the shared contract");
    }
    return Response.json(envelope, {
      headers: responseHeaders(responseMeta.correlationId),
      status,
    });
  };

  const success = (
    request: Request,
    data: unknown,
    validator: (value: unknown) => boolean,
  ): Response => {
    if (!validator(data)) return failure(request, "INTERNAL_ERROR");
    const responseMeta = meta(request);
    const envelope = {
      data,
      meta: responseMeta,
      ok: true as const,
      schemaVersion: SCHEMA_VERSION,
    };
    if (!contractValidators.providerResultEnvelope(envelope)) {
      return failure(request, "INTERNAL_ERROR");
    }
    return Response.json(envelope, {
      headers: responseHeaders(responseMeta.correlationId),
      status: 200,
    });
  };

  const authenticate = (request: Request): AccessClaims | Response => {
    const requestOrigin = new URL(request.url).origin;
    const authorization = request.headers.get("authorization");
    if (authorization?.startsWith("Serendipity-HMAC ")) {
      if (
        !dependencies.interserviceSecret ||
        !verifyHubInterserviceRequest(request, {
          maxClockSkewSeconds: 60,
          now: Math.floor(dependencies.clock().getTime() / 1_000),
          provider: dependencies.provider,
          secret: dependencies.interserviceSecret,
        })
      ) {
        return failure(request, "WEBMCP_PERMISSION_DENIED", 401);
      }
      return { browserSessionId: null, interservice: true };
    }
    if (request.headers.get("origin") !== requestOrigin) {
      return failure(request, "ORIGIN_MISMATCH");
    }
    if (!authorization?.startsWith("Bearer ")) {
      return failure(request, "WEBMCP_PERMISSION_DENIED", 401);
    }
    const claims = verifyScopedAccessToken(authorization.slice(7), {
      audience: "provider-api",
      now: Math.floor(dependencies.clock().getTime() / 1_000),
      provider: dependencies.provider,
      secret: dependencies.accessSecret,
    });
    return claims
      ? { browserSessionId: claims.browserSessionId, interservice: false }
      : failure(request, "WEBMCP_PERMISSION_DENIED");
  };

  const parseBody = async (
    request: Request,
  ): Promise<
    { ok: true; value: unknown } | { ok: false; response: Response }
  > => {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return { ok: false, response: failure(request, "VALIDATION_ERROR") };
    }
    try {
      const text = await request.text();
      if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
        return { ok: false, response: failure(request, "VALIDATION_ERROR") };
      }
      return { ok: true, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, response: failure(request, "VALIDATION_ERROR") };
    }
  };

  const databaseFailure = (
    request: Request,
    errorCode: string | null,
  ): Response =>
    failure(request, isErrorCode(errorCode) ? errorCode : "INTERNAL_ERROR");

  const browserOwnsInput = (
    request: Request,
    claims: AccessClaims,
    browserSessionId: string,
  ): Response | null =>
    claims.interservice || claims.browserSessionId === browserSessionId
      ? null
      : failure(request, "WEBMCP_PERMISSION_DENIED");

  const getProfile = async (): Promise<ProviderProfile> =>
    dependencies.database.getProviderProfile(dependencies.provider);

  const verifyMutationOwnership = async (
    request: Request,
    profile: ProviderProfile,
    safeReference: string,
    browserSessionId: string,
  ): Promise<{ tokenHash: string } | Response> => {
    if (!UUID_PATTERN.test(safeReference)) {
      return failure(request, "VALIDATION_ERROR");
    }
    const rawToken = request.headers.get("x-serendipity-hold-token");
    if (!rawToken || rawToken.length > 512) {
      return failure(request, "WEBMCP_PERMISSION_DENIED");
    }
    const verified = verifyHoldToken(
      rawToken,
      dependencies.provider,
      dependencies.holdSecret,
    );
    if (!verified) return failure(request, "WEBMCP_PERMISSION_DENIED");

    const [byReference, byToken] = await Promise.all([
      dependencies.database.getHoldStatus({
        browserSessionId,
        clientRequestId: safeReference,
        providerId: profile.id,
        tokenHash: null,
      }),
      dependencies.database.getHoldStatus({
        browserSessionId,
        clientRequestId: null,
        providerId: profile.id,
        tokenHash: verified.tokenHash,
      }),
    ]);
    if (
      !byReference.ok ||
      !byToken.ok ||
      !byReference.holdId ||
      byReference.holdId !== byToken.holdId ||
      byReference.holdId !== verified.holdId
    ) {
      return failure(request, "HOLD_NOT_FOUND");
    }
    return { tokenHash: verified.tokenHash };
  };

  const handle = async (
    request: Request,
    operation: (claims: AccessClaims, body: unknown) => Promise<Response>,
  ): Promise<Response> => {
    try {
      const authenticated = authenticate(request);
      if (authenticated instanceof Response) return authenticated;
      const parsed = await parseBody(request);
      if (!parsed.ok) return parsed.response;
      return await operation(authenticated, parsed.value);
    } catch {
      return failure(request, "INTERNAL_ERROR");
    }
  };

  return {
    async search(request: Request): Promise<Response> {
      return handle(request, async (_claims, body) => {
        if (!contractValidators.providerSearchInput(body)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const input = body as ProviderSearchInput;
        if (Date.parse(input.endAt) <= Date.parse(input.startAt)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const profile = await getProfile();
        const slots = await dependencies.database.searchSlots(profile, input);
        const data: ProviderSearchData = {
          inventoryAsOf: dependencies.clock().toISOString(),
          provider: dependencies.provider,
          slots: [...slots]
            .sort(
              (left, right) =>
                Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
                left.slotId.localeCompare(right.slotId),
            )
            .slice(0, 10),
        };
        if (
          data.slots.some(
            (candidate) =>
              candidate.provider !== dependencies.provider ||
              !validateSlot(candidate).ok,
          )
        ) {
          return failure(request, "INTERNAL_ERROR");
        }
        return success(request, data, contractValidators.providerSearchData);
      });
    },

    async hold(request: Request): Promise<Response> {
      return handle(request, async (claims, body) => {
        if (!contractValidators.providerHoldInput(body)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const input = body as ProviderHoldInput;
        const ownershipFailure = browserOwnsInput(
          request,
          claims,
          input.browserSessionId,
        );
        if (ownershipFailure) return ownershipFailure;
        if (
          !UUID_PATTERN.test(input.slotId) ||
          !UUID_PATTERN.test(input.browserSessionId) ||
          !UUID_PATTERN.test(input.clientRequestId) ||
          !/^[1-9]\d*$/.test(input.inventoryVersion)
        ) {
          return failure(request, "VALIDATION_ERROR");
        }

        const profile = await getProfile();
        const proposedHoldId = dependencies.uuid();
        const proposedToken = createHoldToken(
          { holdId: proposedHoldId, provider: dependencies.provider },
          dependencies.holdSecret,
        );
        const requestHash = hashSecret(
          JSON.stringify({
            browserSessionId: input.browserSessionId,
            clientRequestId: input.clientRequestId,
            inventoryVersion: input.inventoryVersion,
            quantity: input.quantity,
            slotId: input.slotId,
          }),
        );
        const result = await dependencies.database.createHold({
          browserSessionId: input.browserSessionId,
          clientRequestId: input.clientRequestId,
          expectedInventoryVersion: input.inventoryVersion,
          holdId: proposedHoldId,
          idempotencyHash: hashSecret(input.idempotencyKey),
          now: dependencies.clock().toISOString(),
          providerId: profile.id,
          quantity: 1,
          requestHash,
          slotId: input.slotId,
          tokenHash: hashSecret(proposedToken),
        });
        if (result.ok && result.status !== "HELD") {
          const terminalCode: ErrorCode =
            result.status === "CONFIRMED"
              ? "ALREADY_CONFIRMED"
              : result.status === "EXPIRED"
                ? "HOLD_EXPIRED"
                : "HOLD_RELEASED";
          return failure(request, terminalCode);
        }
        if (
          !result.ok ||
          !result.holdId ||
          !result.slotId ||
          !result.expiresAt ||
          result.status !== "HELD"
        ) {
          return databaseFailure(request, result.errorCode);
        }
        const publicResult: ProviderHoldData = {
          expiresAt: result.expiresAt,
          holdSafeReference: input.clientRequestId,
          provider: dependencies.provider,
          slotId: result.slotId,
          status: "HELD",
        };
        const data: ProviderHoldHttpData = {
          holdToken: createHoldToken(
            { holdId: result.holdId, provider: dependencies.provider },
            dependencies.holdSecret,
          ),
          publicResult,
        };
        return success(request, data, contractValidators.providerHoldHttpData);
      });
    },

    async status(
      request: Request,
      expectedSafeReference?: string,
    ): Promise<Response> {
      return handle(request, async (claims, body) => {
        if (!contractValidators.providerHoldStatusInput(body)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const input = body as ProviderHoldStatusInput;
        const ownershipFailure = browserOwnsInput(
          request,
          claims,
          input.browserSessionId,
        );
        if (ownershipFailure) return ownershipFailure;
        const safeReference = input.holdSafeReference ?? input.clientRequestId;
        if (
          !safeReference ||
          (expectedSafeReference !== undefined &&
            safeReference !== expectedSafeReference) ||
          !UUID_PATTERN.test(safeReference) ||
          !UUID_PATTERN.test(input.browserSessionId)
        ) {
          return failure(request, "VALIDATION_ERROR");
        }
        const profile = await getProfile();
        const result = await dependencies.database.getHoldStatus({
          browserSessionId: input.browserSessionId,
          clientRequestId: safeReference,
          providerId: profile.id,
          tokenHash: null,
        });
        if (
          !result.ok ||
          !result.slotId ||
          !result.expiresAt ||
          !result.status
        ) {
          return databaseFailure(request, result.errorCode);
        }
        const data: ProviderHoldStatusData = {
          expiresAt: result.expiresAt,
          holdSafeReference: safeReference,
          provider: dependencies.provider,
          slotId: result.slotId,
          status: result.status,
          ...(result.reservationRef
            ? { reservationRef: result.reservationRef }
            : {}),
        };
        const response = success(
          request,
          data,
          contractValidators.providerHoldStatusData,
        );
        if (data.status === "HELD") {
          if (!result.holdId) return failure(request, "INTERNAL_ERROR");
          response.headers.set(
            "x-serendipity-recovered-hold-token",
            createHoldToken(
              { holdId: result.holdId, provider: dependencies.provider },
              dependencies.holdSecret,
            ),
          );
        }
        return response;
      });
    },

    async confirm(request: Request, safeReference: string): Promise<Response> {
      return handle(request, async (claims, body) => {
        if (!contractValidators.providerConfirmInput(body)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const input = body as ProviderConfirmInput;
        const ownershipFailure = browserOwnsInput(
          request,
          claims,
          input.browserSessionId,
        );
        if (ownershipFailure) return ownershipFailure;
        if (input.holdSafeReference !== safeReference) {
          return failure(request, "VALIDATION_ERROR");
        }
        const profile = await getProfile();
        const verified = await verifyMutationOwnership(
          request,
          profile,
          safeReference,
          input.browserSessionId,
        );
        if (verified instanceof Response) return verified;
        const result = await dependencies.database.confirmHold({
          idempotencyHash: hashSecret(input.idempotencyKey),
          now: dependencies.clock().toISOString(),
          providerId: profile.id,
          requestHash: hashSecret(
            JSON.stringify({
              browserSessionId: input.browserSessionId,
              holdSafeReference: input.holdSafeReference,
            }),
          ),
          tokenHash: verified.tokenHash,
        });
        if (
          !result.ok ||
          result.status !== "CONFIRMED" ||
          !result.reservationRef ||
          !result.confirmedAt
        ) {
          return databaseFailure(request, result.errorCode);
        }
        const data: ProviderConfirmData = {
          confirmedAt: result.confirmedAt,
          holdSafeReference: safeReference,
          provider: dependencies.provider,
          reservationRef: result.reservationRef,
          status: "CONFIRMED",
        };
        return success(request, data, contractValidators.providerConfirmData);
      });
    },

    async release(request: Request, safeReference: string): Promise<Response> {
      return handle(request, async (claims, body) => {
        if (!contractValidators.providerReleaseInput(body)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const input = body as ProviderReleaseInput;
        const ownershipFailure = browserOwnsInput(
          request,
          claims,
          input.browserSessionId,
        );
        if (ownershipFailure) return ownershipFailure;
        if (input.holdSafeReference !== safeReference) {
          return failure(request, "VALIDATION_ERROR");
        }
        const profile = await getProfile();
        const verified = await verifyMutationOwnership(
          request,
          profile,
          safeReference,
          input.browserSessionId,
        );
        if (verified instanceof Response) return verified;
        const result = await dependencies.database.releaseHold({
          idempotencyHash: hashSecret(input.idempotencyKey),
          now: dependencies.clock().toISOString(),
          providerId: profile.id,
          requestHash: hashSecret(
            JSON.stringify({
              browserSessionId: input.browserSessionId,
              holdSafeReference: input.holdSafeReference,
              reason: input.reason,
            }),
          ),
          tokenHash: verified.tokenHash,
        });
        if (
          !result.ok ||
          !result.slotId ||
          (result.status !== "RELEASED" && result.status !== "EXPIRED")
        ) {
          return databaseFailure(request, result.errorCode);
        }
        const data: ProviderReleaseData = {
          capacityRestored: result.capacityRestored,
          holdSafeReference: safeReference,
          provider: dependencies.provider,
          slotId: result.slotId,
          status: result.status,
        };
        return success(request, data, contractValidators.providerReleaseData);
      });
    },

    async cancelDemoSlot(request: Request): Promise<Response> {
      if (!dependencies.demoMode) return failure(request, "TOOL_NOT_FOUND");
      const presentedSecret = request.headers.get(
        "x-serendipity-operator-secret",
      );
      if (
        !presentedSecret ||
        !dependencies.demoOperatorSecret ||
        !secretsEqual(presentedSecret, dependencies.demoOperatorSecret)
      ) {
        return failure(request, "WEBMCP_PERMISSION_DENIED");
      }
      try {
        const parsed = await parseBody(request);
        if (!parsed.ok) return parsed.response;
        if (!contractValidators.demoCancelSlotInput(parsed.value)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const input = parsed.value as DemoCancelSlotInput;
        if (!UUID_PATTERN.test(input.slotId)) {
          return failure(request, "VALIDATION_ERROR");
        }
        const profile = await getProfile();
        const result = await dependencies.database.cancelDemoSlot(
          profile.id,
          input.slotId,
        );
        if (
          !result.ok ||
          result.status !== "CANCELLED" ||
          !result.inventoryVersion
        ) {
          return databaseFailure(request, result.errorCode);
        }
        const data: DemoCancelSlotData = {
          inventoryVersion: result.inventoryVersion,
          provider: dependencies.provider,
          slotId: input.slotId,
          status: "CANCELLED",
        };
        return success(request, data, contractValidators.demoCancelSlotData);
      } catch {
        return failure(request, "INTERNAL_ERROR");
      }
    },
  };
};

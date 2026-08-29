import "server-only";

import {
  contractValidators,
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
} from "@serendipity/contracts";
import { parseExactOrigin } from "@serendipity/provider-config";

import { createInterserviceHeaders } from "../server/interservice";
import { parseEnvelopeJson, parsePublicProviderEnvelope } from "./parse";
import {
  gatewayFailure,
  type ProviderCallContext,
  type ProviderGateway,
  type ProviderGatewayResult,
  type ProviderResultMeta,
  type ProviderTokenVault,
} from "./types";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type HttpProviderGatewayOptions = {
  fetch?: FetchLike;
  interserviceSecret: string;
  nonce?: () => string;
  now?: () => number;
  origin: string;
  provider: Provider;
  timeoutMs?: number;
  tokenVault?: ProviderTokenVault;
};

type HttpResult = {
  headers: Headers;
  serialized: string;
};

const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;

class ProviderTransportInterruption extends Error {
  readonly kind: "cancelled" | "timeout";

  constructor(kind: "cancelled" | "timeout") {
    super(
      kind === "cancelled"
        ? "The Provider call was cancelled."
        : "The Provider request timed out.",
    );
    this.name = "ProviderTransportInterruption";
    this.kind = kind;
  }
}

export class HttpProviderGateway implements ProviderGateway {
  readonly provider: Provider;
  readonly #fetch: FetchLike;
  readonly #interserviceSecret: string;
  readonly #nonce: () => string;
  readonly #now: () => number;
  readonly #origin: string;
  readonly #timeoutMs: number;
  readonly #tokenVault: ProviderTokenVault | undefined;

  constructor(options: HttpProviderGatewayOptions) {
    this.provider = options.provider;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#interserviceSecret = options.interserviceSecret;
    this.#nonce =
      options.nonce ?? globalThis.crypto.randomUUID.bind(globalThis.crypto);
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    this.#origin = parseExactOrigin(options.origin);
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new RangeError("Provider timeout must be a positive number.");
    }
    this.#tokenVault = options.tokenVault;
  }

  async #post(
    path: string,
    body: Readonly<Record<string, unknown>>,
    context: ProviderCallContext,
    privateHeaders: Readonly<Record<string, string>> = {},
  ): Promise<HttpResult | ProviderGatewayResult<never>> {
    if (context.signal?.aborted) {
      return gatewayFailure(
        this.provider,
        "CANCELLED",
        "The Provider call was cancelled.",
        "offline",
        false,
      );
    }
    const headers = createInterserviceHeaders(
      {
        method: "POST",
        nonce: this.#nonce(),
        path,
        provider: this.provider,
        timestamp: this.#now(),
      },
      this.#interserviceSecret,
    );
    const transportController = new AbortController();
    let interruptionKind: "cancelled" | "timeout" | null = null;
    let interrupt: (failure: ProviderTransportInterruption) => void = () =>
      undefined;
    const interruption = new Promise<never>((_resolve, reject) => {
      interrupt = reject;
    });
    const cancel = () => {
      if (interruptionKind) return;
      interruptionKind = "cancelled";
      transportController.abort(context.signal?.reason);
      interrupt(new ProviderTransportInterruption("cancelled"));
    };
    context.signal?.addEventListener("abort", cancel, { once: true });
    const deadline = globalThis.setTimeout(() => {
      if (interruptionKind) return;
      interruptionKind = "timeout";
      transportController.abort(new ProviderTransportInterruption("timeout"));
      interrupt(new ProviderTransportInterruption("timeout"));
    }, this.#timeoutMs);
    try {
      return await Promise.race([
        (async () => {
          const response = await this.#fetch(`${this.#origin}${path}`, {
            body: JSON.stringify(body),
            headers: {
              ...headers,
              ...privateHeaders,
              "content-type": "application/json",
            },
            method: "POST",
            signal: transportController.signal,
          });
          return {
            headers: response.headers,
            serialized: await response.text(),
          };
        })(),
        interruption,
      ]);
    } catch (error) {
      const cancelled =
        interruptionKind === "cancelled" ||
        (interruptionKind === null && context.signal?.aborted === true);
      const timedOut =
        !cancelled &&
        (interruptionKind === "timeout" ||
          (error instanceof ProviderTransportInterruption &&
            error.kind === "timeout") ||
          (error instanceof Error &&
            /timeout/i.test(`${error.name} ${error.message}`)));
      return gatewayFailure(
        this.provider,
        cancelled
          ? "CANCELLED"
          : timedOut
            ? "PROVIDER_TIMEOUT"
            : "PROVIDER_OFFLINE",
        cancelled
          ? "The Provider call was cancelled."
          : timedOut
            ? "The Provider request timed out."
            : "The Provider could not be reached.",
        "offline",
        !cancelled,
      );
    } finally {
      globalThis.clearTimeout(deadline);
      context.signal?.removeEventListener("abort", cancel);
    }
  }

  async #publicOperation<T>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    validator: (value: unknown) => boolean,
    context: ProviderCallContext,
    privateHeaders?: Readonly<Record<string, string>>,
  ): Promise<ProviderGatewayResult<T>> {
    const response = await this.#post(path, body, context, privateHeaders);
    if ("ok" in response) return response;
    return parsePublicProviderEnvelope<T>(
      response.serialized,
      this.provider,
      validator,
    );
  }

  search(input: ProviderSearchInput, context: ProviderCallContext) {
    return this.#publicOperation<ProviderSearchData>(
      "/api/slots",
      input,
      contractValidators.providerSearchData,
      context,
    );
  }

  async hold(
    input: ProviderHoldInput,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<ProviderHoldData>> {
    if (!this.#tokenVault) {
      return gatewayFailure(
        this.provider,
        "INTERNAL_ERROR",
        "The manual hold token vault is unavailable.",
        "provider",
        false,
      );
    }
    const response = await this.#post("/api/holds", input, context);
    if ("ok" in response) return response;
    const envelope = parseEnvelopeJson(response.serialized, this.provider);
    if ("failureType" in envelope) return envelope;
    const meta = envelope.meta as ProviderResultMeta;
    if (envelope.ok === false) {
      return parsePublicProviderEnvelope<ProviderHoldData>(
        response.serialized,
        this.provider,
        contractValidators.providerHoldData,
      );
    }
    if (!contractValidators.providerHoldHttpData(envelope.data)) {
      return gatewayFailure(
        this.provider,
        "VALIDATION_ERROR",
        "Provider hold data did not match the private HTTP contract.",
        "invalid",
        false,
      );
    }
    const data = envelope.data as ProviderHoldHttpData;
    if (data.publicResult.provider !== this.provider) {
      return gatewayFailure(
        this.provider,
        "ORIGIN_MISMATCH",
        "Provider hold identity did not match the requested origin.",
        "invalid",
        false,
      );
    }
    try {
      await this.#tokenVault.save(
        this.provider,
        data.publicResult.holdSafeReference,
        data.holdToken,
      );
      return { data: data.publicResult, meta, ok: true };
    } catch {
      return gatewayFailure(
        this.provider,
        "INTERNAL_ERROR",
        "The private hold token could not be stored.",
        "provider",
        false,
      );
    }
  }

  async getHoldStatus(
    input: ProviderHoldStatusInput,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<ProviderHoldStatusData>> {
    const safeReference = input.holdSafeReference ?? input.clientRequestId;
    const path = input.holdSafeReference
      ? `/api/holds/${encodeURIComponent(input.holdSafeReference)}`
      : "/api/holds/status";
    const response = await this.#post(path, input, context);
    if ("ok" in response) return response;
    const parsed = parsePublicProviderEnvelope<ProviderHoldStatusData>(
      response.serialized,
      this.provider,
      contractValidators.providerHoldStatusData,
    );
    const recoveredToken = response.headers.get(
      "x-serendipity-recovered-hold-token",
    );
    if (
      parsed.ok &&
      parsed.data.status === "HELD" &&
      safeReference &&
      recoveredToken &&
      this.#tokenVault
    ) {
      try {
        await this.#tokenVault.save(
          this.provider,
          safeReference,
          recoveredToken,
        );
      } catch {
        return gatewayFailure(
          this.provider,
          "INTERNAL_ERROR",
          "The recovered hold authority could not be stored.",
          "provider",
          false,
        );
      }
    } else if (
      parsed.ok &&
      parsed.data.status !== "HELD" &&
      safeReference &&
      this.#tokenVault
    ) {
      await this.#tokenVault.clear(this.provider, safeReference);
    }
    return parsed;
  }

  async #tokenOperation<T>(
    operation: "confirm" | "release",
    input: ProviderConfirmInput | ProviderReleaseInput,
    validator: (value: unknown) => boolean,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<T>> {
    if (!this.#tokenVault) {
      return gatewayFailure(
        this.provider,
        "HOLD_NOT_FOUND",
        "No private hold authority is available.",
        "provider",
        false,
      );
    }
    const token = await this.#tokenVault.load(
      this.provider,
      input.holdSafeReference,
    );
    if (!token) {
      return gatewayFailure(
        this.provider,
        "HOLD_NOT_FOUND",
        "The active hold could not be recovered.",
        "provider",
        false,
      );
    }
    const result = await this.#publicOperation<T>(
      `/api/holds/${encodeURIComponent(input.holdSafeReference)}/${operation}`,
      input,
      validator,
      context,
      { "x-serendipity-hold-token": token },
    );
    if (
      result.ok ||
      ["HOLD_EXPIRED", "HOLD_RELEASED", "ALREADY_CONFIRMED"].includes(
        result.error.code,
      )
    ) {
      await this.#tokenVault.clear(this.provider, input.holdSafeReference);
    }
    return result;
  }

  confirm(input: ProviderConfirmInput, context: ProviderCallContext) {
    return this.#tokenOperation<ProviderConfirmData>(
      "confirm",
      input,
      contractValidators.providerConfirmData,
      context,
    );
  }

  release(input: ProviderReleaseInput, context: ProviderCallContext) {
    return this.#tokenOperation<ProviderReleaseData>(
      "release",
      input,
      contractValidators.providerReleaseData,
      context,
    );
  }
}

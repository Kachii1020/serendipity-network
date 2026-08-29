import {
  contractValidators,
  type Provider,
  type ProviderConfirmData,
  type ProviderConfirmInput,
  type ProviderHoldData,
  type ProviderHoldInput,
  type ProviderHoldStatusData,
  type ProviderHoldStatusInput,
  type ProviderReleaseData,
  type ProviderReleaseInput,
  type ProviderSearchData,
  type ProviderSearchInput,
} from "@serendipity/contracts";
import { parseExactOrigin } from "@serendipity/provider-config";
import {
  discoverExactTools,
  executeTool,
  normalizeWebMcpError,
  type ExecutionEncoding,
  type RegisteredTool,
} from "@serendipity/webmcp";

import { parsePublicProviderEnvelope } from "./parse";
import {
  gatewayFailure,
  type ProviderCallContext,
  type ProviderGateway,
  type ProviderGatewayResult,
} from "./types";

type WebMcpProviderGatewayOptions = {
  document: Document;
  encoding?: ExecutionEncoding;
  origin: string;
  provider: Provider;
  timeoutMs?: number;
};

type Operation =
  | "confirm_hold"
  | "get_hold_status"
  | "hold_slot"
  | "release_hold"
  | "search_slots";

export class WebMcpProviderGateway implements ProviderGateway {
  readonly provider: Provider;
  readonly #document: Document;
  readonly #encoding: ExecutionEncoding;
  readonly #origin: string;
  readonly #timeoutMs: number;

  constructor(options: WebMcpProviderGatewayOptions) {
    this.provider = options.provider;
    this.#document = options.document;
    this.#encoding = options.encoding ?? "json-string";
    this.#origin = parseExactOrigin(options.origin);
    this.#timeoutMs = options.timeoutMs ?? 5_000;
  }

  async #tool(
    operation: Operation,
  ): Promise<ProviderGatewayResult<RegisteredTool>> {
    const name = `${this.provider}_${operation}`;
    try {
      const discovery = await discoverExactTools(
        {
          expected: [{ name, origin: this.#origin }],
          fromOrigins: [this.#origin],
        },
        this.#document,
      );
      if (discovery.tools.length === 0) {
        return gatewayFailure(
          this.provider,
          "TOOL_NOT_FOUND",
          "The expected Provider tool was not available.",
          "offline",
          true,
        );
      }
      if (discovery.tools.length !== 1) {
        return gatewayFailure(
          this.provider,
          "ORIGIN_MISMATCH",
          "More than one exact Provider tool matched.",
          "invalid",
          false,
        );
      }
      return {
        data: discovery.tools[0]!,
        meta: {
          completedAt: new Date().toISOString(),
          correlationId: `discovery-${this.provider}-${operation}`,
          origin: this.#origin,
        },
        ok: true,
      };
    } catch (error) {
      return this.#transportFailure(error);
    }
  }

  #transportFailure(error: unknown): ProviderGatewayResult<never> {
    const normalized = normalizeWebMcpError(error);
    const code =
      normalized.code === "TIMEOUT"
        ? "PROVIDER_TIMEOUT"
        : normalized.code === "ABORTED"
          ? "CANCELLED"
          : normalized.code === "PERMISSION_DENIED"
            ? "WEBMCP_PERMISSION_DENIED"
            : normalized.code === "NOT_SUPPORTED"
              ? "WEBMCP_UNAVAILABLE"
              : "PROVIDER_OFFLINE";
    return gatewayFailure(
      this.provider,
      code,
      code === "PROVIDER_TIMEOUT"
        ? "The Provider tool timed out."
        : code === "CANCELLED"
          ? "The Provider call was cancelled."
          : "The Provider tool could not be reached.",
      "offline",
      code !== "CANCELLED",
    );
  }

  async #execute<T>(
    operation: Operation,
    input: Readonly<Record<string, unknown>>,
    validator: (value: unknown) => boolean,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<T>> {
    // Deliberately rediscover for every call. This prevents iframe navigation or
    // toolchange from leaving a stale RegisteredTool authority in memory.
    const discovered = await this.#tool(operation);
    if (!discovered.ok) return discovered;
    try {
      const serialized = await executeTool(
        discovered.data,
        {
          encoding: this.#encoding,
          input,
          ...(context.signal ? { signal: context.signal } : {}),
          timeoutMs: this.#timeoutMs,
        },
        this.#document,
      );
      if (serialized === null) {
        return gatewayFailure(
          this.provider,
          "VALIDATION_ERROR",
          "Provider tool returned an empty result.",
          "invalid",
          false,
        );
      }
      return parsePublicProviderEnvelope<T>(
        serialized,
        this.provider,
        validator,
      );
    } catch (error) {
      return this.#transportFailure(error);
    }
  }

  search(input: ProviderSearchInput, context: ProviderCallContext) {
    return this.#execute<ProviderSearchData>(
      "search_slots",
      input,
      contractValidators.providerSearchData,
      context,
    );
  }

  hold(input: ProviderHoldInput, context: ProviderCallContext) {
    return this.#execute<ProviderHoldData>(
      "hold_slot",
      {
        browserSessionId: input.browserSessionId,
        clientRequestId: input.clientRequestId,
        inventoryVersion: input.inventoryVersion,
        quantity: input.quantity,
        schemaVersion: input.schemaVersion,
        slotId: input.slotId,
      },
      contractValidators.providerHoldData,
      context,
    );
  }

  getHoldStatus(input: ProviderHoldStatusInput, context: ProviderCallContext) {
    return this.#execute<ProviderHoldStatusData>(
      "get_hold_status",
      input,
      contractValidators.providerHoldStatusData,
      context,
    );
  }

  confirm(input: ProviderConfirmInput, context: ProviderCallContext) {
    return this.#execute<ProviderConfirmData>(
      "confirm_hold",
      {
        browserSessionId: input.browserSessionId,
        holdSafeReference: input.holdSafeReference,
        schemaVersion: input.schemaVersion,
      },
      contractValidators.providerConfirmData,
      context,
    );
  }

  release(input: ProviderReleaseInput, context: ProviderCallContext) {
    return this.#execute<ProviderReleaseData>(
      "release_hold",
      {
        browserSessionId: input.browserSessionId,
        holdSafeReference: input.holdSafeReference,
        reason: input.reason,
        schemaVersion: input.schemaVersion,
      },
      contractValidators.providerReleaseData,
      context,
    );
  }
}

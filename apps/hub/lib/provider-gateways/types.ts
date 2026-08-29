import type {
  Provider,
  ProviderConfirmData,
  ProviderConfirmInput,
  ProviderHoldData,
  ProviderHoldInput,
  ProviderHoldStatusData,
  ProviderHoldStatusInput,
  ProviderReleaseData,
  ProviderReleaseInput,
  ProviderSearchData,
  ProviderSearchInput,
  PublicError,
} from "@serendipity/contracts";

export type ProviderResultMeta = {
  completedAt: string;
  correlationId: string;
  origin: string;
};

export type ProviderGatewayFailureType = "invalid" | "offline" | "provider";

export type ProviderGatewayResult<T> =
  | {
      data: T;
      meta: ProviderResultMeta;
      ok: true;
    }
  | {
      error: PublicError;
      failureType: ProviderGatewayFailureType;
      meta?: ProviderResultMeta;
      ok: false;
    };

export type ProviderCallContext = {
  signal?: AbortSignal;
};

export type ProviderTokenVault = {
  clear(provider: Provider, holdSafeReference: string): Promise<void> | void;
  load(
    provider: Provider,
    holdSafeReference: string,
  ): Promise<string | null> | string | null;
  save(
    provider: Provider,
    holdSafeReference: string,
    rawToken: string,
  ): Promise<void> | void;
};

export interface ProviderGateway {
  readonly provider: Provider;

  search(
    input: ProviderSearchInput,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<ProviderSearchData>>;

  hold(
    input: ProviderHoldInput,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<ProviderHoldData>>;

  getHoldStatus(
    input: ProviderHoldStatusInput,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<ProviderHoldStatusData>>;

  confirm(
    input: ProviderConfirmInput,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<ProviderConfirmData>>;

  release(
    input: ProviderReleaseInput,
    context: ProviderCallContext,
  ): Promise<ProviderGatewayResult<ProviderReleaseData>>;
}

export const gatewayFailure = (
  provider: Provider,
  code: PublicError["code"],
  message: string,
  failureType: ProviderGatewayFailureType,
  retryable: boolean,
): ProviderGatewayResult<never> => ({
  error: { code, message, provider, retryable },
  failureType,
  ok: false,
});

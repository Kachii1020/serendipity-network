import "server-only";

import type { Provider } from "@serendipity/contracts";

import type { ProviderTokenVault } from "../provider-gateways/types";

const key = (provider: Provider, safeReference: string): string =>
  `${provider}:${safeReference}`;

export class MemoryProviderTokenVault implements ProviderTokenVault {
  readonly #tokens = new Map<string, string>();

  clear(provider: Provider, holdSafeReference: string): void {
    this.#tokens.delete(key(provider, holdSafeReference));
  }

  load(provider: Provider, holdSafeReference: string): string | null {
    return this.#tokens.get(key(provider, holdSafeReference)) ?? null;
  }

  save(provider: Provider, holdSafeReference: string, rawToken: string): void {
    this.#tokens.set(key(provider, holdSafeReference), rawToken);
  }
}

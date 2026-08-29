import "server-only";

import type { Provider } from "@serendipity/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { encryptHoldToken } from "./encryption";

export type ActiveHold = {
  bundleSessionId: string;
  holdId: string;
  provider: Provider;
  providerId: string;
  publicReference: string;
  rawToken: string;
  slotId: string;
};

export type EncryptedHoldRecord = Omit<ActiveHold, "rawToken"> & {
  holdTokenCiphertext: string;
};

export type BundleTokenStorage = {
  clearEncryptedHolds(bundleSessionId: string): Promise<void>;
  saveEncryptedHold(record: EncryptedHoldRecord): Promise<void>;
};

export const createBundleTokenRepository = (
  storage: BundleTokenStorage,
  encryptionKey: string,
) => ({
  async clearTerminalTokens(bundleSessionId: string): Promise<void> {
    await storage.clearEncryptedHolds(bundleSessionId);
  },
  async persistActiveHold(input: ActiveHold): Promise<void> {
    const { rawToken, ...safeFields } = input;
    const holdTokenCiphertext = encryptHoldToken(rawToken, encryptionKey, {
      bundleSessionId: input.bundleSessionId,
      provider: input.provider,
    });
    await storage.saveEncryptedHold({ ...safeFields, holdTokenCiphertext });
  },
});

const bytea = (base64url: string): string =>
  `\\x${Buffer.from(base64url, "base64url").toString("hex")}`;

export const createSupabaseBundleTokenStorage = (
  client: SupabaseClient,
): BundleTokenStorage => ({
  async clearEncryptedHolds(bundleSessionId) {
    const { error } = await client
      .from("bundle_items")
      .update({ hold_token_ciphertext: null })
      .eq("bundle_session_id", bundleSessionId);
    if (error) throw error;
  },
  async saveEncryptedHold(record) {
    const { error } = await client
      .from("bundle_items")
      .update({
        hold_id: record.holdId,
        hold_token_ciphertext: bytea(record.holdTokenCiphertext),
        public_reference: record.publicReference,
        updated_at: new Date().toISOString(),
      })
      .eq("bundle_session_id", record.bundleSessionId)
      .eq("provider_id", record.providerId)
      .eq("slot_id", record.slotId);
    if (error) throw error;
  },
});

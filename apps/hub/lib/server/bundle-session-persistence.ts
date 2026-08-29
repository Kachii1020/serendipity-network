import "server-only";

import {
  assertPublicPayloadSafe,
  validateBundleSummary,
  validateIntent,
  type BundleSummary,
  type Intent,
} from "@serendipity/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BundleSessionRow = {
  browser_session_id: string;
  candidate_bundles_json: BundleSummary[];
  candidate_set_version: number;
  hold_expires_at: null;
  id: string;
  intent_json: Intent;
  last_error_code: null;
  phase: "composed";
  selected_bundle_id: null;
};

export type BundleSessionStorage = {
  findOwnedSession(
    bundleSessionId: string,
    browserSessionId: string,
  ): Promise<unknown>;
  insertSession(row: BundleSessionRow): Promise<void>;
};

export type CreateBundleSessionInput = {
  browserSessionId: string;
  bundleSessionId: string;
  candidateBundles: readonly unknown[];
  intent: unknown;
};

const validateCandidates = (values: readonly unknown[]): BundleSummary[] => {
  if (values.length < 1 || values.length > 3) {
    throw new Error("candidate bundles must contain 1-3 items");
  }
  const candidates = values.map((value, index) => {
    const validated = validateBundleSummary(value);
    if (!validated.ok) {
      throw new Error(
        `candidate bundle ${index} is invalid: ${validated.issues.join(", ")}`,
      );
    }
    return validated.value;
  });
  const version = candidates[0]?.bundleVersion;
  if (
    version === undefined ||
    candidates.some((candidate) => candidate.bundleVersion !== version)
  ) {
    throw new Error("candidate bundles must share one bundle version");
  }
  return candidates;
};

export const createBundleSessionRepository = (
  storage: BundleSessionStorage,
) => ({
  async create(input: CreateBundleSessionInput): Promise<void> {
    const intent = validateIntent(input.intent);
    if (!intent.ok) {
      throw new Error(`intent is invalid: ${intent.issues.join(", ")}`);
    }
    const candidateBundles = validateCandidates(input.candidateBundles);
    const publicPayload = assertPublicPayloadSafe({
      candidateBundles,
      intent: intent.value,
    });
    if (!publicPayload.ok) {
      throw new Error(
        `bundle session contains a sensitive field at ${publicPayload.path}`,
      );
    }
    const candidateSetVersion = candidateBundles[0]?.bundleVersion;
    if (candidateSetVersion === undefined) {
      throw new Error("candidate bundle version is missing");
    }
    await storage.insertSession({
      browser_session_id: input.browserSessionId,
      candidate_bundles_json: candidateBundles,
      candidate_set_version: candidateSetVersion,
      hold_expires_at: null,
      id: input.bundleSessionId,
      intent_json: intent.value,
      last_error_code: null,
      phase: "composed",
      selected_bundle_id: null,
    });
  },
  async loadOwned(
    bundleSessionId: string,
    browserSessionId: string,
  ): Promise<unknown> {
    return storage.findOwnedSession(bundleSessionId, browserSessionId);
  },
});

export const createSupabaseBundleSessionStorage = (
  client: SupabaseClient,
): BundleSessionStorage => ({
  async findOwnedSession(bundleSessionId, browserSessionId) {
    const { data, error } = await client
      .from("bundle_sessions")
      .select(
        "id, browser_session_id, intent_json, candidate_bundles_json, candidate_set_version, selected_bundle_id, phase, hold_expires_at, last_error_code, created_at, updated_at",
      )
      .eq("id", bundleSessionId)
      .eq("browser_session_id", browserSessionId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async insertSession(row) {
    const { error } = await client.from("bundle_sessions").insert(row);
    if (error) throw error;
  },
});

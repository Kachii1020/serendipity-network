import "server-only";

import {
  PROVIDERS,
  assertPublicPayloadSafe,
  validateBundleSummary,
  validateIntent,
  type BundleSummary,
  type Intent,
  type Provider,
} from "@serendipity/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { HeldBundleSession } from "../orchestrator/hold";
import type { CandidateSession } from "../selection";
import { decryptHoldToken, encryptHoldToken } from "./encryption";

export type StoredWorkflowItem = {
  holdTokenCiphertext: string | null;
  position: number;
  provider: Provider;
  publicReference: string;
  slotId: string;
  status: "CONFIRMED" | "EXPIRED" | "HELD" | "RELEASED";
};

export type StoredHeldWorkflow = {
  browserSessionId: string;
  bundleSessionId: string;
  bundleVersion: number;
  candidates: readonly BundleSummary[];
  expiresAt: string;
  intent: Intent;
  items: readonly StoredWorkflowItem[];
  selectedBundleId: string;
};

export type WorkflowPersistenceStorage = {
  insertHeld(record: StoredHeldWorkflow): Promise<void>;
  loadOwned(
    bundleSessionId: string,
    browserSessionId: string,
  ): Promise<StoredHeldWorkflow | null>;
  markTerminal(
    bundleSessionId: string,
    browserSessionId: string,
    phase: "confirmed" | "composed",
    statuses: Readonly<Record<Provider, "CONFIRMED" | "EXPIRED" | "RELEASED">>,
  ): Promise<void>;
};

export type PersistHeldWorkflowInput = {
  candidateSession: CandidateSession;
  heldSession: HeldBundleSession;
  rawTokens?: Partial<Record<Provider, string>>;
};

export type LoadedHeldWorkflow = {
  candidateSession: CandidateSession;
  heldSession: HeldBundleSession;
  rawTokens: Partial<Record<Provider, string>>;
};

const validateRecord = (record: StoredHeldWorkflow): void => {
  const intent = validateIntent(record.intent);
  if (!intent.ok) throw new Error("persisted workflow intent is invalid");
  if (
    record.candidates.length < 1 ||
    record.candidates.length > 3 ||
    record.candidates.some(
      (candidate) =>
        !validateBundleSummary(candidate).ok ||
        candidate.bundleVersion !== record.bundleVersion,
    ) ||
    !record.candidates.some(
      ({ bundleId }) => bundleId === record.selectedBundleId,
    )
  ) {
    throw new Error("persisted workflow candidates are invalid");
  }
  if (
    record.items.length !== PROVIDERS.length ||
    record.items.some(
      (item, index) =>
        item.provider !== PROVIDERS[index] || item.position !== index,
    )
  ) {
    throw new Error("persisted workflow items are invalid");
  }
  const safe = assertPublicPayloadSafe({
    candidates: record.candidates,
    intent: record.intent,
    items: record.items.map((item) => ({
      position: item.position,
      provider: item.provider,
      publicReference: item.publicReference,
      slotId: item.slotId,
      status: item.status,
    })),
  });
  if (!safe.ok) throw new Error("persisted workflow public fields are unsafe");
};

export const createWorkflowRepository = (
  storage: WorkflowPersistenceStorage,
  encryptionKey: string,
) => ({
  async loadHeld(
    bundleSessionId: string,
    browserSessionId: string,
  ): Promise<LoadedHeldWorkflow | null> {
    const record = await storage.loadOwned(bundleSessionId, browserSessionId);
    if (!record) return null;
    validateRecord(record);
    const bundle = record.candidates.find(
      ({ bundleId }) => bundleId === record.selectedBundleId,
    );
    if (!bundle) throw new Error("persisted selected bundle is missing");
    const rawTokens: Partial<Record<Provider, string>> = {};
    for (const item of record.items) {
      if (item.holdTokenCiphertext) {
        rawTokens[item.provider] = decryptHoldToken(
          item.holdTokenCiphertext,
          encryptionKey,
          { bundleSessionId, provider: item.provider },
        );
      }
    }
    return {
      candidateSession: {
        bundleSessionId,
        bundleVersion: record.bundleVersion,
        candidates: record.candidates,
        intent: record.intent,
        selectedBundleId: record.selectedBundleId,
      },
      heldSession: {
        browserSessionId,
        bundle,
        // The first hold uses the session UUID as its stable operation UUID so
        // reload does not require persisting another authority-bearing ID.
        bundleHoldId: bundleSessionId,
        bundleSessionId,
        expiresAt: record.expiresAt,
        providerHolds: record.items.map((item) => ({
          expiresAt: record.expiresAt,
          holdSafeReference: item.publicReference,
          provider: item.provider,
          slotId: item.slotId,
        })),
      },
      rawTokens,
    };
  },

  async markTerminal(
    bundleSessionId: string,
    browserSessionId: string,
    phase: "confirmed" | "composed",
    statuses: Readonly<Record<Provider, "CONFIRMED" | "EXPIRED" | "RELEASED">>,
  ): Promise<void> {
    await storage.markTerminal(
      bundleSessionId,
      browserSessionId,
      phase,
      statuses,
    );
  },

  async persistHeld(input: PersistHeldWorkflowInput): Promise<void> {
    if (
      input.heldSession.bundleSessionId !==
        input.candidateSession.bundleSessionId ||
      input.heldSession.bundle.bundleId !==
        input.candidateSession.selectedBundleId ||
      input.heldSession.bundleHoldId !== input.heldSession.bundleSessionId
    ) {
      throw new Error("held workflow identity is inconsistent");
    }
    const record: StoredHeldWorkflow = {
      browserSessionId: input.heldSession.browserSessionId,
      bundleSessionId: input.heldSession.bundleSessionId,
      bundleVersion: input.candidateSession.bundleVersion,
      candidates: input.candidateSession.candidates,
      expiresAt: input.heldSession.expiresAt,
      intent: input.candidateSession.intent,
      items: input.heldSession.providerHolds.map((hold, position) => ({
        holdTokenCiphertext: input.rawTokens?.[hold.provider]
          ? encryptHoldToken(input.rawTokens[hold.provider]!, encryptionKey, {
              bundleSessionId: input.heldSession.bundleSessionId,
              provider: hold.provider,
            })
          : null,
        position,
        provider: hold.provider,
        publicReference: hold.holdSafeReference,
        slotId: hold.slotId,
        status: "HELD",
      })),
      selectedBundleId: input.candidateSession.selectedBundleId,
    };
    validateRecord(record);
    await storage.insertHeld(record);
  },
});

const toBytea = (base64url: string): string =>
  `\\x${Buffer.from(base64url, "base64url").toString("hex")}`;

const fromBytea = (value: string): string => {
  if (!value.startsWith("\\x")) throw new Error("invalid bytea token envelope");
  return Buffer.from(value.slice(2), "hex").toString("base64url");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

type ProviderRow = { id: string; slug: Provider };
type SessionRow = {
  browser_session_id: string;
  candidate_bundles_json: unknown;
  candidate_set_version: number;
  hold_expires_at: string | null;
  id: string;
  intent_json: unknown;
  phase: string;
  selected_bundle_id: string | null;
};
type ItemRow = {
  hold_token_ciphertext: string | null;
  position: number;
  provider_id: string;
  public_reference: string | null;
  slot_id: string;
  status: StoredWorkflowItem["status"];
};

export const createSupabaseWorkflowStorage = (
  client: SupabaseClient,
): WorkflowPersistenceStorage => ({
  async insertHeld(record) {
    const { data: providerData, error: providerError } = await client
      .from("providers")
      .select("id, slug")
      .in("slug", [...PROVIDERS]);
    if (providerError) throw providerError;
    const providers = (providerData ?? []) as ProviderRow[];
    const providerIds = Object.fromEntries(
      providers.map(({ id, slug }) => [slug, id]),
    ) as Partial<Record<Provider, string>>;
    if (PROVIDERS.some((provider) => !providerIds[provider])) {
      throw new Error("Provider rows are incomplete");
    }

    const holds = await Promise.all(
      record.items.map(async (item) => {
        const { data, error } = await client
          .from("holds")
          .select("id, slot_id")
          .eq("provider_id", providerIds[item.provider]!)
          .eq("browser_session_id", record.browserSessionId)
          .eq("client_request_id", item.publicReference)
          .maybeSingle();
        if (error) throw error;
        if (
          !isRecord(data) ||
          typeof data.id !== "string" ||
          typeof data.slot_id !== "string"
        ) {
          throw new Error("Provider hold was not found for persistence");
        }
        return { id: data.id, slot_id: data.slot_id };
      }),
    );

    const { error: sessionError } = await client
      .from("bundle_sessions")
      .insert({
        browser_session_id: record.browserSessionId,
        candidate_bundles_json: record.candidates,
        candidate_set_version: record.bundleVersion,
        hold_expires_at: record.expiresAt,
        id: record.bundleSessionId,
        intent_json: record.intent,
        last_error_code: null,
        phase: "held",
        selected_bundle_id: record.selectedBundleId,
      });
    if (sessionError) throw sessionError;
    const { error: itemError } = await client.from("bundle_items").insert(
      record.items.map((item, index) => ({
        bundle_session_id: record.bundleSessionId,
        hold_id: holds[index]!.id,
        hold_token_ciphertext: item.holdTokenCiphertext
          ? toBytea(item.holdTokenCiphertext)
          : null,
        position: item.position,
        provider_id: providerIds[item.provider]!,
        public_reference: item.publicReference,
        slot_id: item.slotId,
        status: "HELD",
      })),
    );
    if (itemError) {
      await client
        .from("bundle_sessions")
        .delete()
        .eq("id", record.bundleSessionId);
      throw itemError;
    }
  },

  async loadOwned(bundleSessionId, browserSessionId) {
    const { data: session, error: sessionError } = await client
      .from("bundle_sessions")
      .select(
        "id, browser_session_id, intent_json, candidate_bundles_json, candidate_set_version, selected_bundle_id, phase, hold_expires_at",
      )
      .eq("id", bundleSessionId)
      .eq("browser_session_id", browserSessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    const sessionRow: SessionRow | null = session;
    if (
      !sessionRow ||
      sessionRow.phase !== "held" ||
      !sessionRow.hold_expires_at
    ) {
      return null;
    }
    const { data: itemData, error: itemError } = await client
      .from("bundle_items")
      .select(
        "position, provider_id, slot_id, public_reference, hold_token_ciphertext, status",
      )
      .eq("bundle_session_id", bundleSessionId)
      .order("position");
    if (itemError) throw itemError;
    const items = (itemData ?? []) as unknown as ItemRow[];
    const { data: providerData, error: providerError } = await client
      .from("providers")
      .select("id, slug")
      .in(
        "id",
        items.map((item) => item.provider_id),
      );
    if (providerError) throw providerError;
    const slugById = new Map(
      ((providerData ?? []) as ProviderRow[]).map(({ id, slug }) => [id, slug]),
    );
    return {
      browserSessionId: sessionRow.browser_session_id,
      bundleSessionId: sessionRow.id,
      bundleVersion: sessionRow.candidate_set_version,
      candidates: sessionRow.candidate_bundles_json as BundleSummary[],
      expiresAt: sessionRow.hold_expires_at,
      intent: sessionRow.intent_json as Intent,
      items: items.map((item) => ({
        holdTokenCiphertext:
          typeof item.hold_token_ciphertext === "string"
            ? fromBytea(item.hold_token_ciphertext)
            : null,
        position: item.position,
        provider: slugById.get(item.provider_id)!,
        publicReference: item.public_reference ?? "",
        slotId: item.slot_id,
        status: item.status,
      })),
      selectedBundleId: sessionRow.selected_bundle_id ?? "",
    };
  },

  async markTerminal(bundleSessionId, browserSessionId, phase, statuses) {
    const { data: ownedSession, error: ownershipError } = await client
      .from("bundle_sessions")
      .select("id")
      .eq("id", bundleSessionId)
      .eq("browser_session_id", browserSessionId)
      .maybeSingle();
    if (ownershipError) throw ownershipError;
    if (!ownedSession) throw new Error("owned bundle session was not found");
    const { data: providers, error: providerError } = await client
      .from("providers")
      .select("id, slug")
      .in("slug", [...PROVIDERS]);
    if (providerError) throw providerError;
    await Promise.all(
      ((providers ?? []) as ProviderRow[]).map(async ({ id, slug }) => {
        const { error } = await client
          .from("bundle_items")
          .update({
            hold_token_ciphertext: null,
            status: statuses[slug],
            updated_at: new Date().toISOString(),
          })
          .eq("bundle_session_id", bundleSessionId)
          .eq("provider_id", id);
        if (error) throw error;
      }),
    );
    const { data: session, error: sessionError } = await client
      .from("bundle_sessions")
      .update({
        hold_expires_at: null,
        phase,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bundleSessionId)
      .eq("browser_session_id", browserSessionId)
      .select("id")
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new Error("owned bundle session was not found");
  },
});

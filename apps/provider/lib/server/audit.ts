import "server-only";

import {
  buildAuditRow,
  type AuditEvent,
  type AuditRow,
} from "@serendipity/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditStorage = {
  insertAuditRow(row: AuditRow): Promise<void>;
};

export const writeProviderAudit = async (
  storage: AuditStorage,
  event: AuditEvent,
): Promise<void> => {
  await storage.insertAuditRow(buildAuditRow(event));
};

export const createProviderAuditStorage = (
  client: SupabaseClient,
): AuditStorage => ({
  async insertAuditRow(row) {
    const { error } = await client.from("audit_events").insert(row);
    if (error) throw error;
  },
});

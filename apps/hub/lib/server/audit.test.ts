import { describe, expect, it, vi } from "vitest";

import { writeHubAudit } from "./audit";

describe("Hub audit writer", () => {
  it("projects errors and workflow facts without secret fields", async () => {
    const insertAuditRow = vi.fn<(row: unknown) => Promise<void>>();
    insertAuditRow.mockResolvedValue(undefined);
    await writeHubAudit(
      { insertAuditRow },
      {
        bundleSessionId: "50000000-0000-4000-8000-000000000001",
        correlationId: "60000000-0000-4000-8000-000000000002",
        durationMs: 125,
        errorCode: "PROVIDER_TIMEOUT",
        facts: { candidateCount: 0, serviceRoleKey: "private" },
        operation: "discover",
        origin: "hub-server",
        status: "ERROR",
      },
    );
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        error_code: "PROVIDER_TIMEOUT",
        safe_payload: { candidateCount: 0 },
      }),
    );
    expect(JSON.stringify(insertAuditRow.mock.calls[0]?.[0])).not.toContain(
      "private",
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import { writeProviderAudit } from "./audit";

describe("Provider audit writer", () => {
  it("writes only sanitized, bounded facts", async () => {
    const insertAuditRow = vi.fn<(row: unknown) => Promise<void>>();
    insertAuditRow.mockResolvedValue(undefined);
    await writeProviderAudit(
      { insertAuditRow },
      {
        correlationId: "60000000-0000-4000-8000-000000000001",
        facts: { holdToken: "private", slotCount: 3 },
        operation: "hold_slot",
        origin: "https://provider.test",
        providerId: "00000000-0000-4000-8000-000000000001",
        status: "SUCCESS",
      },
    );
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ safe_payload: { slotCount: 3 } }),
    );
    expect(JSON.stringify(insertAuditRow.mock.calls[0]?.[0])).not.toContain(
      "private",
    );
  });
});

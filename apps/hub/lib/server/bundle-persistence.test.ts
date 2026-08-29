import { describe, expect, it, vi } from "vitest";

import { createBundleTokenRepository } from "./bundle-persistence";

const key = Buffer.alloc(32, 3).toString("base64url");

describe("bundle token persistence", () => {
  it("encrypts before storage and clears every terminal token", async () => {
    const saveEncryptedHold = vi.fn<(record: unknown) => Promise<void>>();
    saveEncryptedHold.mockResolvedValue(undefined);
    const clearEncryptedHolds =
      vi.fn<(bundleSessionId: string) => Promise<void>>();
    clearEncryptedHolds.mockResolvedValue(undefined);
    const repository = createBundleTokenRepository(
      { clearEncryptedHolds, saveEncryptedHold },
      key,
    );

    await repository.persistActiveHold({
      bundleSessionId: "50000000-0000-4000-8000-000000000001",
      holdId: "40000000-0000-4000-8000-000000000001",
      provider: "loop",
      providerId: "00000000-0000-4000-8000-000000000003",
      publicReference: "safe-1",
      rawToken: "private-token",
      slotId: "10000000-0000-4000-8000-000000000007",
    });
    expect(saveEncryptedHold).toHaveBeenCalledOnce();
    expect(JSON.stringify(saveEncryptedHold.mock.calls[0]?.[0])).not.toContain(
      "private-token",
    );

    await repository.clearTerminalTokens(
      "50000000-0000-4000-8000-000000000001",
    );
    expect(clearEncryptedHolds).toHaveBeenCalledWith(
      "50000000-0000-4000-8000-000000000001",
    );
  });
});

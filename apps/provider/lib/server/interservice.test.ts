import { describe, expect, it } from "vitest";

import { createInterserviceHeaders } from "../../../hub/lib/server/interservice";
import { verifyHubInterserviceRequest } from "./interservice";

describe("Hub to Provider interservice compatibility", () => {
  it("verifies the exact canonical request emitted by the Hub gateway", () => {
    const secret = "shared-interservice-secret-with-at-least-thirty-two-bytes";
    const timestamp = 1_900_000_000;
    const headers = createInterserviceHeaders(
      {
        method: "POST",
        nonce: "cross-app-nonce",
        path: "/api/slots",
        provider: "kiln",
        timestamp,
      },
      secret,
    );
    const request = new Request("https://kiln.test/api/slots", {
      headers,
      method: "POST",
    });

    expect(
      verifyHubInterserviceRequest(request, {
        maxClockSkewSeconds: 60,
        now: timestamp,
        provider: "kiln",
        secret,
      }),
    ).toBe(true);
  });
});

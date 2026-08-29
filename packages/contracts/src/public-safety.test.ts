import { describe, expect, it } from "vitest";

import { assertPublicPayloadSafe } from "./public-safety";

describe("public payload safety", () => {
  it.each([
    "apiKey",
    "api_key",
    "accessKey",
    "accessToken",
    "access-key",
    "privateKey",
    "authToken",
    "authorization",
    "clientSecret",
    "credential",
    "sessionToken",
    "cookie",
    "refreshToken",
    "rawHtml",
    "html",
    "script",
  ])("rejects the exact unsafe key %s", (key) => {
    expect(
      assertPublicPayloadSafe({ safe: { [key]: "must-not-cross" } }),
    ).toEqual({ ok: false, path: `/safe/${key}` });
  });

  it("does not reject descriptive keys that merely contain sensitive words", () => {
    expect(
      assertPublicPayloadSafe({
        apiKeyExplanation: "No API key is stored.",
        descriptionHtmlEscaped: "&lt;strong&gt;safe&lt;/strong&gt;",
        officialAccessKeynote: "Use the official entrance.",
        scriptDirection: "left-to-right",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects raw markup even when it hides under an ordinary key", () => {
    expect(
      assertPublicPayloadSafe({ description: "<script>unsafe()</script>" }),
    ).toEqual({ ok: false, path: "/description" });
  });

  it("fails closed on cyclic values instead of recursing indefinitely", () => {
    const cyclic: Record<string, unknown> = { publicValue: true };
    cyclic.self = cyclic;
    expect(assertPublicPayloadSafe(cyclic)).toEqual({
      ok: false,
      path: "/self",
    });
  });

  it("allows the same object in separate non-cyclic branches", () => {
    const shared = { publisher: "Shibuya City" };
    expect(assertPublicPayloadSafe({ first: shared, second: shared })).toEqual({
      ok: true,
    });
  });
});

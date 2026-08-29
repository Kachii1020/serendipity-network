import { describe, expect, it } from "vitest";

import {
  parseExactOrigin,
  parseExactOrigins,
  resolveProviderConfig,
} from "./index";

describe("provider configuration", () => {
  it("keeps identity and tool prefixes provider-scoped", () => {
    expect(resolveProviderConfig("kiln").toolPrefix).toBe("kiln");
    expect(resolveProviderConfig("nori").toolPrefix).toBe("nori");
    expect(resolveProviderConfig("loop").toolPrefix).toBe("loop");
  });

  it("keeps the three approved Provider identities distinct", () => {
    expect(
      ["kiln", "nori", "loop"].map((slug) => {
        const config = resolveProviderConfig(slug);
        return [config.displayName, config.accent, config.category];
      }),
    ).toEqual([
      ["Kiln Studio", "#55DB9C", "Creative workshop"],
      ["Nori Counter", "#FFD731", "Seasonal food counter"],
      ["Loop Room", "#FB8050", "Listening room"],
    ]);
  });

  it("accepts HTTPS and trustworthy local origins", () => {
    expect(parseExactOrigin("https://hub.example.test")).toBe(
      "https://hub.example.test",
    );
    expect(parseExactOrigin("http://localhost:3100")).toBe(
      "http://localhost:3100",
    );
  });

  it.each([
    "https://*.example.test",
    "http://example.test",
    "https://example.test/path",
    "https://example.test?q=1",
  ])("rejects non-exact or insecure origin %s", (value) => {
    expect(() => parseExactOrigin(value)).toThrow();
  });

  it("rejects duplicate origins", () => {
    expect(() =>
      parseExactOrigins("https://hub.example.test,https://hub.example.test"),
    ).toThrow("Duplicate");
  });
});

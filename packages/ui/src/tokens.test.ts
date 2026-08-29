import { describe, expect, it } from "vitest";

import {
  designTokens,
  getContrastRatio,
  providerIdentityTokens,
} from "./tokens";

describe("Sticker Network design tokens", () => {
  it("keeps approved foreground pairs at WCAG AA contrast", () => {
    expect(
      getContrastRatio(designTokens.ink, designTokens.canvas),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      getContrastRatio(designTokens.actionInk, designTokens.action),
    ).toBeGreaterThanOrEqual(4.5);
    for (const identity of Object.values(providerIdentityTokens)) {
      expect(getContrastRatio(identity.foreground, identity.background)).toBe(
        identity.contrast,
      );
      expect(identity.contrast).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps Provider identity separate from semantic status", () => {
    expect(Object.keys(providerIdentityTokens)).toEqual([
      "kiln",
      "nori",
      "loop",
    ]);
    expect(Object.keys(designTokens.status)).toEqual([
      "neutral",
      "working",
      "success",
      "warning",
      "danger",
      "unknown",
    ]);
  });

  it("pins the approved large control geometry", () => {
    expect(designTokens.controlMinHeight).toBe(52);
    expect(designTokens.primaryMinHeight).toBeGreaterThanOrEqual(56);
    expect(designTokens.focusRingWidth).toBe(3);
  });
});

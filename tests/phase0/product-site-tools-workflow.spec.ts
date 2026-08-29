import AxeBuilder from "@axe-core/playwright";
import { composeBundles } from "@serendipity/bundle-engine";
import type {
  BundleSummary,
  ConfirmBundleData,
  FindOptionsData,
  HoldBundleData,
  ReleaseBundleData,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { expect, test, type Page } from "@playwright/test";

type ProductPageTool = { name: string };
type ProductPageContext = {
  executeTool(tool: ProductPageTool, input: string): Promise<null | string>;
  getTools(): Promise<readonly ProductPageTool[]>;
};

const privateResponseCanary = "private-response-secret-must-not-project";
const completedAtByStep = {
  confirm: "2030-05-17T09:00:15.000Z",
  find: "2030-05-17T09:00:00.000Z",
  hold: "2030-05-17T09:00:05.000Z",
  release: "2030-05-17T09:00:10.000Z",
} as const;

const envelope = (data: unknown, suffix: string) => ({
  data,
  meta: {
    completedAt:
      completedAtByStep[suffix as keyof typeof completedAtByStep] ??
      "2030-05-17T09:00:00.000Z",
    correlationId: `product-${suffix}-correlation`,
    origin: "http://localhost:3100",
  },
  ok: true,
  schemaVersion: "1",
});

const failureEnvelope = (
  code: "ALREADY_CONFIRMED" | "COMPENSATION_INCOMPLETE",
  retryable: boolean,
) => ({
  error: {
    code,
    message:
      code === "ALREADY_CONFIRMED"
        ? "A confirmed Provider item cannot be released as a hold."
        : "One or more Provider releases need attention.",
    retryable,
  },
  meta: {
    completedAt: completedAtByStep.release,
    correlationId: `product-${code.toLowerCase()}-correlation`,
    origin: "http://localhost:3100",
  },
  ok: false,
  schemaVersion: "1",
});

const execute = async (
  page: Page,
  name: string,
  input: Readonly<Record<string, unknown>>,
) =>
  page.evaluate(
    async ({ input, name }) => {
      const context = (
        document as Document & { readonly modelContext?: ProductPageContext }
      ).modelContext;
      if (!context) throw new Error("WebMCP unavailable");
      const tool = (await context.getTools()).find(
        (candidate) => candidate.name === name,
      );
      if (!tool) throw new Error(`missing product tool: ${name}`);
      return context.executeTool(tool, JSON.stringify(input));
    },
    { input, name },
  );

let bundle: BundleSummary;

const expectNoMaterialAxeViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
};

test.beforeAll(async () => {
  const result = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!result.ok || !result.candidates[0]) {
    throw new Error("canonical product bundle was not composed");
  }
  bundle = result.candidates[0];
});

const prepareSearch = async (page: Page) => {
  const data: FindOptionsData = {
    alternatives: [],
    bundleSessionId: "site-tool-workflow-session",
    bundleVersion: bundle.bundleVersion,
    providerStatuses: { kiln: "ONLINE", loop: "ONLINE", nori: "ONLINE" },
    selectedBundle: bundle,
  };
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "x-serendipity-debug-secret": privateResponseCanary },
      json: envelope(data, "find"),
    }),
  );
  await page.goto("/plan");
  await expect(page.locator(".network-pill")).toContainText("WebMCP");
  await execute(page, "find_serendipity_options", canonicalIntent);
  await expect(
    page.getByRole("heading", { name: "Tonight got interesting." }),
  ).toBeVisible();
  return data;
};

const prepareHold = async (page: Page, search: FindOptionsData) => {
  const data: HoldBundleData = {
    bundleHoldId: "site-tool-workflow-hold",
    bundleId: bundle.bundleId,
    expiresAt: "2030-05-17T09:01:30.000Z",
    providerHolds: (["kiln", "nori", "loop"] as const).map((provider) => ({
      holdSafeReference: `site-tool-${provider}-hold`,
      provider,
      status: "HELD" as const,
    })),
    status: "HELD",
  };
  await page.route("**/api/manual/hold", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "x-serendipity-debug-secret": privateResponseCanary },
      json: envelope(data, "hold"),
    }),
  );
  await execute(page, "hold_bundle", {
    bundleId: bundle.bundleId,
    bundleSessionId: search.bundleSessionId,
    bundleVersion: bundle.bundleVersion,
    schemaVersion: "1",
  });
  await expect(
    page.getByRole("heading", { name: "Your night is held." }),
  ).toBeVisible();
  return data;
};

const expectActivityTimeline = async (
  page: Page,
  steps: ReadonlyArray<keyof typeof completedAtByStep>,
) => {
  const disclosure = page.locator(".webmcp-proof");
  if ((await disclosure.getAttribute("open")) === null) {
    await disclosure.locator("summary").click();
  }

  const rows = page.locator(".activity-list li");
  await expect(rows).toHaveCount(steps.length);

  const completedTimes: number[] = [];
  for (const [index, step] of steps.entries()) {
    const row = rows.nth(index);
    const displayName =
      step === "find"
        ? "Find serendipity options"
        : `${step[0]?.toUpperCase()}${step.slice(1)} bundle`;

    await expect(row.locator("strong")).toHaveText(displayName);
    await expect(row.locator("p").first()).toHaveText(
      /^Site tool · Complete · \d+ ms$/,
    );
    await expect(row.locator("p").nth(1)).toHaveText(
      `http://localhost:3100 · correlation product-${step}-correlation`,
    );
    await expect(row.locator("time")).toHaveAttribute(
      "datetime",
      completedAtByStep[step],
    );

    const summary = (await row.locator("p").first().innerText()).trim();
    const duration = Number(summary.match(/(\d+) ms$/)?.[1]);
    expect(duration).toBeGreaterThanOrEqual(0);
    completedTimes.push(Date.parse(completedAtByStep[step]));
  }

  expect(completedTimes).toEqual([...completedTimes].sort((a, b) => a - b));
  expect(new Set(completedTimes).size).toBe(completedTimes.length);

  const projectedText = await rows.allInnerTexts();
  expect(projectedText.join("\n")).not.toMatch(
    new RegExp(
      [
        privateResponseCanary,
        "site-tool-workflow-hold",
        "site-tool-(?:kiln|nori|loop)-(?:hold|reservation)",
        "holdToken",
        "accessToken",
        "authorization",
        "serviceRoleKey",
      ].join("|"),
      "i",
    ),
  );
};

test("STL-005/HO-016 find, hold, and confirm project a sanitized chronological activity receipt", async ({
  page,
}) => {
  const search = await prepareSearch(page);
  const hold = await prepareHold(page, search);
  await expectNoMaterialAxeViolations(page);
  const data: ConfirmBundleData = {
    bundleId: bundle.bundleId,
    confirmedAt: "2030-05-17T09:00:15.000Z",
    reservations: (["kiln", "nori", "loop"] as const).map((provider) => ({
      provider,
      reservationRef: `site-tool-${provider}-reservation`,
    })),
    status: "CONFIRMED",
    totalPriceYen: bundle.totalPriceYen,
  };
  await page.route("**/api/manual/confirm", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "x-serendipity-debug-secret": privateResponseCanary },
      json: envelope(data, "confirm"),
    }),
  );

  await execute(page, "confirm_bundle", {
    bundleHoldId: hold.bundleHoldId,
    bundleSessionId: search.bundleSessionId,
    schemaVersion: "1",
  });

  await expect(
    page.getByRole("heading", { name: "Your night is confirmed." }),
  ).toBeVisible();
  await expect(page.locator(".receipt")).toBeFocused();
  await expectNoMaterialAxeViolations(page);
  await expectActivityTimeline(page, ["find", "hold", "confirm"]);
});

test("STL-004/005/HO-016 release requires an active hold and projects the terminal activity", async ({
  page,
}) => {
  const search = await prepareSearch(page);
  const missing = JSON.parse(
    (await execute(page, "release_bundle", {
      bundleHoldId: "missing-hold",
      bundleSessionId: search.bundleSessionId,
      reason: "USER_CANCELLED",
      schemaVersion: "1",
    })) ?? "null",
  ) as { error?: { code?: string }; ok?: boolean };
  expect(missing).toMatchObject({
    error: { code: "BUNDLE_NOT_FOUND" },
    ok: false,
  });

  const hold = await prepareHold(page, search);
  const data: ReleaseBundleData = {
    bundleId: bundle.bundleId,
    providerStatuses: (["kiln", "nori", "loop"] as const).map((provider) => ({
      provider,
      status: "RELEASED" as const,
    })),
    status: "RELEASED",
  };
  await page.route("**/api/manual/release", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "x-serendipity-debug-secret": privateResponseCanary },
      json: envelope(data, "release"),
    }),
  );
  await execute(page, "release_bundle", {
    bundleHoldId: hold.bundleHoldId,
    bundleSessionId: search.bundleSessionId,
    reason: "USER_CANCELLED",
    schemaVersion: "1",
  });

  await expect(
    page.locator(
      '.provider-sticker[data-provider="kiln"][data-operation="Released"]',
    ),
  ).toBeVisible();
  await expect(page.locator(".receipt")).toHaveCount(0);
  await expectActivityTimeline(page, ["find", "hold", "release"]);
});

test("UI-035 release locks Confirm and duplicate mutations until one terminal result", async ({
  page,
}) => {
  const search = await prepareSearch(page);
  const hold = await prepareHold(page, search);
  let releaseRequests = 0;
  let confirmRequests = 0;
  let finishRelease: (() => void) | undefined;
  const releaseGate = new Promise<void>((resolve) => {
    finishRelease = resolve;
  });
  const data: ReleaseBundleData = {
    bundleId: bundle.bundleId,
    providerStatuses: (["kiln", "nori", "loop"] as const).map((provider) => ({
      provider,
      status: "RELEASED" as const,
    })),
    status: "RELEASED",
  };
  await page.route("**/api/manual/release", async (route) => {
    releaseRequests += 1;
    await releaseGate;
    await route.fulfill({
      contentType: "application/json",
      json: envelope(data, "release"),
    });
  });
  await page.route("**/api/manual/confirm", (route) => {
    confirmRequests += 1;
    return route.abort();
  });

  const firstRelease = execute(page, "release_bundle", {
    bundleHoldId: hold.bundleHoldId,
    bundleSessionId: search.bundleSessionId,
    reason: "USER_CANCELLED",
    schemaVersion: "1",
  });
  await expect(
    page.getByRole("heading", { name: "Releasing your hold…" }),
  ).toBeVisible();
  await expect(page.locator(".release-heading")).toBeFocused();
  await expectNoMaterialAxeViolations(page);
  await expect(
    page.getByRole("button", { name: "Confirm demo reservation" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Release hold" })).toHaveCount(
    0,
  );
  expect(releaseRequests).toBe(1);

  const duplicateRelease = JSON.parse(
    (await execute(page, "release_bundle", {
      bundleHoldId: hold.bundleHoldId,
      bundleSessionId: search.bundleSessionId,
      reason: "USER_CANCELLED",
      schemaVersion: "1",
    })) ?? "null",
  ) as { error?: { code?: string }; ok?: boolean };
  const blockedConfirm = JSON.parse(
    (await execute(page, "confirm_bundle", {
      bundleHoldId: hold.bundleHoldId,
      bundleSessionId: search.bundleSessionId,
      schemaVersion: "1",
    })) ?? "null",
  ) as { error?: { code?: string }; ok?: boolean };
  expect(duplicateRelease.ok).toBe(false);
  expect(blockedConfirm.ok).toBe(false);
  expect(releaseRequests).toBe(1);
  expect(confirmRequests).toBe(0);

  finishRelease?.();
  expect(JSON.parse((await firstRelease) ?? "null")).toMatchObject({
    ok: true,
  });
  await expect(
    page.locator(
      '.provider-sticker[data-provider="kiln"][data-operation="Released"]',
    ),
  ).toBeVisible();
});

test("UI-035 non-retryable release failure checks authoritative status and projects a receipt", async ({
  page,
}) => {
  const search = await prepareSearch(page);
  const hold = await prepareHold(page, search);
  await page.route("**/api/manual/release", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: failureEnvelope("ALREADY_CONFIRMED", false),
    }),
  );

  await execute(page, "release_bundle", {
    bundleHoldId: hold.bundleHoldId,
    bundleSessionId: search.bundleSessionId,
    reason: "USER_CANCELLED",
    schemaVersion: "1",
  });
  await expect(
    page.getByRole("button", { name: "Check latest Provider status" }),
  ).toBeVisible();

  await page.route("**/api/bundle-sessions/*", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: envelope(
        {
          bundle,
          bundleHoldId: hold.bundleHoldId,
          bundleSessionId: search.bundleSessionId,
          expiresAt: null,
          ok: true,
          phase: "confirmed",
          providerStates: (["kiln", "nori", "loop"] as const).map(
            (provider) => ({
              holdSafeReference: `site-tool-${provider}-hold`,
              provider,
              reservationRef: `site-tool-${provider}-reservation`,
              status: "CONFIRMED" as const,
            }),
          ),
          requiresFreshSearch: false,
        },
        "confirm",
      ),
    }),
  );
  await page
    .getByRole("button", { name: "Check latest Provider status" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Your night is confirmed." }),
  ).toBeVisible();
  await expect(page.locator(".receipt")).toBeFocused();
});

test("UI-035 retryable release failure reuses the same safe hold and reaches Released", async ({
  page,
}) => {
  const search = await prepareSearch(page);
  const hold = await prepareHold(page, search);
  let releaseRequests = 0;
  const released: ReleaseBundleData = {
    bundleId: bundle.bundleId,
    providerStatuses: (["kiln", "nori", "loop"] as const).map((provider) => ({
      provider,
      status: "RELEASED" as const,
    })),
    status: "RELEASED",
  };
  await page.route("**/api/manual/release", (route) => {
    releaseRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      json:
        releaseRequests === 1
          ? failureEnvelope("COMPENSATION_INCOMPLETE", false)
          : envelope(released, "release"),
    });
  });

  await execute(page, "release_bundle", {
    bundleHoldId: hold.bundleHoldId,
    bundleSessionId: search.bundleSessionId,
    reason: "USER_CANCELLED",
    schemaVersion: "1",
  });
  await page.getByRole("button", { name: "Retry release safely" }).click();

  await expect(
    page.locator(
      '.provider-sticker[data-provider="kiln"][data-operation="Released"]',
    ),
  ).toBeVisible();
  expect(releaseRequests).toBe(2);
});

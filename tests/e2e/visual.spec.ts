import { composeBundles } from "@serendipity/bundle-engine";
import type {
  BundleSummary,
  ConfirmBundleData,
  FindOptionsData,
  HoldBundleData,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { expect, test, type Page } from "@playwright/test";

const fixedTime = new Date("2030-05-17T09:00:00Z");
const v3FixedTime = new Date("2026-08-31T00:00:00Z");
let bundle: BundleSummary;

test.beforeAll(async () => {
  const result = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!result.ok || !result.candidates[0]) {
    throw new Error("visual fixture bundle could not be composed");
  }
  bundle = result.candidates[0];
});

const envelope = (data: unknown) => ({
  data,
  meta: {
    completedAt: fixedTime.toISOString(),
    correlationId: "visual-correlation",
    origin: "http://localhost:3100",
  },
  ok: true,
  schemaVersion: "1",
});

async function stabilize(page: Page) {
  await page.clock.install({ time: fixedTime });
  await page.goto("/legacy/network-demo");
  await expect(page.locator(".provider-sticker")).toHaveCount(3);
  await expect(page.locator(".network-pill")).toContainText("WebMCP");
  await expect(
    page.locator(".provider-sticker[aria-label*='Connecting']"),
  ).toHaveCount(3);
  await page.addStyleTag({
    content:
      "nextjs-portal,[data-next-badge-root]{display:none!important}*{caret-color:transparent!important}",
  });
}

async function stabilizeV3(page: Page, path = "/v3") {
  await page.clock.install({ time: v3FixedTime });
  await page.goto(path);
  await page.addStyleTag({
    content:
      "nextjs-portal,[data-next-badge-root]{display:none!important}*{caret-color:transparent!important}",
  });
  await page.evaluate(() => document.fonts.ready);
}

const v3PlanPath =
  "/v3/plan?auto=1&area=ikebukuro&party=3&budget=4000&date=2026-08-31&start=17%3A30&end=22%3A30&interest=CALM_QUIET&meal=1&walk=20";

for (const viewport of [
  { height: 900, name: "desktop", width: 1440 },
  { height: 1000, name: "zoom-200", width: 800 },
  { height: 844, name: "mobile", width: 390 },
]) {
  test(`V3-VIS-006 v3 landing ${viewport.name} baseline`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stabilizeV3(page);
    await expect(
      page.getByRole("heading", { name: "A whole Tokyo night." }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot(`v3-landing-${viewport.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });

  test(`V3-VIS-007 v3 result ${viewport.name} baseline`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stabilizeV3(page, v3PlanPath);
    await expect(
      page.getByRole("heading", { name: "Your Ikebukuro night" }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot(`v3-result-${viewport.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
}

for (const viewport of [
  { height: 900, name: "desktop", width: 1440 },
  { height: 1000, name: "zoom-200", width: 800 },
  { height: 844, name: "mobile", width: 390 },
]) {
  test(`V3-VIS-008 v3 progress ${viewport.name} baseline`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/v3/plans/search", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.continue();
    });
    await stabilizeV3(page, "/v3/plan");
    await page.locator(".v3-adjust summary").first().click();
    await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
    await page.waitForTimeout(1_800);
    await expect(page.locator(".v3-progress")).toContainText(
      "Preparing your best plan",
    );
    await expect(page).toHaveScreenshot(`v3-progress-${viewport.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
}

async function mockComposed(page: Page) {
  const data: FindOptionsData = {
    alternatives: [],
    bundleSessionId: "visual-bundle-session",
    bundleVersion: 1,
    providerStatuses: { kiln: "ONLINE", nori: "ONLINE", loop: "ONLINE" },
    selectedBundle: bundle,
  };
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({ contentType: "application/json", json: envelope(data) }),
  );
  await page.getByRole("button", { name: /Plan my night/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tonight got interesting." }),
  ).toBeVisible();
}

for (const viewport of [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "mobile", width: 390 },
]) {
  test(`UI-039 commercial landing ${viewport.name} baseline`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/legacy/network-demo/home");
    await page.addStyleTag({
      content:
        "nextjs-portal,[data-next-badge-root]{display:none!important}*{caret-color:transparent!important}",
    });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Three places. One unexpectedly good night.",
      }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot(`landing-${viewport.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
}

for (const viewport of [
  { height: 900, name: "desktop", width: 1440 },
  { height: 768, name: "tablet", width: 1024 },
  { height: 844, name: "mobile", width: 390 },
]) {
  test(`UI-016/021 idle ${viewport.name} baseline`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stabilize(page);
    await expect(page).toHaveScreenshot(`hub-idle-${viewport.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
}

test("IMP-003 expanded time and budget controls stay lightweight on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await stabilize(page);
  await page.locator(".constraint-adjuster summary").click();
  await page.getByRole("radio", { name: "18:30" }).check();
  await page.getByRole("radio", { name: "¥6,000" }).check();
  await expect(page.locator(".journey-primary")).toHaveCount(1);
  await expect(page).toHaveScreenshot("hub-constraints-mobile.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("UI-016 composed route baseline", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await stabilize(page);
  await mockComposed(page);
  await expect(page).toHaveScreenshot("hub-composed-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("UI-016/025 held mobile baseline", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await stabilize(page);
  await mockComposed(page);
  const data: HoldBundleData = {
    bundleHoldId: "visual-bundle-hold",
    bundleId: bundle.bundleId,
    expiresAt: "2030-05-17T09:01:30Z",
    providerHolds: (["kiln", "nori", "loop"] as const).map((provider) => ({
      holdSafeReference: `visual-${provider}-hold-reference`,
      provider,
      status: "HELD" as const,
    })),
    status: "HELD",
  };
  await page.route("**/api/manual/hold", (route) =>
    route.fulfill({ contentType: "application/json", json: envelope(data) }),
  );
  await page.getByRole("button", { name: "Hold for 90 seconds" }).click();
  await expect(
    page.getByRole("heading", { name: "Your night is held." }),
  ).toBeVisible();
  await expect(page.locator(".held-heading")).toBeFocused();
  await expect(page).toHaveScreenshot("hub-held-mobile.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("UI-033 focused result remains legible at 320x568", async ({ page }) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await stabilize(page);
  await mockComposed(page);
  await expect(page.locator(".journey-summary")).toBeFocused();
  await expect(page).toHaveScreenshot("hub-result-320.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("UI-034 reset returns the 320px viewport to the invitation", async ({
  page,
}) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await stabilize(page);
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        error: {
          code: "NO_VALID_BUNDLE",
          message: "No complete route fits those constraints.",
          retryable: true,
        },
        meta: {
          completedAt: fixedTime.toISOString(),
          correlationId: "visual-no-result",
          origin: "http://localhost:3100",
        },
        ok: false,
        schemaVersion: "1",
      },
    }),
  );
  await page.getByRole("button", { name: /Plan my night/ }).click();
  await page.getByRole("button", { name: "Adjust search" }).click();
  await expect(
    page.getByRole("heading", { name: "What kind of tonight?" }),
  ).toBeFocused();
  await expect(page).toHaveScreenshot("hub-reset-320.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("UI-005 confirmed receipt stays safe", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await stabilize(page);
  await mockComposed(page);
  const hold: HoldBundleData = {
    bundleHoldId: "visual-confirm-hold",
    bundleId: bundle.bundleId,
    expiresAt: "2030-05-17T09:01:30Z",
    providerHolds: (["kiln", "nori", "loop"] as const).map((provider) => ({
      holdSafeReference: `visual-${provider}-hold-reference`,
      provider,
      status: "HELD" as const,
    })),
    status: "HELD",
  };
  await page.route("**/api/manual/hold", (route) =>
    route.fulfill({ contentType: "application/json", json: envelope(hold) }),
  );
  await page.getByRole("button", { name: "Hold for 90 seconds" }).click();
  const receipt: ConfirmBundleData = {
    bundleId: bundle.bundleId,
    confirmedAt: "2030-05-17T09:00:15Z",
    reservations: (["kiln", "nori", "loop"] as const).map((provider) => ({
      provider,
      reservationRef: `visual-${provider}-reservation`,
    })),
    status: "CONFIRMED",
    totalPriceYen: bundle.totalPriceYen,
  };
  await page.route("**/api/manual/confirm", (route) =>
    route.fulfill({ contentType: "application/json", json: envelope(receipt) }),
  );
  await page.getByRole("button", { name: "Confirm demo reservation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirm this complete demo route?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm demo route" }).click();
  await expect(page.locator(".receipt")).toBeFocused();
  await expect(page).toHaveScreenshot("hub-confirmed-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("UI-023/027 observer can identify the network and open proof in one action", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const startedAt = Date.now();
  await stabilize(page);
  for (const name of ["Kiln", "Nori", "Loop"]) {
    await expect(
      page.getByRole("article", { name: new RegExp(name) }),
    ).toBeVisible();
  }
  await page.getByText("See WebMCP in action").click();
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    3,
  );
  await expect(page.locator("main")).toHaveAttribute(
    "data-bound-provider-count",
    "3",
  );
  await expect(
    page.locator(".provider-sticker[aria-label*='Live site']"),
  ).toHaveCount(3);
  await expect(page.getByText("exact origins")).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(10_000);
  await expect(page).toHaveScreenshot("hub-proof-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

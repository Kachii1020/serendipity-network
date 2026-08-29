import AxeBuilder from "@axe-core/playwright";
import { composeBundles } from "@serendipity/bundle-engine";
import type {
  BundleSummary,
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

const productTools = [
  "find_serendipity_options",
  "show_bundle",
  "hold_bundle",
  "confirm_bundle",
  "release_bundle",
] as const;

const providerOrigins = new Set(
  (
    process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
    "http://localhost:3101,http://localhost:3102,http://localhost:3103"
  )
    .split(",")
    .map((origin) => new URL(origin).origin),
);

type PageToolContext = {
  getTools(): Promise<readonly { name: string }[]>;
};

let canonicalBundle: BundleSummary;

test.beforeAll(async () => {
  const result = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!result.ok || !result.candidates[0]) {
    throw new Error("commercial release fixture could not be composed");
  }
  canonicalBundle = result.candidates[0];
});

const envelope = (data: unknown, correlationId: string) => ({
  data,
  meta: {
    completedAt: "2030-05-17T09:00:00.000Z",
    correlationId,
    origin: "http://localhost:3100",
  },
  ok: true,
  schemaVersion: "1",
});

const availableTools = (page: Page) =>
  page.evaluate(async () => {
    const context = (
      document as Document & { readonly modelContext?: PageToolContext }
    ).modelContext;
    if (!context) return [];
    return (await context.getTools()).map(({ name }) => name).sort();
  });

test("UI-039/043 landing is consumer-first, static, and one action from the planner", async ({
  page,
}) => {
  const productRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || providerOrigins.has(url.origin)) {
      productRequests.push(request.url());
    }
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Three places. One unexpectedly good night.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Plan a Shibuya night/ }),
  ).toHaveCount(1);
  await expect(page.getByText("Demo only", { exact: true })).toBeVisible();
  await expect(page.getByText("No payment", { exact: true })).toBeVisible();
  expect(productRequests).toEqual([]);
  expect(await availableTools(page)).toEqual([]);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await page.getByRole("link", { name: /Plan a Shibuya night/ }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(
    page.getByRole("heading", { name: "What kind of tonight?" }),
  ).toBeVisible();
});

test("UI-044 tool lifecycle is exactly 5 → 0 → 5 across planner navigation", async ({
  page,
}) => {
  await page.goto("/plan");
  await expect
    .poll(() => availableTools(page))
    .toEqual([...productTools].sort());
  await page.goto("/");
  await expect.poll(() => availableTools(page)).toEqual([]);
  await page.goto("/plan");
  await expect
    .poll(() => availableTools(page))
    .toEqual([...productTools].sort());
});

test("UI-045 safe deep links seed controls without work and strip poisoned keys", async ({
  page,
}) => {
  let workflowRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/manual/")) {
      workflowRequests += 1;
    }
  });
  await page.goto("/plan?mood=cozy&start=18:30&budget=6000");
  await expect(
    page.getByRole("button", { name: /Cozy.*Selected/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Adjust time & budget").click();
  await expect(page.getByRole("radio", { name: "18:30" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "¥6,000" })).toBeChecked();
  expect(workflowRequests).toBe(0);

  await page.goto("/plan?mood=cozy&holdToken=secret-value");
  await expect(page).toHaveURL(/\/plan\?mood=cozy$/);
  expect(page.url()).not.toContain("holdToken");
  expect(page.url()).not.toContain("secret-value");
});

test("UI-047 proof makes zero Provider requests until opened", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (providerOrigins.has(new URL(request.url()).origin)) {
      providerRequests.push(request.url());
    }
  });
  await page.goto("/plan");
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    0,
  );
  expect(providerRequests).toEqual([]);
  await page.getByText("See WebMCP in action").click();
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    3,
  );
  await expect.poll(() => providerRequests.length).toBe(3);
});

test("UI-042 launch metadata and public assets resolve without favicon 404", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const canonical = await page
    .locator("link[rel='canonical']")
    .getAttribute("href");
  expect(canonical).toBeTruthy();
  expect(new URL(canonical!).pathname).toBe("/");
  const iconHref = await page
    .locator("link[rel~='icon']")
    .first()
    .getAttribute("href");
  const ogHref = await page
    .locator("meta[property='og:image']")
    .getAttribute("content");
  for (const path of [
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    iconHref,
    ogHref,
  ]) {
    expect(path).toBeTruthy();
    const response = await request.get(path!);
    expect(response.ok(), `${path} should return 200`).toBe(true);
  }
});

test("UI-040/043 landing and planner survive 400% text enlargement", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  for (const path of ["/", "/plan"]) {
    await page.goto(path);
    await page.locator("html").evaluate((element) => {
      element.style.fontSize = "400%";
    });
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  }
});

test("UI-046 active-hold navigation releases safely before leaving", async ({
  page,
}) => {
  const search: FindOptionsData = {
    alternatives: [],
    bundleSessionId: "commercial-leave-session",
    bundleVersion: canonicalBundle.bundleVersion,
    providerStatuses: { kiln: "ONLINE", loop: "ONLINE", nori: "ONLINE" },
    selectedBundle: canonicalBundle,
  };
  const hold: HoldBundleData = {
    bundleHoldId: "commercial-leave-hold",
    bundleId: canonicalBundle.bundleId,
    expiresAt: "2030-05-17T09:01:30.000Z",
    providerHolds: (["kiln", "nori", "loop"] as const).map((provider) => ({
      holdSafeReference: `commercial-${provider}-hold`,
      provider,
      status: "HELD" as const,
    })),
    status: "HELD",
  };
  const released: ReleaseBundleData = {
    bundleId: canonicalBundle.bundleId,
    providerStatuses: (["kiln", "nori", "loop"] as const).map((provider) => ({
      provider,
      status: "RELEASED" as const,
    })),
    status: "RELEASED",
  };
  let releaseRequests = 0;
  let confirmRequests = 0;
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: envelope(search, "commercial-leave-search"),
    }),
  );
  await page.route("**/api/manual/hold", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: envelope(hold, "commercial-leave-hold-correlation"),
    }),
  );
  await page.route("**/api/manual/release", (route) => {
    releaseRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      json: envelope(released, "commercial-leave-release"),
    });
  });
  await page.route("**/api/manual/confirm", (route) => {
    confirmRequests += 1;
    return route.abort();
  });

  await page.goto("/plan");
  await page.getByRole("button", { name: "Plan my night" }).click();
  await page.getByRole("button", { name: "Hold for 90 seconds" }).click();
  await expect(
    page.getByRole("heading", { name: "Your night is held." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Leave planner" }).click();
  await expect(
    page.getByRole("dialog", { name: "Leave this held route?" }),
  ).toBeVisible();
  expect(releaseRequests).toBe(0);
  await page.getByRole("button", { name: "Release holds & leave" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(releaseRequests).toBe(1);
  expect(confirmRequests).toBe(0);
});

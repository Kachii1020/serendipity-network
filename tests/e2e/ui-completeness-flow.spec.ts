import AxeBuilder from "@axe-core/playwright";
import { composeBundles } from "@serendipity/bundle-engine";
import type { BundleSummary, FindOptionsData } from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { expect, test, type Page } from "@playwright/test";

const fixedTime = new Date("2030-05-17T09:00:00.000Z");
let candidates: BundleSummary[];

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
  if (!result.ok || result.candidates.length < 3) {
    throw new Error("UI completeness fixture requires three candidates");
  }
  candidates = result.candidates;
});

const successEnvelope = (data: unknown, suffix: string) => ({
  data,
  meta: {
    completedAt: fixedTime.toISOString(),
    correlationId: `ui-completeness-${suffix}`,
    origin: "http://localhost:3100",
  },
  ok: true,
  schemaVersion: "1",
});

const failureEnvelope = (
  code: "COMPENSATION_INCOMPLETE" | "NO_VALID_BUNDLE",
  retryable: boolean,
) => ({
  error: {
    code,
    message:
      code === "NO_VALID_BUNDLE"
        ? "No complete route fits those constraints."
        : "One or more temporary holds could not be verified released.",
    retryable,
  },
  meta: {
    completedAt: fixedTime.toISOString(),
    correlationId: `ui-completeness-${code.toLowerCase()}`,
    origin: "http://localhost:3100",
  },
  ok: false,
  schemaVersion: "1",
});

const routeSuccessfulSearch = async (page: Page) => {
  const selectedBundle = candidates[0]!;
  const data: FindOptionsData = {
    alternatives: candidates.slice(1),
    bundleSessionId: "ui-completeness-session",
    bundleVersion: selectedBundle.bundleVersion,
    providerStatuses: { kiln: "ONLINE", loop: "ONLINE", nori: "ONLINE" },
    selectedBundle,
  };
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: successEnvelope(data, "search"),
    }),
  );
  return data;
};

const plan = async (page: Page) => {
  await page.goto("/plan");
  await page
    .getByRole("button", { name: "Plan my night", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tonight got interesting." }),
  ).toBeVisible();
};

test("UI-033 focuses and reveals the result heading at 320x568", async ({
  page,
}) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await routeSuccessfulSearch(page);
  await plan(page);

  await expect(page.locator(".journey-summary")).toBeFocused();
  const geometry = await page
    .getByRole("heading", { name: "Tonight got interesting." })
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { bottom: box.bottom, top: box.top, viewport: innerHeight };
    });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeLessThan(geometry.viewport);
  expect(geometry.bottom).toBeGreaterThan(0);
  await expectNoMaterialAxeViolations(page);
});

test("UI-033 keeps the result heading visible at 200% text enlargement", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 640 });
  await routeSuccessfulSearch(page);
  await page.goto("/plan");
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });
  await page
    .getByRole("button", { name: "Plan my night", exact: true })
    .click();

  await expect(page.locator(".journey-summary")).toBeFocused();
  const geometry = await page
    .getByRole("heading", { name: "Tonight got interesting." })
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { bottom: box.bottom, top: box.top, viewport: innerHeight };
    });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeLessThan(geometry.viewport);
  expect(geometry.bottom).toBeGreaterThan(0);
});

test("UI-034 Adjust search returns focus and scroll to the invitation", async ({
  page,
}) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: failureEnvelope("NO_VALID_BUNDLE", true),
    }),
  );
  await page.goto("/plan");
  await page
    .getByRole("button", { name: "Plan my night", exact: true })
    .click();
  await expectNoMaterialAxeViolations(page);
  await page.getByRole("button", { name: "Adjust search" }).click();

  const heading = page.getByRole("heading", { name: "What kind of tonight?" });
  await expect(heading).toBeFocused();
  const geometry = await heading.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { bottom: box.bottom, top: box.top, viewport: innerHeight };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeLessThan(geometry.viewport);
});

test("UI-038 alternative selection restores focus to the stable Route summary", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await routeSuccessfulSearch(page);
  await plan(page);

  await page.getByText("Compare 2 alternatives", { exact: true }).click();
  await page.getByRole("button", { name: /^Route 2/ }).click();

  await expect(page.locator(".journey-summary")).toBeFocused();
  await expect(page.locator(".journey-summary .section-kicker")).toContainText(
    "Route 2",
  );
  await expect(page.getByRole("button", { name: /^Route 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Route 3/ })).toBeVisible();
});

test("UI-036 persists the 90-second compensation guard and unlocks without a request", async ({
  page,
}) => {
  await page.clock.install({ time: fixedTime });
  await routeSuccessfulSearch(page);
  let holdRequests = 0;
  await page.route("**/api/manual/hold", (route) => {
    holdRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      json: failureEnvelope("COMPENSATION_INCOMPLETE", false),
    });
  });
  await plan(page);
  await page.getByRole("button", { name: "Hold for 90 seconds" }).click();

  await expect(
    page.getByText("We could not verify every temporary release", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Wait before searching again" }),
  ).toBeDisabled();
  await expectNoMaterialAxeViolations(page);
  expect(holdRequests).toBe(1);

  const stored = await page.evaluate(() =>
    sessionStorage.getItem("serendipity-compensation-blocked-until-v1"),
  );
  expect(stored).toBe("2030-05-17T09:01:30.000Z");

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Wait before searching again" }),
  ).toBeDisabled();
  await page.clock.fastForward(90_000);
  await expect(
    page.getByRole("button", { name: "Start a fresh search" }),
  ).toBeEnabled();
  expect(holdRequests).toBe(1);
});

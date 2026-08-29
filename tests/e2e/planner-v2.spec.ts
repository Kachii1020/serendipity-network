import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type PageTool = { name: string };
type PageToolContext = {
  executeTool(tool: PageTool, input: string): Promise<null | string>;
  getTools(): Promise<readonly PageTool[]>;
};

const toolNames = [
  "find_evening_plan",
  "show_place_evidence",
  "swap_plan_stop",
  "save_plan",
  "delete_saved_plan",
] as const;

const tokyoDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).format(new Date());

const intent = () => ({
  area: "shibuya",
  endAt: `${tokyoDate()}T22:00:00+09:00`,
  excludedTags: ["alcohol", "smoking"],
  maxWalkMinutesPerLeg: 20,
  partySize: 1,
  preferredTags: ["art", "books", "quiet"],
  schemaVersion: "2",
  startAt: `${tokyoDate()}T17:00:00+09:00`,
  stopCount: "AUTO",
  totalBudgetYen: 5000,
});

const availableTools = (page: Page) =>
  page.evaluate(async () => {
    const context = (
      document as Document & { readonly modelContext?: PageToolContext }
    ).modelContext;
    if (!context) return [];
    return (await context.getTools()).map(({ name }) => name).sort();
  });

const execute = async (
  page: Page,
  name: string,
  input: Readonly<Record<string, unknown>>,
) => {
  const raw = await page.evaluate(
    async ({ input, name }) => {
      const context = (
        document as Document & { readonly modelContext?: PageToolContext }
      ).modelContext;
      if (!context) throw new Error("WebMCP unavailable");
      const tool = (await context.getTools()).find(
        (candidate) => candidate.name === name,
      );
      if (!tool) throw new Error(`Missing planner tool: ${name}`);
      return context.executeTool(tool, JSON.stringify(input));
    },
    { input, name },
  );
  return JSON.parse(raw ?? "null") as Record<string, unknown>;
};

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

test("PV2-UI-001 landing makes the product and output concrete", async ({
  page,
}) => {
  const productRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      productRequests.push(request.url());
    }
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A plan you can actually verify." }),
  ).toBeVisible();
  const primaryAction = page.getByRole("button", { name: /Build my evening/ });
  await expect(primaryAction).toBeVisible();
  const actionBox = await primaryAction.boundingBox();
  expect(actionBox).not.toBeNull();
  expect(
    (actionBox?.y ?? Infinity) + (actionBox?.height ?? 0),
  ).toBeLessThanOrEqual(844);
  await expect(
    page.getByText(/published hours, reference prices, walking estimates/),
  ).toBeVisible();
  await expect(page.getByText(/Source:/).first()).toBeVisible();
  await expect(page.getByText(/Kiln|Nori|Loop|Manual fallback/)).toHaveCount(0);
  expect(productRequests).toEqual([]);
  expect(await availableTools(page)).toEqual([]);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("PV2-UI-002 human path returns evidence and an idempotent local save", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Build my evening/ }).click();
  await expect(page).toHaveURL(/\/plan\?.*auto=1/);
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();
  const stops = page.locator(".v2-stop");
  expect(await stops.count()).toBeGreaterThanOrEqual(2);
  expect(await stops.count()).toBeLessThanOrEqual(3);
  await expect(stops.first().getByText(/Check official site/)).toBeVisible();
  await stops.first().locator(".v2-source-details summary").click();
  await expect(
    stops.first().getByText("Address", { exact: true }),
  ).toBeVisible();
  await expect(stops.first().getByText("Price", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save this plan" }).click();
  await expect(page.getByRole("button", { name: "Plan saved" })).toBeVisible();
  const storage = await page.evaluate(() =>
    localStorage.getItem("serendipity.saved-itineraries.v2"),
  );
  expect(storage).toContain('"schemaVersion":"2"');
  expect(storage).not.toMatch(/token|correlation|cookie|secret/i);
  await expectNoMaterialAxeViolations(page);
});

test("PV2-ST-001 exact five tools share find, evidence, swap, save, and delete state", async ({
  page,
}) => {
  await page.goto("/plan");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());

  const found = await execute(page, "find_evening_plan", intent());
  expect(found).toMatchObject({ ok: true, schemaVersion: "2" });
  expect((found.meta as { origin: string }).origin).toBe(
    new URL(page.url()).origin,
  );
  const foundData = found.data as {
    candidateSetId: string;
    plan: { planId: string; stops: Array<{ place: { placeId: string } }> };
  };
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();

  const firstPlaceId = foundData.plan.stops[0]!.place.placeId;
  const evidence = await execute(page, "show_place_evidence", {
    candidateSetId: foundData.candidateSetId,
    placeId: firstPlaceId,
    planId: foundData.plan.planId,
    schemaVersion: "2",
  });
  expect(evidence).toMatchObject({ ok: true });
  await expect(
    page.locator(`#place-${firstPlaceId} .v2-source-details`),
  ).toHaveAttribute("open", "");

  const target = foundData.plan.stops[2] ?? foundData.plan.stops.at(-1)!;
  const swapped = await execute(page, "swap_plan_stop", {
    candidateSetId: foundData.candidateSetId,
    planId: foundData.plan.planId,
    preference: "DIFFERENT_INTEREST",
    schemaVersion: "2",
    targetPlaceId: target.place.placeId,
  });
  expect(swapped).toMatchObject({ ok: true });
  await expect(
    page.getByText(/Reference total .* walking .* min/),
  ).toBeVisible();
  const swappedData = swapped.data as {
    candidateSetId: string;
    plan: { planId: string };
  };

  const saved = await execute(page, "save_plan", {
    candidateSetId: swappedData.candidateSetId,
    planId: swappedData.plan.planId,
    schemaVersion: "2",
  });
  expect(saved).toMatchObject({ ok: true });
  const savedPlanId = (saved.data as { savedPlanId: string }).savedPlanId;
  await expect(page.getByRole("button", { name: "Plan saved" })).toBeVisible();

  const deleted = await execute(page, "delete_saved_plan", {
    planId: savedPlanId,
    schemaVersion: "2",
  });
  expect(deleted).toMatchObject({ ok: true, data: { deleted: true } });

  await page.goto("/");
  await expect.poll(() => availableTools(page)).toEqual([]);
  await page.goto("/plan");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());
});

test("PV2-A11Y-001 planned state reflows at 320px and 400%", async ({
  page,
}) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await page.goto(
    `/plan?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=5000&walk=20&interests=art&interests=quiet&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  await expectNoMaterialAxeViolations(page);

  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/");
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "400%";
  });
  const zoomed = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(zoomed.scrollWidth).toBeLessThanOrEqual(zoomed.clientWidth);
});

test("PV2-A11Y-002 honest no-result and runtime error remain accessible", async ({
  page,
}) => {
  await page.goto(
    `/plan?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=5000&walk=20&interests=music&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: "Nothing verifiable fits yet." }),
  ).toBeVisible();
  await expect(
    page.getByText(/will not substitute unrelated places/),
  ).toBeVisible();
  await expectNoMaterialAxeViolations(page);

  await page.route("**/api/v2/plans/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        error: {
          code: "INTERNAL_ERROR",
          message: "The source-backed planner is temporarily unavailable.",
          retryable: true,
        },
        meta: {
          completedAt: new Date().toISOString(),
          correlationId: "planner-error-test",
          origin: "http://localhost:3100",
          packVersion: "1.0.0",
        },
        ok: false,
        schemaVersion: "2",
      },
      status: 500,
    }),
  );
  await page.goto(
    `/plan?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=5000&walk=20&interests=art&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: "We could not build the plan." }),
  ).toBeVisible();
  await expectNoMaterialAxeViolations(page);
});

test("PV2-UI-003 no-result recovery preserves three explicit interests", async ({
  page,
}) => {
  await page.goto(
    `/plan?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=3000&walk=10&interests=hands-on&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: "Nothing verifiable fits yet." }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Hands-on" }).uncheck();
  await page.getByRole("checkbox", { name: "Art & culture" }).check();
  await page.getByRole("checkbox", { name: "Quiet" }).check();
  await page.getByRole("checkbox", { name: "Books" }).check();
  await page.getByRole("button", { name: /Build my evening/ }).click();
  await expect(page).toHaveURL(/interests=art/);
  await expect(page).toHaveURL(/interests=quiet/);
  await expect(page).toHaveURL(/interests=books/);
  await expect(page.getByRole("checkbox", { name: "Books" })).toBeChecked();
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();
});

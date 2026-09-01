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
  preferredTags: ["art", "hands-on", "lively", "quiet"],
  schemaVersion: "2",
  startAt: `${tokyoDate()}T13:00:00+09:00`,
  stopCount: "AUTO",
  totalBudgetYen: 8000,
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
  await page.goto("/legacy/source-planner/home");
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
    page.getByText(/published hours, a visible price basis, walking estimates/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "One request can coordinate the whole revision.",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Plan 13:00–22:00 under ¥8,000/)).toBeVisible();
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
  await page.goto("/legacy/source-planner/home");
  await page.getByRole("button", { name: /Build my evening/ }).click();
  await expect(page).toHaveURL(/\/legacy\/source-planner\?.*auto=1/);
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
  await stops.nth(1).locator(".v2-source-details summary").click();
  await expect(
    stops.nth(1).getByText("Schedule calendar", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save this plan" }).click();
  await expect(page.getByRole("button", { name: "Plan saved" })).toBeVisible();
  await page.locator(".v2-agent-proof > summary").click();
  await expect(
    page.getByRole("list", { name: "Planner action activity" }),
  ).toContainText("find_evening_plan · Manual control · success");
  const storage = await page.evaluate(() =>
    localStorage.getItem("serendipity.saved-itineraries.v2"),
  );
  expect(storage).toContain('"schemaVersion":"2"');
  expect(storage).not.toMatch(/token|correlation|cookie|secret/i);
  await expectNoMaterialAxeViolations(page);
});

test("PV2-LOCK-001 save blocks a concurrent manual swap", async ({ page }) => {
  const swapRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v2/plans/swap") {
      swapRequests.push(request.url());
    }
  });
  await page.route("**/api/v2/places/**/evidence", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto(
    `/legacy/source-planner?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=5000&walk=20&interests=art&interests=quiet&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save this plan" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeVisible();
  await expect(
    page.locator(".v2-stop").first().getByRole("button", {
      name: "Different interest",
    }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Plan saved" })).toBeVisible();
  expect(swapRequests).toEqual([]);
});

test("PV2-RACE-001 late evidence cannot poison a swapped plan or saved snapshot", async ({
  page,
}) => {
  await page.route("**/api/v2/places/**/evidence", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto(
    `/legacy/source-planner?date=${tokyoDate()}&start=13%3A00&end=22%3A00&budget=8000&walk=20&interests=art&interests=hands-on&interests=lively&interests=quiet&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();
  const target = page.locator(".v2-stop").last();
  const removedPlace = (await target.locator("h2").textContent())?.trim();
  await target.locator(".v2-source-details > summary").click();
  await target.getByRole("button", { name: "Different interest" }).click();

  await expect(page.getByText(/Replaced .* with/)).toBeVisible();
  await page.getByRole("button", { name: "Save this plan" }).click();
  await expect(page.getByRole("button", { name: "Plan saved" })).toBeVisible();
  const storage = await page.evaluate(() =>
    localStorage.getItem("serendipity.saved-itineraries.v2"),
  );
  if (removedPlace) expect(storage).not.toContain(removedPlace);
  await expect(page.getByText(/Some saved data could not be read/)).toHaveCount(
    0,
  );
});

test("PV2-RACE-002 a failed swap settles and closes an in-flight evidence view", async ({
  page,
}) => {
  await page.route("**/api/v2/places/**/evidence", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.route("**/api/v2/plans/swap", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        error: {
          code: "NO_REPLACEMENT",
          message: "No safe replacement preserves the current route.",
          retryable: false,
        },
        meta: {
          completedAt: new Date().toISOString(),
          correlationId: "failed-swap-race",
          origin: new URL(route.request().url()).origin,
          packVersion: "1.3.0",
        },
        ok: false,
        schemaVersion: "2",
      },
      status: 409,
    });
  });
  await page.goto(
    `/legacy/source-planner?date=${tokyoDate()}&start=13%3A00&end=22%3A00&budget=8000&walk=20&interests=art&interests=hands-on&interests=lively&interests=quiet&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();

  const target = page.locator(".v2-stop").last();
  const details = target.locator(".v2-source-details");
  await details.locator("summary").click();
  await expect(target.getByText("Loading source evidence…")).toBeVisible();
  await target.getByRole("button", { name: "Different interest" }).click();

  await expect(
    page.getByText("No safe replacement preserves the current route."),
  ).toBeVisible();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(page.getByText("Loading source evidence…")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();
});

test("PV2-ST-001 exact five tools share find, evidence, swap, save, and delete state", async ({
  page,
}) => {
  await page.goto("/legacy/source-planner");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());
  await expect(page.locator(".v2-mode-details > summary")).toHaveText(
    "Agent tools connected",
  );

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
  await expect(page).toHaveURL(/start=13%3A00/);
  await expect(page).toHaveURL(/budget=8000/);
  await expect(page).toHaveURL(/interests=hands-on/);
  await expect(page).toHaveURL(/interests=lively/);
  await expect(page.locator("select[name='start']")).toHaveValue("13:00");
  await expect(
    page.locator("input[name='budget'][value='8000']"),
  ).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Hands-on" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Lively" })).toBeChecked();

  const evidencePlaceId = foundData.plan.stops[1]!.place.placeId;
  const evidence = await execute(page, "show_place_evidence", {
    candidateSetId: foundData.candidateSetId,
    placeId: evidencePlaceId,
    planId: foundData.plan.planId,
    schemaVersion: "2",
  });
  expect(evidence).toMatchObject({ ok: true });
  await expect(
    page.locator(`#place-${evidencePlaceId} .v2-source-details`),
  ).toHaveAttribute("open", "");
  await expect(
    page
      .locator(`#place-${evidencePlaceId} .v2-source-details`)
      .getByText("Schedule calendar", { exact: true }),
  ).toBeVisible();

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
  const deletedAgain = await execute(page, "delete_saved_plan", {
    planId: savedPlanId,
    schemaVersion: "2",
  });
  expect(deletedAgain).toMatchObject({
    ok: true,
    data: { deleted: false },
  });

  await page.locator(".v2-agent-proof > summary").click();
  await expect(page.getByText(/Plan 13:00–22:00 under ¥8,000/)).toBeVisible();
  const activity = page.getByRole("list", { name: "Planner action activity" });
  await expect(activity).toContainText("find_evening_plan · AI tool · success");
  await expect(activity).toContainText(
    "show_place_evidence · AI tool · success",
  );
  await expect(activity).toContainText("swap_plan_stop · AI tool · success");
  await expect(activity).toContainText("save_plan · AI tool · success");
  await expect(activity).toContainText("delete_saved_plan · AI tool · success");

  await page.goto("/legacy/source-planner/home");
  await expect.poll(() => availableTools(page)).toEqual([]);
  await page.goto("/legacy/source-planner");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());
});

test("PV2-SAFE-001 a safe-shaped response with markup neither projects nor crosses a Site Tool", async ({
  page,
}) => {
  await page.route("**/api/v2/plans/search", async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      data?: {
        plan?: {
          stops?: Array<{ place?: { summary?: string } }>;
        };
      };
      ok?: boolean;
    };
    const firstStop = payload.data?.plan?.stops?.[0];
    if (payload.ok && firstStop?.place) {
      firstStop.place.summary = "<script>unsafe()</script>";
    }
    await route.fulfill({ json: payload, response });
  });
  await page.goto("/legacy/source-planner");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());

  const result = await execute(page, "find_evening_plan", intent());
  expect(result).toMatchObject({
    error: { code: "INTERNAL_ERROR" },
    ok: false,
  });
  expect(JSON.stringify(result)).not.toContain("unsafe()");
  await expect(page.locator(".v2-plan-summary")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Build my evening/ }),
  ).toBeVisible();
});

test("PV2-A11Y-001 planned state reflows at 320px and 400%", async ({
  page,
}) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await page.goto(
    `/legacy/source-planner?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=5000&walk=20&interests=art&interests=quiet&auto=1`,
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
  await page.goto("/legacy/source-planner/home");
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
    `/legacy/source-planner?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=5000&walk=20&interests=music&auto=1`,
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
    `/legacy/source-planner?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=5000&walk=20&interests=art&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: "We could not build the plan." }),
  ).toBeVisible();
  await expectNoMaterialAxeViolations(page);
});

test("PV2-UI-003 no-result recovery replaces an unsupported deep-link interest", async ({
  page,
}) => {
  await page.goto(
    `/legacy/source-planner?date=${tokyoDate()}&start=17%3A00&end=22%3A00&budget=3000&walk=10&interests=books&auto=1`,
  );
  await expect(
    page.getByRole("heading", { name: "Nothing verifiable fits yet." }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Books" }).uncheck();
  await page.getByRole("checkbox", { name: "Art & culture" }).check();
  await page.getByRole("checkbox", { name: "Quiet" }).check();
  await page.getByText("Walking and exclusions", { exact: true }).click();
  await page.locator("select[name='walk']").selectOption("20");
  await page.getByRole("button", { name: /Build my evening/ }).click();
  await expect(page).toHaveURL(/interests=art/);
  await expect(page).toHaveURL(/interests=quiet/);
  await expect(page).toHaveURL(/walk=20/);
  await expect(page.getByRole("checkbox", { name: "Quiet" })).toBeChecked();
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();
});

test("PV2-UI-004 explicit no-preference search does not restore defaults", async ({
  page,
}) => {
  await page.goto("/legacy/source-planner");
  await page.getByRole("checkbox", { name: "Art & culture" }).uncheck();
  await page.getByRole("checkbox", { name: "Quiet" }).uncheck();
  await page.getByRole("button", { name: /Build my evening/ }).click();

  await expect(page).toHaveURL(/interests=none/);
  await expect(
    page.getByRole("checkbox", { name: "Art & culture" }),
  ).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Quiet" })).not.toBeChecked();
  await expect(
    page.getByRole("heading", { name: /sourced stops/i }),
  ).toBeVisible();
});

test("PV2-REC-001 a no-result re-search preserves the last verified plan", async ({
  page,
}) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await page.goto(
    `/legacy/source-planner?date=${tokyoDate()}&start=13%3A00&end=22%3A00&budget=8000&walk=20&interests=art&interests=hands-on&interests=lively&interests=quiet&auto=1`,
  );
  const planSummary = page.locator(".v2-plan-summary");
  await expect(planSummary).toBeVisible();
  const firstPlace = await page.locator(".v2-stop h2").first().textContent();

  await page.route("**/api/v2/plans/search", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        error: {
          code: "NO_VALID_PLAN",
          message: "No published route fits those replacement constraints.",
          retryable: false,
        },
        meta: {
          completedAt: new Date().toISOString(),
          correlationId: "preserved-no-result",
          origin: new URL(route.request().url()).origin,
          packVersion: "1.3.0",
        },
        ok: false,
        schemaVersion: "2",
      },
      status: 200,
    });
  });
  await page.getByRole("checkbox", { name: "Quiet" }).uncheck();
  await page.getByRole("button", { name: /Build my evening/ }).click();

  await expect(planSummary).toBeVisible();
  if (firstPlace) {
    await expect(page.locator(".v2-stop h2").first()).toHaveText(firstPlace);
  }
  await expect(
    page.getByText("No published route fits those replacement constraints."),
  ).toBeVisible();
  const retainedAlert = page.locator(".v2-plan-retained");
  await expect(retainedAlert).toContainText("Previous verified plan kept.");
  const alertViewport = await retainedAlert.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      top: bounds.top,
      viewportHeight: globalThis.innerHeight,
    };
  });
  expect(alertViewport.bottom).toBeGreaterThan(0);
  expect(alertViewport.top).toBeLessThan(alertViewport.viewportHeight);
  await expect(page).not.toHaveURL(/interests=quiet/);
  await expect(page.getByRole("checkbox", { name: "Quiet" })).not.toBeChecked();
});

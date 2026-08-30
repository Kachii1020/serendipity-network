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

const serviceDate = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(read("year"), read("month") - 1, read("day") + 1))
    .toISOString()
    .slice(0, 10);
};

const intent = () => ({
  area: "ikebukuro",
  budgetPerPersonYen: 4000,
  endAt: `${serviceDate()}T22:30:00+09:00`,
  excludedTags: [],
  includeMeal: true,
  interestPreset: "CALM_QUIET",
  maxWalkMinutesPerLeg: 20,
  partySize: 3,
  schemaVersion: "3",
  startAt: `${serviceDate()}T17:30:00+09:00`,
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

const reflowContainers = [
  ".v3-shell",
  ".v3-header",
  ".v3-landing",
  ".v3-form",
  ".v3-fieldset",
  ".v3-region-grid",
  ".v3-region-grid span",
  ".v3-ticket-row",
  ".v3-ticket-options",
  ".v3-date-row",
  ".v3-mood-grid",
  ".v3-mood-grid span",
  ".v3-form-actions",
  ".v3-result-main",
  ".v3-adjust",
  ".v3-result-title",
  ".v3-result-title h1",
  ".v3-stat-grid",
  ".v3-route",
  ".v3-stop",
  ".v3-stop h2",
  ".v3-stop__actions",
  ".v3-evidence",
  ".v3-dialog > div",
].join(",");

const expectInternalReflow = async (page: Page, zoom: 200 | 400) => {
  await page.locator("html").evaluate((element, percentage) => {
    element.style.fontSize = `${percentage}%`;
  }, zoom);
  const issues = await page.evaluate((selector) => {
    const tolerance = 1;
    return [...document.querySelectorAll<HTMLElement>(selector)].flatMap(
      (element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          bounds.width === 0
        ) {
          return [];
        }
        const reasons = [
          element.scrollWidth > element.clientWidth + tolerance
            ? `internal ${element.scrollWidth}>${element.clientWidth}`
            : null,
          bounds.left < -tolerance ? `left ${bounds.left}` : null,
          bounds.right > innerWidth + tolerance
            ? `right ${bounds.right}>${innerWidth}`
            : null,
        ].filter(Boolean);
        return reasons.length > 0
          ? [`${element.className || element.tagName}: ${reasons.join(", ")}`]
          : [];
      },
    );
  }, reflowContainers);
  expect(issues, `${zoom}% reflow issues`).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
};

test("PV3-UI-001 landing exposes useful choices without a dashboard wall", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/v3");
  await expect(
    page.getByRole("heading", { name: /A whole Tokyo night/i }),
  ).toBeVisible();
  for (const name of ["Shibuya", "Shinjuku", "Ikebukuro"]) {
    await expect(page.getByRole("radio", { name })).toBeVisible();
  }
  for (const name of ["1 adult", "2 adults", "3 adults"]) {
    await expect(page.getByRole("radio", { name })).toBeVisible();
  }
  expect(await page.locator("input[name='interest']").count()).toBe(6);
  await expect(
    page.getByRole("button", { name: /Build my Tokyo plan/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/Site Tools let your AI compare hubs/),
  ).toBeVisible();
  expect(await availableTools(page)).toEqual([]);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await expectNoMaterialAxeViolations(page);
});

test("PV3-UI-002 manual route is full-width A-M-A with real menu pricing", async ({
  page,
}) => {
  await page.goto("/v3");
  await page.getByText("Ikebukuro", { exact: true }).click();
  await page.locator("input[name='date']").fill(serviceDate());
  await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
  await expect(page).toHaveURL(/\/v3\/plan\?.*auto=1/);
  await expect(
    page.getByRole("heading", { name: "Your Ikebukuro night" }),
  ).toBeVisible();
  const stops = page.locator(".v3-stop");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(1)).toContainText("MEAL");
  await expect(stops.nth(1)).toContainText("/ person");
  await expect(page.locator(".v3-result-title")).toBeVisible();
  await expect(page.locator(".v3-adjust").first()).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(
    page.locator(".v3-adjust").first().locator(".v3-form"),
  ).toBeHidden();
  const changeTrigger = page
    .getByRole("button", { name: "Change this stop" })
    .first();
  await changeTrigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(changeTrigger).toBeFocused();
  const storageBefore = await page.evaluate(() => localStorage.length);
  await page.getByRole("button", { name: "Save this plan" }).click();
  await expect(page.getByText("Plan saved in this browser.")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.length))
    .toBeGreaterThan(storageBefore);
  const stored = await page.evaluate(() =>
    localStorage.getItem("serendipity.saved-itineraries.v3"),
  );
  expect(stored).not.toMatch(
    /priceRange|currentOpeningHours|googleMapsUri|attributions/,
  );
  await expectNoMaterialAxeViolations(page);
});

test("PV3-UI-003 honest two-stop fallback explains the reduction and fills the result width", async ({
  page,
}) => {
  const params = new URLSearchParams({
    area: "shinjuku",
    auto: "1",
    budget: "4000",
    date: serviceDate(),
    end: "22:30",
    interest: "SURPRISE",
    meal: "1",
    party: "3",
    start: "17:30",
    walk: "20",
  });
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(`/v3/plan?${params}`);
  await expect(
    page.getByRole("heading", { name: "Your Shinjuku night" }),
  ).toBeVisible();
  await expect(page.locator(".v3-stop")).toHaveCount(2);
  await expect(page.locator(".v3-trust-note")).toContainText(
    /two-stop fallback/i,
  );
  const widths = await page.locator(".v3-route").evaluate((route) => ({
    cards: [...route.querySelectorAll<HTMLElement>(".v3-stop")].map(
      (card) => card.getBoundingClientRect().width,
    ),
    route: route.getBoundingClientRect().width,
  }));
  expect(widths.cards.every((width) => width >= widths.route * 0.4)).toBe(true);
});

test("PV3-ST-001 exact five tools coordinate find, evidence, meal swap, save, delete", async ({
  page,
}) => {
  await page.goto("/v3/plan");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());
  const found = await execute(page, "find_evening_plan", intent());
  expect(found).toMatchObject({ ok: true, schemaVersion: "3" });
  const foundData = found.data as {
    candidateSetId: string;
    plan: {
      intent: { area: string };
      planId: string;
      stops: Array<{ place: { placeId: string; role: string } }>;
    };
  };
  expect(foundData.plan.stops.map(({ place }) => place.role)).toEqual([
    "ACTIVITY",
    "MEAL",
    "ACTIVITY",
  ]);
  const meal = foundData.plan.stops.find(({ place }) => place.role === "MEAL")!;
  const reference = {
    candidateSetId: foundData.candidateSetId,
    planId: foundData.plan.planId,
    schemaVersion: "3",
  };
  const evidence = await execute(page, "show_place_evidence", {
    ...reference,
    area: "ikebukuro",
    placeId: meal.place.placeId,
  });
  expect(evidence).toMatchObject({ ok: true });
  const evidencePanel = page.locator(
    `[data-evidence-place-id="${meal.place.placeId}"]`,
  );
  await expect(evidencePanel).toHaveAttribute("open", "");
  await expect(evidencePanel).toBeFocused();
  await expect(
    evidencePanel.getByRole("heading", { name: /Sources for/i }),
  ).toBeVisible();
  await expect(
    evidencePanel.getByRole("link", { name: "Open official menu ↗" }),
  ).toHaveAttribute("href", /^https:\/\//);
  await expect(page.locator(".v3-google-attribution")).toHaveCount(0);
  const swapped = await execute(page, "swap_plan_stop", {
    ...reference,
    preference: "CHEAPER",
    targetPlaceId: meal.place.placeId,
  });
  expect(swapped).toMatchObject({ ok: true });
  const swappedData = swapped.data as {
    candidateSetId: string;
    plan: { planId: string };
  };
  const saved = await execute(page, "save_plan", {
    candidateSetId: swappedData.candidateSetId,
    planId: swappedData.plan.planId,
    schemaVersion: "3",
  });
  expect(saved).toMatchObject({ ok: true });
  const savedPlanId = (saved.data as { savedPlanId: string }).savedPlanId;
  expect(
    await execute(page, "delete_saved_plan", {
      planId: savedPlanId,
      schemaVersion: "3",
    }),
  ).toMatchObject({ ok: true, data: { deleted: true } });
});

test("PV3-A11Y-001 mobile first views and 200/400% text reflow without clipped internals", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/v3");
  const cta = page.getByRole("button", { name: /Build my Tokyo plan/ });
  await expect(cta).toBeVisible();
  const ctaViewport = await cta.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { bottom: bounds.bottom, height: innerHeight, top: bounds.top };
  });
  expect(ctaViewport.bottom).toBeGreaterThan(0);
  expect(ctaViewport.top).toBeLessThan(ctaViewport.height);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
  await expect(page.locator("input[name='interest']")).toHaveCount(6);
  for (const interest of await page.locator("input[name='interest']").all()) {
    await expect(interest).toBeVisible();
  }
  await expectInternalReflow(page, 200);
  await expectInternalReflow(page, 400);

  const params = new URLSearchParams({
    area: "ikebukuro",
    auto: "1",
    budget: "4000",
    date: serviceDate(),
    end: "22:30",
    interest: "CALM_QUIET",
    meal: "1",
    party: "3",
    start: "17:30",
    walk: "20",
  });
  await page.goto(`/v3/plan?${params}`);
  const firstStop = page.locator(".v3-stop").first();
  await expect(firstStop).toBeVisible();
  const firstViewport = await firstStop.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { bottom: bounds.bottom, height: innerHeight, top: bounds.top };
  });
  expect(firstViewport.bottom).toBeGreaterThan(0);
  expect(firstViewport.top).toBeLessThan(firstViewport.height);
  const firstFactsViewport = await firstStop
    .locator(".v3-stop__facts")
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { bottom: bounds.bottom, height: innerHeight, top: bounds.top };
    });
  expect(firstFactsViewport.bottom).toBeGreaterThan(0);
  expect(firstFactsViewport.top).toBeLessThan(firstFactsViewport.height);
  await expectNoMaterialAxeViolations(page);
  await expectInternalReflow(page, 200);
  await expectInternalReflow(page, 400);
});

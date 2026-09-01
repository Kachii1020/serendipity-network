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

const layoutRows = async (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((elements) => {
    const rows = new Map<number, number>();
    for (const element of elements) {
      const top = Math.round(element.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    return [...rows.values()];
  });

const interestRows = (page: Page) => layoutRows(page, ".v3-mood-grid label");

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

test("V3-DEP-006 canonical routes expose v3 and preserve the legacy v2 planner", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A whole Tokyo night." }),
  ).toBeVisible();
  expect(await availableTools(page)).toEqual([]);

  await page.goto("/plan");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());
  await expect(
    page.getByText(/AI tools connected|Planner ready/),
  ).toBeVisible();

  await page.goto("/legacy/source-planner");
  await expect(page.getByText("Start at Shibuya Station")).toBeVisible();
  await expect(page.locator(".v2-planner-form")).toHaveAttribute(
    "action",
    "/legacy/source-planner",
  );
});

test("V3-VIS-003 interest choices use deterministic responsive columns", async ({
  page,
}) => {
  for (const fixture of [
    { height: 900, rows: [6], width: 1440 },
    { height: 900, rows: [3, 3], width: 768 },
    { height: 844, rows: [2, 2, 2], width: 390 },
  ]) {
    await page.setViewportSize({
      height: fixture.height,
      width: fixture.width,
    });
    await page.goto("/v3");
    expect(await interestRows(page)).toEqual(fixture.rows);
    const rotations = await page
      .locator(".v3-region-grid span,.v3-mood-grid span")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const matrix = new DOMMatrixReadOnly(
            getComputedStyle(element).transform,
          );
          return { b: matrix.b, c: matrix.c };
        }),
      );
    expect(
      rotations.every(
        ({ b, c }) => Math.abs(b) < 0.0001 && Math.abs(c) < 0.0001,
      ),
    ).toBe(true);
  }
});

test("V3-RESCUE-001 zoom matrix centres hubs and clips segmented selections", async ({
  page,
}) => {
  for (const width of [1600, 1280, 1067, 800, 768, 600, 390]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/v3");
    const centres = await page
      .locator(".v3-region-grid label")
      .evaluateAll((labels) =>
        labels.map((label) => {
          const outer = label.getBoundingClientRect();
          const inner = label.querySelector("span")!.getBoundingClientRect();
          return {
            x: Math.abs(
              outer.left + outer.width / 2 - (inner.left + inner.width / 2),
            ),
            y: Math.abs(
              outer.top + outer.height / 2 - (inner.top + inner.height / 2),
            ),
          };
        }),
      );
    expect(centres.every(({ x, y }) => x <= 1 && y <= 1)).toBe(true);
    await page.getByText("3 adults", { exact: true }).click();
    const selected = await page
      .locator(".v3-ticket-options")
      .first()
      .evaluate((parent) => {
        const outer = parent.getBoundingClientRect();
        const inner = parent
          .querySelector<HTMLInputElement>("input:checked")!
          .nextElementSibling!.getBoundingClientRect();
        return {
          bottom: inner.bottom <= outer.bottom + 1,
          left: inner.left >= outer.left - 1,
          overflow: getComputedStyle(parent).overflow,
          right: inner.right <= outer.right + 1,
          top: inner.top >= outer.top - 1,
        };
      });
    expect(selected).toMatchObject({
      bottom: true,
      left: true,
      overflow: "hidden",
      right: true,
      top: true,
    });
  }
});

test("V3-RESCUE-002 result zoom matrix has only 4x1 or 2x2 summaries and no decorative route chrome", async ({
  page,
}) => {
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
  for (const width of [1600, 1280, 1067, 800, 768, 600, 390]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto(`/v3/plan?${params}`);
    await expect(page.locator(".v3-result-title")).toBeVisible();
    expect(await layoutRows(page, ".v3-stat")).toEqual(
      width >= 1000 ? [4] : [2, 2],
    );
    await expect(
      page.locator(".v3-area-stamp,.v3-route-line,.v3-route-node"),
    ).toHaveCount(0);
    expect(await page.locator(".v3-stop__walk").count()).toBeGreaterThanOrEqual(
      2,
    );
  }
});

test("V3-PROG-001 fast manual search presents four truthful stages for at least 2100ms", async ({
  page,
}) => {
  await page.goto("/v3/plan");
  await page.locator(".v3-adjust summary").first().click();
  const startedAt = Date.now();
  await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
  const progress = page.locator(".v3-progress");
  await expect(progress).toBeVisible();
  await expect(progress).toContainText("Planner");
  await expect(progress).not.toContainText("AI tool");
  await expect(progress).toContainText("Understanding your choices");
  await expect(progress).toContainText(
    "Checking published hours & official menu prices",
  );
  await expect(progress).toContainText("Comparing routes & walking time");
  await expect(progress).toContainText("Preparing your best plan");
  await expect(progress.locator(".v3-progress__slots li")).toHaveCount(3);
  await expect(page.locator(".v3-result-title")).toBeVisible();
  const elapsed = Date.now() - startedAt;
  expect(elapsed).toBeGreaterThanOrEqual(1_950);
  expect(elapsed).toBeLessThanOrEqual(2_600);
});

test("V3-PROG-002 slow search stays pending beyond the presentation minimum", async ({
  page,
}) => {
  await page.route("**/api/v3/plans/search", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_600));
    await route.continue();
  });
  await page.goto("/v3/plan");
  await page.locator(".v3-adjust summary").first().click();
  await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
  await page.waitForTimeout(2_200);
  await expect(page.locator(".v3-progress")).toBeVisible();
  await expect(page.locator(".v3-progress")).toContainText(
    "Preparing your best plan",
  );
  await expectNoMaterialAxeViolations(page);
  await expect(page.locator(".v3-result-title")).toBeVisible();
});

test("V3-PROG-002B honest no-result keeps the minimum presentation", async ({
  page,
}) => {
  await page.route("**/api/v3/plans/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        error: {
          code: "NO_VALID_PLAN",
          message: "No source-backed route fits those constraints.",
          retryable: true,
        },
        meta: {
          area: "shibuya",
          completedAt: "2026-08-31T09:00:00.000Z",
          correlationId: "no-result-progress-correlation",
          origin: "http://localhost:3100",
          packVersion: "1.0.0",
        },
        ok: false,
        schemaVersion: "3",
      },
    }),
  );
  await page.goto("/v3/plan");
  await page.locator(".v3-adjust summary").first().click();
  const startedAt = Date.now();
  await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing honest fits yet." }),
  ).toBeVisible();
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_950);
});

test("V3-PROG-003 transport failure bypasses the presentation minimum", async ({
  page,
}) => {
  await page.route("**/api/v3/plans/search", (route) =>
    route.fulfill({ contentType: "application/json", status: 500, body: "{}" }),
  );
  await page.goto("/v3/plan");
  await page.locator(".v3-adjust summary").first().click();
  const startedAt = Date.now();
  await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
  await expect(
    page.getByRole("heading", { name: "The planner paused." }),
  ).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(1_000);
});

test("V3-PROG-004 Site Tool search names the real tool and reduced motion disables animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/plan");
  await expect.poll(() => availableTools(page)).toEqual([...toolNames].sort());
  await page.evaluate((input) => {
    const context = (
      document as Document & { readonly modelContext?: PageToolContext }
    ).modelContext;
    (
      globalThis as typeof globalThis & { __v3ToolRun?: Promise<unknown> }
    ).__v3ToolRun = (async () => {
      if (!context) throw new Error("WebMCP unavailable");
      const find = (await context.getTools()).find(
        ({ name }) => name === "find_evening_plan",
      );
      if (!find) throw new Error("find tool unavailable");
      return context.executeTool(find, JSON.stringify(input));
    })();
  }, intent());
  await expect(page.locator(".v3-progress")).toContainText(
    "AI tool · find_evening_plan",
  );
  const motion = await page.locator(".v3-progress-fill").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      transitionDuration: style.transitionDuration,
    };
  });
  expect(motion.animationName).toBe("none");
  expect(Number.parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(
    0.001,
  );
  await page.evaluate(
    async () =>
      (globalThis as typeof globalThis & { __v3ToolRun?: Promise<unknown> })
        .__v3ToolRun,
  );
});

test("PV3-UI-002 manual route is full-width A-M-A with real menu pricing", async ({
  page,
}) => {
  await page.goto("/v3");
  await page.getByText("Ikebukuro", { exact: true }).click();
  await page.locator("input[name='date']").fill(serviceDate());
  await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
  await expect(page).toHaveURL(/\/v3\/plan\?.*area=ikebukuro/);
  await expect(
    page.getByRole("heading", { name: "Your Ikebukuro night" }),
  ).toBeVisible();
  const stops = page.locator(".v3-stop");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(1)).toContainText("MEAL");
  await expect(stops.nth(1)).toContainText("/ person");
  await expect(page.locator(".v3-result-title")).toBeVisible();
  await expect(page.locator(".v3-result-title")).toBeFocused();
  const focusStyle = await page
    .locator(".v3-result-title")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { boxShadow: style.boxShadow, outlineColor: style.outlineColor };
    });
  expect(focusStyle.boxShadow).toContain("101, 75, 230");
  expect(focusStyle.outlineColor).not.toBe("rgb(0, 95, 204)");
  const resultRotations = await page
    .locator(".v3-stat,.v3-stop")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const matrix = new DOMMatrixReadOnly(
          getComputedStyle(element).transform,
        );
        return { b: matrix.b, c: matrix.c };
      }),
    );
  expect(
    resultRotations.every(
      ({ b, c }) => Math.abs(b) < 0.0001 && Math.abs(c) < 0.0001,
    ),
  ).toBe(true);
  await expect(
    page.locator(".v3-area-stamp,.v3-route-line,.v3-route-node"),
  ).toHaveCount(0);
  await expect(page.locator(".v3-stop__walk")).toHaveCount(3);
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
  await expect(changeTrigger).toBeEnabled();
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
    area: "shibuya",
    auto: "1",
    budget: "4000",
    date: serviceDate(),
    end: "19:30",
    interest: "SURPRISE",
    meal: "1",
    party: "3",
    start: "17:30",
    walk: "20",
  });
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(`/v3/plan?${params}`);
  await expect(
    page.getByRole("heading", { name: "Your Shibuya night" }),
  ).toBeVisible();
  await expect(page.locator(".v3-stop")).toHaveCount(2);
  await expect(page.locator(".v3-trust-block")).toContainText(
    /two-stop fallback/i,
  );
  const widths = await page.locator(".v3-route").evaluate((route) => ({
    cards: [...route.querySelectorAll<HTMLElement>(".v3-stop")].map(
      (card) => card.getBoundingClientRect().width,
    ),
    route: route.getBoundingClientRect().width,
  }));
  expect(widths.cards.every((width) => width >= widths.route * 0.4)).toBe(true);
  await expect(
    page.locator(".v3-area-stamp,.v3-route-line,.v3-route-node"),
  ).toHaveCount(0);
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
  await page.getByText(/^AI tool activity/).click();
  await expect(
    page.getByRole("list", { name: "Planner action activity" }),
  ).toContainText(
    /find_evening_plan · AI tool · success · \d+ms · [a-f0-9]{8}/,
  );
  await page.getByText(/^AI tool activity/).click();
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
  const containment = await page.locator(".v3-stop").evaluateAll((cards) =>
    cards.map((card) => {
      const outer = card.getBoundingClientRect();
      const actions = card.querySelector<HTMLElement>(".v3-stop__actions")!;
      const inner = actions.getBoundingClientRect();
      return {
        contained:
          inner.left >= outer.left - 1 &&
          inner.right <= outer.right + 1 &&
          inner.bottom <= outer.bottom + 1,
        evidenceBorderLeft: getComputedStyle(
          card.querySelector<HTMLElement>(".v3-evidence")!,
        ).borderLeftWidth,
      };
    }),
  );
  expect(containment.every(({ contained }) => contained)).toBe(true);
  expect(
    containment.every(({ evidenceBorderLeft }) => evidenceBorderLeft === "0px"),
  ).toBe(true);
  await expectInternalReflow(page, 200);
  await expectInternalReflow(page, 400);
});

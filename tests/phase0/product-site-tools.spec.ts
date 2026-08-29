import type { FindOptionsData } from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { composeBundles } from "@serendipity/bundle-engine";
import { expect, test, type Page } from "@playwright/test";

const productToolNames = [
  "find_serendipity_options",
  "show_bundle",
  "hold_bundle",
  "confirm_bundle",
  "release_bundle",
] as const;

type ProductPageTool = {
  annotations?: { readOnlyHint?: boolean };
  inputSchema?: unknown;
  name: string;
  origin?: string;
};

type ProductPageContext = {
  executeTool(tool: ProductPageTool, input: string): Promise<null | string>;
  getTools(options?: {
    fromOrigins?: readonly string[];
  }): Promise<readonly ProductPageTool[]>;
};

type Phase0PageContext = {
  discover(): Promise<{
    ignored: readonly unknown[];
    tools: readonly { name: string; origin?: string }[];
  }>;
};

const waitForProductTools = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(async (expectedNames) => {
        const context = (
          document as Document & { readonly modelContext?: ProductPageContext }
        ).modelContext;
        if (!context) return [];
        return (await context.getTools())
          .map(({ name }) => name)
          .filter((name) => expectedNames.includes(name))
          .sort();
      }, productToolNames),
    )
    .toEqual([...productToolNames].sort());
};

const providerOrigins = (
  process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
  "http://localhost:3101,http://localhost:3102,http://localhost:3103"
)
  .split(",")
  .map((origin) => origin.trim());

const createFindOptionsData = async (): Promise<FindOptionsData> => {
  const composed = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!composed.ok || !composed.candidates[0]) {
    throw new Error("canonical product bundle was not composed");
  }
  return {
    alternatives: composed.candidates.slice(1, 3),
    bundleSessionId: "product-site-tool-session",
    bundleVersion: 1,
    providerStatuses: { kiln: "ONLINE", loop: "ONLINE", nori: "ONLINE" },
    selectedBundle: composed.candidates[0],
  };
};

const searchEnvelope = (
  data: FindOptionsData,
  correlationId: string,
  origin = "http://localhost:3100",
) => ({
  data,
  meta: {
    completedAt: "2030-05-17T09:00:00.000Z",
    correlationId,
    origin,
  },
  ok: true,
  schemaVersion: "1",
});

test("STL-002/003 exposes five top-level tools and a Site Tool search updates the product", async ({
  page,
}) => {
  const data = await createFindOptionsData();
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: searchEnvelope(data, "product-site-tool-correlation"),
    }),
  );

  await page.goto("/legacy/network-demo");
  await waitForProductTools(page);
  await expect(page.locator(".network-pill")).toContainText("WebMCP");
  await expect(page.locator("main")).toHaveAttribute(
    "data-bound-provider-count",
    "0",
  );
  const providerFrames = page.locator("iframe[title$='live Provider page']");
  await expect(providerFrames).toHaveCount(0);
  await page.getByText("See WebMCP in action").click();
  await expect(page.locator("main")).toHaveAttribute(
    "data-bound-provider-count",
    "3",
  );
  await expect(providerFrames).toHaveCount(3);
  for (let index = 0; index < providerOrigins.length; index += 1) {
    const frame = providerFrames.nth(index);
    await expect(frame).toHaveAttribute("allow", "tools");
    const source = await frame.getAttribute("src");
    expect(new URL(source ?? "").origin).toBe(providerOrigins[index]);
  }

  const delegatedProviderTools = await page.evaluate(async (origins) => {
    const context = (
      document as Document & { readonly modelContext?: ProductPageContext }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    return (await context.getTools({ fromOrigins: origins })).map(
      ({ name, origin }) => ({ name, origin }),
    );
  }, providerOrigins);
  const providerDiagnostics = delegatedProviderTools.filter(({ origin }) =>
    providerOrigins.includes(origin ?? ""),
  );
  expect(providerDiagnostics).toHaveLength(15);
  for (const [index, provider] of ["kiln", "nori", "loop"].entries()) {
    expect(
      providerDiagnostics.filter(
        ({ name, origin }) =>
          name.startsWith(`${provider}_`) && origin === providerOrigins[index],
      ),
    ).toHaveLength(5);
  }

  const inventory = await page.evaluate(async (expectedNames) => {
    const context = (
      document as Document & { readonly modelContext?: ProductPageContext }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    const tools = await context.getTools();
    return expectedNames.map((name) => ({
      count: tools.filter((tool) => tool.name === name).length,
      name,
      readOnly: tools.find((tool) => tool.name === name)?.annotations
        ?.readOnlyHint,
    }));
  }, productToolNames);
  expect(inventory).toEqual([
    { count: 1, name: "find_serendipity_options", readOnly: true },
    { count: 1, name: "show_bundle", readOnly: true },
    { count: 1, name: "hold_bundle", readOnly: false },
    { count: 1, name: "confirm_bundle", readOnly: false },
    { count: 1, name: "release_bundle", readOnly: false },
  ]);

  const serialized: null | string = await page.evaluate(async (input) => {
    const context = (
      document as Document & { readonly modelContext?: ProductPageContext }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    const tool = (await context.getTools()).find(
      ({ name }) => name === "find_serendipity_options",
    );
    if (!tool) throw new Error("product search tool unavailable");
    return context.executeTool(tool, JSON.stringify(input));
  }, canonicalIntent);

  expect(JSON.parse(serialized ?? "null")).toMatchObject({
    data: { bundleSessionId: "product-site-tool-session" },
    ok: true,
  });
  await expect(
    page.getByRole("heading", { name: "Tonight got interesting." }),
  ).toBeVisible();
  const activity = page
    .locator(".activity-list li")
    .filter({ hasText: "Find serendipity options" });
  await expect(activity.locator("p").first()).toHaveText(
    /^Site tool · Complete · \d+ ms$/,
  );
  await expect(activity).toContainText("http://localhost:3100");
  await expect(activity).toContainText("product-site-tool-correlation");
  await expect(activity.locator("time")).toHaveAttribute(
    "datetime",
    "2030-05-17T09:00:00.000Z",
  );
  await expect(page.getByText("Manual fallback", { exact: true })).toHaveCount(
    0,
  );

  const proof = page.locator(".proof-body");
  await expect(proof).toContainText(
    "The Hub exposes five top-level Site Tools, coordinates three independent Provider APIs",
  );
  const proofText = await proof.innerText();
  expect(proofText).not.toMatch(
    /iframe tool|tool executed in (?:an )?iframe|Provider iframe executed|Provider page ran a tool/i,
  );
  expect(serialized).not.toMatch(
    /"(?:holdToken|accessToken|authorization|serviceRoleKey|secret)"\s*:/i,
  );
});

test("STL-006 a human click is labeled Manual fallback with safe provenance", async ({
  page,
}) => {
  const data = await createFindOptionsData();
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: searchEnvelope(
        data,
        "product-manual-correlation",
        "https://hub.manual.test",
      ),
    }),
  );

  await page.goto("/legacy/network-demo");
  await waitForProductTools(page);
  await page.getByRole("button", { name: "Plan my night" }).click();
  await expect(
    page.getByRole("heading", { name: "Tonight got interesting." }),
  ).toBeVisible();
  await page.getByText("See WebMCP in action").click();

  const activity = page
    .locator(".activity-list li")
    .filter({ hasText: "Manual search three providers" });
  await expect(activity.locator("p").first()).toHaveText(
    /^Manual fallback · Complete · \d+ ms$/,
  );
  await expect(activity).toContainText("https://hub.manual.test");
  await expect(activity).toContainText("product-manual-correlation");
  await expect(activity.locator("time")).toHaveAttribute(
    "datetime",
    "2030-05-17T09:00:00.000Z",
  );
  await expect(activity).not.toContainText("Site tool");
});

test("IMP-003 human presets and Site Tool input share the same Intent endpoint", async ({
  page,
}) => {
  const data = await createFindOptionsData();
  const requestBodies: unknown[] = [];
  await page.clock.install({ time: new Date("2030-05-17T00:00:00.000Z") });
  await page.route("**/api/manual/search", async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({
      contentType: "application/json",
      json: searchEnvelope(data, `shared-intent-${requestBodies.length}`),
    });
  });

  await page.goto("/legacy/network-demo");
  await waitForProductTools(page);
  await page.locator(".constraint-adjuster summary").click();
  await page.getByRole("radio", { name: "18:30" }).check();
  await page.getByRole("radio", { name: "¥6,000" }).check();
  expect(requestBodies).toHaveLength(0);
  await page.getByRole("button", { name: "Plan my night" }).click();
  await expect(
    page.getByRole("heading", { name: "Tonight got interesting." }),
  ).toBeVisible();
  expect(requestBodies[0]).toMatchObject({
    area: "shibuya",
    endAt: "2030-05-17T22:30:00+09:00",
    partySize: 1,
    startAt: "2030-05-17T18:30:00+09:00",
    totalBudgetYen: 6000,
  });
  await expect(page.getByLabel("Selected plan constraints")).toContainText(
    "18:30–22:30",
  );
  await expect(page.getByLabel("Selected plan constraints")).toContainText(
    "¥6,000",
  );

  await page.reload();
  await waitForProductTools(page);
  const siteToolIntent = {
    ...canonicalIntent,
    startAt: "2030-05-17T19:00:00+09:00",
    totalBudgetYen: 4500,
  };
  const serialized = await page.evaluate(async (input) => {
    const context = (
      document as Document & { readonly modelContext?: ProductPageContext }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    const tool = (await context.getTools()).find(
      ({ name }) => name === "find_serendipity_options",
    );
    if (!tool) throw new Error("product search tool unavailable");
    return context.executeTool(tool, JSON.stringify(input));
  }, siteToolIntent);

  expect(JSON.parse(serialized ?? "null")).toMatchObject({ ok: true });
  expect(requestBodies[1]).toEqual(siteToolIntent);
  await expect(page.getByLabel("Selected plan constraints")).toContainText(
    "19:00–22:30",
  );
  await expect(page.getByLabel("Selected plan constraints")).toContainText(
    "¥4,500",
  );
});

test("IMP-003 rejects a Site Tool end time outside the fixed v1 22:30 boundary", async ({
  page,
}) => {
  let requestCount = 0;
  await page.route("**/api/manual/search", (route) => {
    requestCount += 1;
    return route.abort();
  });
  await page.goto("/legacy/network-demo");
  await waitForProductTools(page);

  const serialized = await page.evaluate(
    async (input) => {
      const context = (
        document as Document & { readonly modelContext?: ProductPageContext }
      ).modelContext;
      if (!context) throw new Error("WebMCP unavailable");
      const tool = (await context.getTools()).find(
        ({ name }) => name === "find_serendipity_options",
      );
      if (!tool) throw new Error("product search tool unavailable");
      return context.executeTool(tool, JSON.stringify(input));
    },
    {
      ...canonicalIntent,
      endAt: "2030-05-17T21:30:00+09:00",
    },
  );

  expect(JSON.parse(serialized ?? "null")).toMatchObject({
    error: { code: "VALIDATION_ERROR", retryable: false },
    ok: false,
  });
  expect(requestCount).toBe(0);
  await expect(
    page.getByRole("heading", { name: "What kind of tonight?" }),
  ).toBeVisible();
});

test("STL-003 permits only one in-flight search and commits the accepted request", async ({
  page,
}) => {
  const data = await createFindOptionsData();
  let releaseSearch: (() => void) | undefined;
  const searchGate = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });
  let requestCount = 0;
  await page.route("**/api/manual/search", async (route) => {
    requestCount += 1;
    await searchGate;
    await route.fulfill({
      contentType: "application/json",
      json: searchEnvelope(data, "single-in-flight-search"),
    });
  });
  await page.goto("/legacy/network-demo");
  await waitForProductTools(page);

  await page.evaluate((input) => {
    const context = (
      document as Document & { readonly modelContext?: ProductPageContext }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    void context.getTools().then((tools) => {
      const tool = tools.find(
        ({ name }) => name === "find_serendipity_options",
      );
      if (!tool) throw new Error("product search tool unavailable");
      return context.executeTool(tool, JSON.stringify(input));
    });
  }, canonicalIntent);
  await expect.poll(() => requestCount).toBe(1);

  const rejected = await page.evaluate(async (input) => {
    const context = (
      document as Document & { readonly modelContext?: ProductPageContext }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    const tool = (await context.getTools()).find(
      ({ name }) => name === "find_serendipity_options",
    );
    if (!tool) throw new Error("product search tool unavailable");
    return context.executeTool(tool, JSON.stringify(input));
  }, canonicalIntent);
  expect(JSON.parse(rejected ?? "null")).toMatchObject({
    error: { code: "CANCELLED", retryable: true },
    ok: false,
  });
  expect(requestCount).toBe(1);

  releaseSearch?.();
  await expect(
    page.getByRole("heading", { name: "Tonight got interesting." }),
  ).toBeVisible();
  await expect(page.getByText("Route 1", { exact: false })).toBeVisible();
});

test("STL-003 invalidates old show_bundle inputs after a no-result search", async ({
  page,
}) => {
  const data = await createFindOptionsData();
  let requestCount = 0;
  await page.route("**/api/manual/search", (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      return route.fulfill({
        contentType: "application/json",
        json: searchEnvelope(data, "candidate-before-no-result"),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      json: {
        error: {
          code: "NO_VALID_BUNDLE",
          message: "No complete route fits those constraints.",
          retryable: true,
        },
        meta: {
          completedAt: "2030-05-17T09:00:00.000Z",
          correlationId: "candidate-no-result",
          origin: "http://localhost:3100",
        },
        ok: false,
        schemaVersion: "1",
      },
    });
  });
  await page.goto("/legacy/network-demo");
  await waitForProductTools(page);

  const results = await page.evaluate(
    async ({ intent, staleSelection }) => {
      const context = (
        document as Document & { readonly modelContext?: ProductPageContext }
      ).modelContext;
      if (!context) throw new Error("WebMCP unavailable");
      const tools = await context.getTools();
      const find = tools.find(
        ({ name }) => name === "find_serendipity_options",
      );
      const show = tools.find(({ name }) => name === "show_bundle");
      if (!find || !show) throw new Error("product tools unavailable");
      const first = await context.executeTool(find, JSON.stringify(intent));
      const second = await context.executeTool(find, JSON.stringify(intent));
      const stale = await context.executeTool(
        show,
        JSON.stringify(staleSelection),
      );
      return { first, second, stale };
    },
    {
      intent: canonicalIntent,
      staleSelection: {
        bundleId: data.selectedBundle.bundleId,
        bundleSessionId: data.bundleSessionId,
        bundleVersion: data.bundleVersion,
        schemaVersion: "1",
      },
    },
  );

  expect(JSON.parse(results.first ?? "null")).toMatchObject({ ok: true });
  expect(JSON.parse(results.second ?? "null")).toMatchObject({
    error: { code: "NO_VALID_BUNDLE" },
    ok: false,
  });
  expect(JSON.parse(results.stale ?? "null")).toMatchObject({
    error: { code: "BUNDLE_NOT_FOUND" },
    ok: false,
  });
  expect(requestCount).toBe(2);
  await expect(
    page.getByRole("heading", { name: "Nothing fits exactly—yet." }),
  ).toBeVisible();
});

test("STL-007 removing one iframe delegation fails closed for that Provider", async ({
  page,
}) => {
  await page.goto("/phase0?noriTools=disabled");
  await page.waitForFunction(() =>
    Boolean(
      (window as Window & { readonly __phase0?: Phase0PageContext }).__phase0,
    ),
  );
  await expect(page.getByTestId("webmcp-support")).toHaveText(
    "WebMCP available",
  );
  await expect(page.getByTestId("provider-frame-0")).toHaveAttribute(
    "allow",
    "tools",
  );
  await expect(page.getByTestId("provider-frame-1")).toHaveAttribute(
    "allow",
    "",
  );
  await expect(
    page
      .getByTestId("provider-frame-0")
      .contentFrame()
      .locator('[data-status="REGISTERED"]'),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("provider-frame-1")
      .contentFrame()
      .locator('[data-status="ERROR"]'),
  ).toBeVisible();

  const result = await page.evaluate(async () => {
    const api = (window as Window & { readonly __phase0?: Phase0PageContext })
      .__phase0;
    if (!api) throw new Error("Phase 0 API unavailable");
    return api.discover();
  });
  expect(result.tools.map(({ origin }) => origin)).toEqual([
    providerOrigins[0],
  ]);
  expect(result.tools).not.toContainEqual(
    expect.objectContaining({ origin: providerOrigins[1] }),
  );
});

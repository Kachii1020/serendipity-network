import { expect, test, type Page } from "@playwright/test";

interface Phase0BrowserApi {
  discover: () => Promise<unknown>;
  encoding: () => Promise<unknown>;
  error: () => Promise<unknown>;
  hold: (requestId?: string) => Promise<unknown>;
  nestedHold: (requestId?: string) => Promise<unknown>;
  nestedRead: () => Promise<unknown>;
  read: () => Promise<unknown>;
  rediscoverAfterReload: (index?: number) => Promise<unknown>;
  timeout: () => Promise<unknown>;
}

const expectedProviderOrigins = (
  process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
  "http://localhost:3101,http://localhost:3102"
)
  .split(",")
  .map((value) => value.trim());

const kilnOrigin = expectedProviderOrigins[0] ?? "";
const noriOrigin = expectedProviderOrigins[1] ?? "";

async function loadHarness(
  page: Page,
  path = "/phase0",
  providerStatuses: readonly [
    "ERROR" | "REGISTERED",
    "ERROR" | "REGISTERED",
  ] = ["REGISTERED", "REGISTERED"],
) {
  await page.goto(path);
  await page.waitForFunction(() =>
    Boolean(
      (window as Window & { readonly __phase0?: Phase0BrowserApi }).__phase0,
    ),
  );
  await expect(page.getByTestId("webmcp-support")).toHaveText(
    "WebMCP available",
  );
  await expect(page.getByTestId("hub-registration")).toContainText(
    "registered",
  );
  await Promise.all(
    providerStatuses.map((status, index) =>
      expect(
        page
          .getByTestId(`provider-frame-${index}`)
          .contentFrame()
          .locator(`[data-status="${status}"]`),
      ).toBeVisible(),
    ),
  );
}

async function runApi<T>(
  page: Page,
  method: keyof Phase0BrowserApi,
  argument?: string | number,
): Promise<T> {
  return page.evaluate(
    async ({ argument, method }) => {
      const api = (window as Window & { readonly __phase0?: Phase0BrowserApi })
        .__phase0;
      if (!api) throw new Error("Phase 0 API unavailable");
      const fn = api[method] as (value?: string | number) => Promise<unknown>;
      return fn(argument);
    },
    { argument, method },
  ) as Promise<T>;
}

test("P0-001 feature detection and P0-003 exact-origin frames", async ({
  page,
}) => {
  await loadHarness(page);
  await expect(page.locator('iframe[allow="tools"]')).toHaveCount(2);
  const kilnFrameUrl = await page
    .getByTestId("provider-frame-0")
    .getAttribute("src");
  const noriFrameUrl = await page
    .getByTestId("provider-frame-1")
    .getAttribute("src");
  expect(new URL(kilnFrameUrl ?? "").origin).toBe(kilnOrigin);
  expect(new URL(noriFrameUrl ?? "").origin).toBe(noriOrigin);
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
      .locator('[data-status="REGISTERED"]'),
  ).toBeVisible();
});

test("P0-002 Strict Mode leaves one live Hub registration per name", async ({
  page,
}) => {
  await loadHarness(page);
  const names = await page.evaluate(async () => {
    const context = (
      document as Document & {
        readonly modelContext?: {
          getTools(): Promise<readonly { readonly name: string }[]>;
        };
      }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    const tools = await context.getTools();
    return tools.map((tool) => tool.name);
  });
  expect(
    names.filter((name) => name === "serendipity_phase0_nested_read"),
  ).toHaveLength(1);
  expect(
    names.filter((name) => name === "serendipity_phase0_nested_hold"),
  ).toHaveLength(1);
});

test("P0-005/007 discovery requests only exposed exact origins", async ({
  page,
}) => {
  await loadHarness(page);
  const result = await runApi<{
    ignored: unknown[];
    tools: { name: string; origin?: string }[];
  }>(page, "discover");
  expect(result.tools).toHaveLength(2);
  expect(result.tools.map(({ origin }) => origin)).toEqual([
    kilnOrigin,
    noriOrigin,
  ]);
  expect(result.ignored).toEqual([]);
});

test("P0-004 missing iframe permission fails closed", async ({ page }) => {
  await loadHarness(page, "/phase0?noriTools=disabled", [
    "REGISTERED",
    "ERROR",
  ]);
  const result = await runApi<{ tools: { origin?: string }[] }>(
    page,
    "discover",
  );
  expect(result.tools.map(({ origin }) => origin)).toEqual([kilnOrigin]);
});

test("P0-006 omitted exposedTo does not fall back to wildcard", async ({
  page,
}) => {
  await loadHarness(page, "/phase0?noriExposure=none");
  const result = await runApi<{ tools: { origin?: string }[] }>(
    page,
    "discover",
  );
  expect(result.tools.map(({ origin }) => origin)).toEqual([kilnOrigin]);
});

test("P0-008 direct reads return envelopes and update iframe UI", async ({
  page,
}) => {
  await loadHarness(page);
  const result = await runApi<{
    results: { result: string }[];
  }>(page, "read");
  expect(result.results).toHaveLength(2);
  result.results.forEach(({ result: raw }) => {
    expect(JSON.parse(raw)).toMatchObject({ ok: true });
  });
  await expect(
    page
      .getByTestId("provider-frame-0")
      .contentFrame()
      .locator('[data-status="AVAILABLE"]'),
  ).toBeVisible();
});

test("P0-009 in-memory holds are idempotent and visibly decrement once", async ({
  page,
}) => {
  await loadHarness(page);
  await runApi(page, "hold", "p0-009");
  await runApi(page, "hold", "p0-009");
  await expect(
    page.getByTestId("provider-frame-0").contentFrame().getByTestId("capacity"),
  ).toHaveText("1");
  await expect(
    page.getByTestId("provider-frame-1").contentFrame().getByTestId("capacity"),
  ).toHaveText("1");
});

test("P0-010 nested Hub read executes both Provider tools", async ({
  page,
}) => {
  await loadHarness(page);
  const raw = await runApi<string>(page, "nestedRead");
  const result = JSON.parse(raw) as { results: unknown[] };
  expect(result.results).toHaveLength(2);
});

test("P0-011 nested mutation occurs once across both Providers", async ({
  page,
}) => {
  await loadHarness(page);
  const raw = await runApi<string>(page, "nestedHold", "p0-011");
  const result = JSON.parse(raw) as { results: unknown[] };
  expect(result.results).toHaveLength(2);
  await expect(
    page.getByTestId("provider-frame-0").contentFrame().getByTestId("capacity"),
  ).toHaveText("1");
});

test("P0-012 Provider failures are normalized", async ({ page }) => {
  await loadHarness(page);
  const result = await runApi<{ error: { code: string }; ok: boolean }>(
    page,
    "error",
  );
  expect(result.ok).toBe(true);
  expect(result.error.code).toBe("TRANSPORT_ERROR");
});

test("P0-013 timeout aborts bounded Provider work", async ({ page }) => {
  await loadHarness(page);
  const result = await runApi<{ error: { code: string }; ok: boolean }>(
    page,
    "timeout",
  );
  expect(result.ok).toBe(true);
  expect(result.error.code).toBe("TIMEOUT");
});

test("P0-014 iframe reload invalidates and rediscovers tools", async ({
  page,
}) => {
  await loadHarness(page);
  const result = await runApi<{
    cacheValidAfterReload: boolean;
    rediscovered: unknown[];
  }>(page, "rediscoverAfterReload", 0);
  expect(result.cacheValidAfterReload).toBe(false);
  expect(result.rediscovered).toHaveLength(2);
});

test("P0-015 duplicate name from wrong origin is ignored", async ({ page }) => {
  await loadHarness(page, "/phase0?noriSpoof=kiln");
  const result = await runApi<{
    ignored: { reason: string }[];
    tools: { origin?: string }[];
  }>(page, "discover");
  expect(result.tools.map(({ origin }) => origin)).toEqual([kilnOrigin]);
  expect(result.ignored).toContainEqual(
    expect.objectContaining({ reason: "ORIGIN_MISMATCH" }),
  );
});

test("P0-016 read-only probe records accepted executeTool encodings", async ({
  page,
}) => {
  await loadHarness(page);
  const result = await runApi<{ accepted: string[] }>(page, "encoding");
  expect(result.accepted).toEqual(["json-string"]);
});

test("P0-015 security headers use origin isolation and exact policies", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["origin-agent-cluster"]).toBe("?1");
  expect(response.headers()["permissions-policy"]).toContain("tools=(self");
  expect(response.headers()["content-security-policy"]).toContain(
    `frame-src 'self' ${kilnOrigin} ${noriOrigin}`,
  );
  expect(response.headers()["content-security-policy"]).not.toContain(
    "frame-src *",
  );
});

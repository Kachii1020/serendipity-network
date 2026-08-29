import { composeBundles } from "@serendipity/bundle-engine";
import type { FindOptionsData } from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { expect, test } from "@playwright/test";

const providerOrigins = (
  process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
  "http://localhost:3101,http://localhost:3102,http://localhost:3103"
)
  .split(",")
  .map((origin) => origin.trim());
const hubOrigin =
  process.env.NEXT_PUBLIC_HUB_ORIGIN ??
  new URL(process.env.PHASE0_BASE_URL ?? "http://localhost:3100").origin;

const secretMarkers = [
  "BUNDLE_ENCRYPTION_KEY",
  "DATABASE_URL",
  "SUPABASE_SECRET_KEY",
  "local-only-hold-token-secret-32-bytes-minimum",
  "local-only-interservice-secret-32-bytes-minimum",
  "local-only-provider-access-secret-32-bytes-minimum",
  "SUPABASE_SERVICE_ROLE_KEY",
  "HUB_INTERSERVICE_SECRET",
  "PROVIDER_ACCESS_TOKEN_SECRET",
  "HOLD_TOKEN_SECRET",
  "DEMO_OPERATOR_SECRET",
];

type SecurityPageTool = {
  inputSchema?: unknown;
  name: string;
};

type SecurityPageContext = {
  executeTool(tool: SecurityPageTool, input: string): Promise<null | string>;
  getTools(): Promise<readonly SecurityPageTool[]>;
};

test("SEC-001/003 Hub headers allow only the exact three Provider origins", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const headers = response.headers();
  const policy = headers["permissions-policy"] ?? "";
  const csp = headers["content-security-policy"] ?? "";

  expect(headers["origin-agent-cluster"]).toBe("?1");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(policy).not.toContain("*");
  expect(csp).not.toContain("*");
  for (const origin of providerOrigins) {
    expect(policy).toContain(`"${origin}"`);
    expect(csp).toContain(origin);
  }
  expect(csp).toContain("frame-ancestors 'self'");
});

test("SEC-001/002 each Provider permits only itself and the exact Hub", async ({
  request,
}) => {
  for (const origin of providerOrigins) {
    const response = await request.get(`${origin}/embed?phase0=1`);
    expect(response.ok()).toBe(true);
    const headers = response.headers();
    const policy = headers["permissions-policy"] ?? "";
    const csp = headers["content-security-policy"] ?? "";

    expect(headers["origin-agent-cluster"]).toBe("?1");
    expect(policy).toBe(`tools=(self "${hubOrigin}")`);
    expect(csp).toContain(`frame-ancestors 'self' ${hubOrigin}`);
    expect(csp).not.toContain("*");
  }
});

test("SEC-004/005/010 rendered Hub, frames, URLs, and storage expose no server secrets", async ({
  page,
}) => {
  await page.goto("/plan");
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    0,
  );
  await page.getByText("See WebMCP in action").click();
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    3,
  );

  const publicText = [
    await page.content(),
    ...(await Promise.all(
      page
        .frames()
        .slice(1)
        .map((frame) => frame.locator("body").innerText()),
    )),
    ...(await page.evaluate(() =>
      performance.getEntriesByType("resource").map(({ name }) => name),
    )),
  ].join("\n");
  for (const marker of secretMarkers) expect(publicText).not.toContain(marker);

  for (const frame of page.frames()) {
    const storage = await frame.evaluate(() => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }));
    const serialized = JSON.stringify(storage);
    for (const marker of secretMarkers)
      expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain("idempotencyKey");
    expect(serialized).not.toContain("holdToken");
  }
});

test("SEC-013 public Site Tool schemas and search result expose no token or credential fields", async ({
  page,
}) => {
  const composed = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!composed.ok || !composed.candidates[0]) {
    throw new Error("canonical security bundle was not composed");
  }
  const data: FindOptionsData = {
    alternatives: composed.candidates.slice(1, 3),
    bundleSessionId: "security-site-tool-session",
    bundleVersion: 1,
    providerStatuses: { kiln: "ONLINE", loop: "ONLINE", nori: "ONLINE" },
    selectedBundle: composed.candidates[0],
  };
  await page.route("**/api/manual/search", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        data,
        meta: {
          completedAt: "2030-05-17T09:00:00.000Z",
          correlationId: "security-site-tool-correlation",
          origin: hubOrigin,
        },
        ok: true,
        schemaVersion: "1",
      },
    }),
  );

  await page.goto("/plan");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const context = (
          document as Document & { readonly modelContext?: SecurityPageContext }
        ).modelContext;
        if (!context) return [];
        return (await context.getTools()).map(({ name }) => name).sort();
      }),
    )
    .toEqual(
      [
        "confirm_bundle",
        "find_serendipity_options",
        "hold_bundle",
        "release_bundle",
        "show_bundle",
      ].sort(),
    );
  const evidence = await page.evaluate(async (input) => {
    const context = (
      document as Document & { readonly modelContext?: SecurityPageContext }
    ).modelContext;
    if (!context) throw new Error("WebMCP unavailable");
    const tools = await context.getTools();
    const search = tools.find(
      ({ name }) => name === "find_serendipity_options",
    );
    if (!search) throw new Error("product search tool unavailable");
    return {
      inventory: tools.map(({ inputSchema, name }) => ({ inputSchema, name })),
      result: JSON.parse(
        (await context.executeTool(search, JSON.stringify(input))) ?? "null",
      ) as unknown,
    };
  }, canonicalIntent);

  const serialized = JSON.stringify(evidence);
  for (const marker of secretMarkers) expect(serialized).not.toContain(marker);
  expect(serialized).not.toMatch(
    /"(?:holdToken|accessToken|providerAccessToken|authorization|serviceRoleKey|service_role_key|secret|token)"\s*:/i,
  );
  expect(evidence.result).toMatchObject({
    data: { bundleSessionId: "security-site-tool-session" },
    ok: true,
  });
});

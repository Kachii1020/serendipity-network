import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function loadProduct(page: Page) {
  await page.goto("/legacy/network-demo");
  await expect(
    page.getByRole("heading", { name: "What kind of tonight?" }),
  ).toBeVisible();
  await expect(page.locator(".provider-sticker")).toHaveCount(3);
}

test("UI-009/010 keyboard order, focus, live regions, and proof frames", async ({
  page,
}) => {
  await loadProduct(page);

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to the invitation" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeInViewport();

  const proof = page.getByText("See WebMCP in action");
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    0,
  );
  await proof.click();
  await expect(page.locator(".webmcp-proof")).toHaveAttribute("open", "");
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    3,
  );
  for (const frame of await page
    .locator("iframe[title$='live Provider page']")
    .all()) {
    await expect(frame).toHaveAttribute("tabindex", "0");
    await expect(frame).toHaveAttribute("aria-hidden", "false");
  }
  await expect(page.locator(".provider-strip")).toHaveAttribute(
    "aria-live",
    "polite",
  );

  await proof.click();
  await expect(page.locator("iframe[title$='live Provider page']")).toHaveCount(
    0,
  );
});

test("UI-011 has no serious or critical axe violations on the idle product", async ({
  page,
}) => {
  await loadProduct(page);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const material = result.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
  expect(material).toEqual([]);
});

test("IMP-003 keeps time and budget keyboard-accessible behind one disclosure", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await loadProduct(page);

  const disclosure = page.locator(".constraint-adjuster");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await disclosure.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");

  await page.getByRole("radio", { name: "18:30" }).check();
  await page.getByRole("radio", { name: "¥6,000" }).check();
  await expect(page.getByText("18:30 · ¥6,000")).toBeVisible();
  await expect(page.getByText(/from 18:30.*up to ¥6,000/)).toBeVisible();
  await expect(page.locator(".journey-primary")).toHaveCount(1);

  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);

  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
});

test("UI-012 reduced motion removes meaningful transition duration", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadProduct(page);

  const duration = await page
    .locator(".provider-sticker")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
});

for (const viewport of [
  { height: 900, width: 1440 },
  { height: 768, width: 1024 },
  { height: 844, width: 390 },
  { height: 720, width: 320 },
]) {
  test(`UI-013/019 reflows at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await loadProduct(page);

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    await expect(
      page.getByRole("button", { name: /Plan my night/ }),
    ).toBeVisible();
  });
}

test("UI-019 handles 200% text zoom without horizontal workflow overflow", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 640 });
  await loadProduct(page);
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });
  await page.locator(".constraint-adjuster summary").click();

  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  await expect(
    page.getByRole("button", { name: /Plan my night/ }),
  ).toBeVisible();
});

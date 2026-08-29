import { expect, test, type Locator, type Page } from "@playwright/test";

async function loadProductAt320(page: Page) {
  await page.setViewportSize({ height: 720, width: 320 });
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/legacy/network-demo");
  await expect(
    page.getByRole("heading", { name: "What kind of tonight?" }),
  ).toBeVisible();
}

async function expectNoInternalOverflow(locator: Locator) {
  const geometry = await locator.evaluate((element) => {
    const container = element.getBoundingClientRect();
    return {
      childrenFit: [...element.children].every((child) => {
        const box = child.getBoundingClientRect();
        return (
          box.left >= container.left - 1 && box.right <= container.right + 1
        );
      }),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.childrenFit).toBe(true);
}

test("UI-037 manual fallback notice wraps inside a 320px viewport", async ({
  page,
}) => {
  await loadProductAt320(page);

  const notice = page.locator(".manual-notice");
  await expect(notice).toBeVisible();
  await expectNoInternalOverflow(notice);
  await expectNoInternalOverflow(notice.locator("strong"));
});

test("UI-037 three Provider proof documents fit their narrow frames", async ({
  page,
}) => {
  await loadProductAt320(page);
  await page.locator(".webmcp-proof > summary").click();

  const frames = page.locator("iframe[title$='live Provider page']");
  await expect(frames).toHaveCount(3);

  for (const frameElement of await frames.all()) {
    await expect(frameElement).toHaveCSS("height", "320px");
    const frame = frameElement.contentFrame();
    await expect(frame.locator(".provider-embed")).toBeVisible();
    await expect(frame.locator(".provider-embed")).toHaveAttribute(
      "data-operation",
      /.+/,
    );

    const geometry = await frame.locator("html").evaluate(() => {
      const root = document.documentElement;
      const selectors = [
        ".provider-embed h1",
        ".provider-embed__states p:first-child",
        ".provider-embed__states p:nth-child(2)",
        ".provider-embed__latest",
      ];
      return {
        clientHeight: root.clientHeight,
        clientWidth: root.clientWidth,
        essentialsFit: selectors.every((selector) => {
          const element = document.querySelector(selector);
          if (!element) return false;
          const box = element.getBoundingClientRect();
          return (
            box.left >= -1 &&
            box.right <= window.innerWidth + 1 &&
            box.top >= -1 &&
            box.bottom <= window.innerHeight + 1
          );
        }),
        scrollHeight: root.scrollHeight,
        scrollWidth: root.scrollWidth,
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight);
    expect(geometry.essentialsFit).toBe(true);
  }
});

test("UI-037 standalone Provider home retains its 320px minimum", async ({
  page,
}) => {
  await loadProductAt320(page);
  await page.locator(".webmcp-proof > summary").click();
  const embedSource = await page
    .locator("iframe[title$='live Provider page']")
    .first()
    .getAttribute("src");
  expect(embedSource).not.toBeNull();

  await page.setViewportSize({ height: 720, width: 280 });
  await page.goto(new URL(embedSource!).origin);

  const providerHome = page.locator(".provider-home");
  await expect(providerHome).toBeVisible();
  await expect(providerHome).toHaveCSS("min-width", "320px");
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeGreaterThanOrEqual(320);
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
});

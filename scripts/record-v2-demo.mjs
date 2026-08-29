import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";

const origin = "https://serendipity-phase0-hub.vercel.app";
const outputDir = resolve(
  process.env.DEMO_CAPTURE_DIR ?? "/private/tmp/serendipity-v2-demo-capture",
);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--enable-features=WebMCP,WebMCPTesting",
    "--enable-blink-features=WebMCP",
  ],
});
const context = await browser.newContext({
  recordVideo: { dir: outputDir, size: { height: 900, width: 1440 } },
  viewport: { height: 900, width: 1440 },
});
const page = await context.newPage();

const pause = (milliseconds) => page.waitForTimeout(milliseconds);
const caption = async (text) => {
  await page.evaluate((value) => {
    let element = globalThis.document.querySelector(
      "#serendipity-demo-caption",
    );
    if (!element) {
      element = globalThis.document.createElement("div");
      element.id = "serendipity-demo-caption";
      Object.assign(element.style, {
        background: "#111",
        border: "2px solid #fff",
        borderRadius: "999px",
        boxShadow: "4px 4px 0 #6553e8",
        color: "#fff",
        font: "800 18px/1.2 system-ui, sans-serif",
        left: "50%",
        maxWidth: "1100px",
        padding: "12px 22px",
        position: "fixed",
        textAlign: "center",
        top: "20px",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
      });
      globalThis.document.body.append(element);
    }
    element.textContent = value;
  }, text);
};

const executeTool = async (name, input) =>
  page.evaluate(
    async ({ input, name }) => {
      const context = globalThis.document.modelContext;
      if (!context)
        throw new Error("WebMCP is unavailable in the demo browser");
      const tool = (await context.getTools()).find(
        (candidate) => candidate.name === name,
      );
      if (!tool) throw new Error(`Missing Site Tool: ${name}`);
      return JSON.parse(
        (await context.executeTool(tool, JSON.stringify(input))) ?? "null",
      );
    },
    { input, name },
  );

const date = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
}).format(new Date());
const intent = {
  area: "shibuya",
  endAt: `${date}T22:00:00+09:00`,
  excludedTags: ["alcohol", "smoking"],
  maxWalkMinutesPerLeg: 20,
  partySize: 1,
  preferredTags: ["art", "books", "quiet", "lively"],
  schemaVersion: "2",
  startAt: `${date}T17:00:00+09:00`,
  stopCount: "AUTO",
  totalBudgetYen: 5000,
};

try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await caption(
    "One free evening. Real places, prices, hours, and sources in one plan.",
  );
  await pause(6500);

  await page.getByRole("button", { name: /Build my evening/ }).click();
  await page.getByRole("heading", { name: /sourced stops/i }).waitFor();
  await caption(
    "The human path returns one schedule-fit route—without claiming a booking.",
  );
  await pause(6500);

  const firstStop = page.locator(".v2-stop").first();
  await firstStop.scrollIntoViewIfNeeded();
  await firstStop.locator(".v2-source-details summary").click();
  await firstStop.getByText("Price", { exact: true }).waitFor();
  await caption(
    "Every address, opening window, and reference price opens to its evidence.",
  );
  await pause(7500);

  await page.goto(`${origin}/plan`, { waitUntil: "networkidle" });
  await caption(
    "With WebMCP, an AI assistant uses the same five validated planner actions.",
  );
  const found = await executeTool("find_evening_plan", intent);
  if (!found.ok) throw new Error("The canonical Site Tool search failed");
  await page.getByRole("heading", { name: /sourced stops/i }).waitFor();
  await pause(6000);

  const first = found.data.plan.stops[0];
  const evidence = await executeTool("show_place_evidence", {
    candidateSetId: found.data.candidateSetId,
    placeId: first.place.placeId,
    planId: found.data.plan.planId,
    schemaVersion: "2",
  });
  if (!evidence.ok) throw new Error("The evidence Site Tool failed");
  await caption(
    "The agent can inspect evidence instead of scraping or guessing the interface.",
  );
  await pause(6500);

  const target = found.data.plan.stops.at(-1);
  const swapped = await executeTool("swap_plan_stop", {
    candidateSetId: found.data.candidateSetId,
    planId: found.data.plan.planId,
    preference: "DIFFERENT_INTEREST",
    schemaVersion: "2",
    targetPlaceId: target.place.placeId,
  });
  if (!swapped.ok) throw new Error("The swap Site Tool failed");
  await page.getByText(/Reference total .* walking .* min/).waitFor();
  await caption(
    "A one-stop swap visibly reconciles price, walking, and all downstream times.",
  );
  await pause(7000);

  const saved = await executeTool("save_plan", {
    candidateSetId: swapped.data.candidateSetId,
    planId: swapped.data.plan.planId,
    schemaVersion: "2",
  });
  if (!saved.ok) throw new Error("The save Site Tool failed");
  await page.getByRole("button", { name: "Plan saved" }).waitFor();
  await caption(
    "Save is explicit and browser-local. It never books or contacts a venue.",
  );
  await pause(6500);

  await page
    .getByText("How an AI assistant can help here", { exact: true })
    .click();
  await page.locator(".v2-agent-proof").scrollIntoViewIfNeeded();
  await caption(
    "The page records which safe action ran—and whether it was manual or a Site Tool.",
  );
  await pause(7000);

  await page.goto(origin, { waitUntil: "networkidle" });
  await caption(
    "Serendipity: a verifiable Shibuya plan, not another technical proof of concept.",
  );
  await pause(7500);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) process.stdout.write(`${await video.path()}\n`);
}

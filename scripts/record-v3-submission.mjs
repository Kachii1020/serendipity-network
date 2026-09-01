import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

const origin = "https://serendipity-phase0-hub.vercel.app";
const root = resolve(process.cwd());
const submissionDir = resolve(root, "submission");
const outputDir = resolve(submissionDir, "generated");
const audioManifest = JSON.parse(
  await readFile(resolve(outputDir, "audio-manifest.json"), "utf8"),
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
  recordVideo: { dir: outputDir, size: { height: 1080, width: 1920 } },
  viewport: { height: 1080, width: 1920 },
});
const page = await context.newPage();
const captureStartedAt = performance.now();
const sceneTimings = [];

const hold = (seconds) => page.waitForTimeout(seconds * 1000);
const scene = async (id, action) => {
  const manifest = audioManifest.scenes.find(
    (candidate) => candidate.id === id,
  );
  if (!manifest) throw new Error(`Missing audio manifest scene: ${id}`);
  const startedAtMs = Math.round(performance.now() - captureStartedAt);
  await page.evaluate(
    ({ id, title }) => {
      let banner = globalThis.document.querySelector(
        "#serendipity-video-scene",
      );
      if (!banner) {
        banner = globalThis.document.createElement("div");
        banner.id = "serendipity-video-scene";
        Object.assign(banner.style, {
          alignItems: "center",
          background: "#111",
          border: "2px solid #111",
          borderRadius: "999px",
          bottom: "28px",
          boxShadow: "4px 4px 0 #654be6",
          color: "#fff",
          display: "flex",
          font: "800 22px/1.15 system-ui, sans-serif",
          gap: "12px",
          left: "50%",
          maxWidth: "1500px",
          padding: "14px 24px",
          position: "fixed",
          transform: "translateX(-50%)",
          zIndex: "2147483647",
        });
        globalThis.document.body.append(banner);
      }
      banner.textContent = title;
      banner.dataset.scene = id;
    },
    { id, title: manifest.title },
  );
  const actionStartedAt = performance.now();
  await action();
  const actionSeconds = (performance.now() - actionStartedAt) / 1000;
  await hold(Math.max(1, manifest.renderSeconds - actionSeconds));
  sceneTimings.push({
    endMs: Math.round(performance.now() - captureStartedAt),
    id,
    startMs: startedAtMs,
  });
};

const executeTool = async (name, input) =>
  page.evaluate(
    async ({ input, name }) => {
      const modelContext = globalThis.document.modelContext;
      if (!modelContext) throw new Error("WebMCP testing context unavailable");
      const tool = (await modelContext.getTools()).find(
        (candidate) => candidate.name === name,
      );
      if (!tool) throw new Error(`Missing Site Tool: ${name}`);
      return JSON.parse(
        (await modelContext.executeTool(tool, JSON.stringify(input))) ?? "null",
      );
    },
    { input, name },
  );

const parts = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
}).formatToParts(new Date());
const read = (type) => Number(parts.find((part) => part.type === type)?.value);
const offset = read("hour") * 60 + read("minute") > 17 * 60 + 25 ? 1 : 0;
const serviceDate = new Date(
  Date.UTC(read("year"), read("month") - 1, read("day") + offset),
)
  .toISOString()
  .slice(0, 10);
const intent = {
  area: "ikebukuro",
  budgetPerPersonYen: 4000,
  endAt: `${serviceDate}T22:30:00+09:00`,
  excludedTags: [],
  includeMeal: true,
  interestPreset: "CALM_QUIET",
  maxWalkMinutesPerLeg: 20,
  partySize: 3,
  schemaVersion: "3",
  startAt: `${serviceDate}T17:30:00+09:00`,
};

let found;
let swapped;
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(() => globalThis.localStorage.clear());
  await scene("hook", async () => {
    await page.screenshot({
      path: resolve(submissionDir, "serendipity-cover.png"),
      type: "png",
    });
  });

  await scene("choices", async () => {
    await page.getByText("Ikebukuro", { exact: true }).click();
    await page.getByText("3 adults", { exact: true }).click();
    await page.locator("input[name='date']").fill(serviceDate);
    await page.screenshot({
      path: resolve(submissionDir, "gallery-01-inputs.png"),
      type: "png",
    });
  });

  await scene("analysis", async () => {
    await page.getByRole("button", { name: /Build my Tokyo plan/ }).click();
    await page.locator(".v3-progress").waitFor({ state: "visible" });
  });

  await page
    .getByRole("heading", { name: "Your Ikebukuro night" })
    .waitFor({ state: "visible" });
  await scene("route", async () => {
    await page.locator(".v3-result-title").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(submissionDir, "gallery-02-route.png"),
      type: "png",
    });
  });

  await scene("evidence", async () => {
    const meal = page.locator(".v3-stop").filter({ hasText: "MEAL" }).first();
    await meal.getByText("Sources & hours", { exact: true }).click();
    await meal.getByRole("heading", { name: /Sources for/ }).waitFor();
    await meal.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(submissionDir, "gallery-03-evidence.png"),
      type: "png",
    });
  });

  await scene("webmcp", async () => {
    await page.goto(`${origin}/plan`, { waitUntil: "networkidle" });
    found = await executeTool("find_evening_plan", intent);
    if (!found?.ok) throw new Error("WebMCP search failed");
    const meal = found.data.plan.stops.find(
      ({ place }) => place.role === "MEAL",
    );
    const reference = {
      candidateSetId: found.data.candidateSetId,
      planId: found.data.plan.planId,
      schemaVersion: "3",
    };
    await executeTool("show_place_evidence", {
      ...reference,
      area: "ikebukuro",
      placeId: meal.place.placeId,
    });
    swapped = await executeTool("swap_plan_stop", {
      ...reference,
      preference: "CHEAPER",
      targetPlaceId: meal.place.placeId,
    });
    if (!swapped?.ok) throw new Error("WebMCP swap failed");
    await page.getByText(/^AI tool activity/).click();
    await page
      .getByRole("list", { name: "Planner action activity" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(submissionDir, "gallery-04-webmcp.png"),
      type: "png",
    });
  });

  await scene("storage", async () => {
    const saved = await executeTool("save_plan", {
      candidateSetId: swapped.data.candidateSetId,
      planId: swapped.data.plan.planId,
      schemaVersion: "3",
    });
    if (!saved?.ok) throw new Error("WebMCP save failed");
    await page.getByText(/^Saved plans/).click();
    await hold(4);
    const deleted = await executeTool("delete_saved_plan", {
      planId: saved.data.savedPlanId,
      schemaVersion: "3",
    });
    if (!deleted?.ok) throw new Error("WebMCP delete failed");
  });

  await scene("close", async () => {
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const banner = globalThis.document.querySelector(
        "#serendipity-video-scene",
      );
      if (banner)
        banner.textContent = "SERENDIPITY · PUBLISHED, PLANNED, VERIFIABLE";
    });
  });
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const videoPath = await video.path();
    await writeFile(
      resolve(outputDir, "capture-manifest.json"),
      `${JSON.stringify({ sceneTimings, videoPath }, null, 2)}\n`,
    );
    process.stdout.write(`${videoPath}\n`);
  }
}

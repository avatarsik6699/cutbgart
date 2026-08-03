import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { phase33ImageCorpus } from "./support/v2/image-corpus";
import { previewComponent } from "./support/v2/preview";
import { uploadComponent } from "./support/v2/upload";

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ trace: "retain-on-failure" });

type RealCounters = {
  automatic: number;
  backgroundPreparations: number;
  backgroundCommits: number;
  enhancementRuns: number;
  enhancementCommits: number;
};

async function counters(page: Page): Promise<RealCounters> {
  return page.evaluate(() => {
    const value = window as Window & { __phase36RealCounters?: RealCounters };
    return (
      value.__phase36RealCounters ?? {
        automatic: 0,
        backgroundPreparations: 0,
        backgroundCommits: 0,
        enhancementRuns: 0,
        enhancementCommits: 0,
      }
    );
  });
}

async function waitForEnhancementTerminal(page: Page): Promise<"changed" | "unchanged"> {
  const toolButton = page.getByRole("button", { name: "Enhancements", exact: true });
  const noChange = page.getByText(/Nothing was added to document history/);
  await expect(toolButton.or(noChange)).toBeVisible({ timeout: 8 * 60_000 });
  if (await noChange.isVisible()) {
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    return "unchanged";
  }
  return "changed";
}

test("real Background and cold/warm Enhancement stages stay responsive and bounded", async ({
  context,
  page,
}) => {
  test.setTimeout(20 * 60_000);
  const modelResources = new Set<string>();
  context.on("request", (request) => {
    if (/vitmatte|onnxruntime|\.onnx(?:\?|$)/i.test(request.url()))
      modelResources.add(request.url());
  });
  await page.addInitScript(() => {
    const value = window as Window & { __phase36RealCounters?: RealCounters };
    value.__phase36RealCounters = {
      automatic: 0,
      backgroundPreparations: 0,
      backgroundCommits: 0,
      enhancementRuns: 0,
      enhancementCommits: 0,
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- invoked with Worker receiver.
    const nativePostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      const counters = value.__phase36RealCounters!;
      if (typeof message === "object" && message !== null && "type" in message) {
        if (message.type === "RUN" && "correlation" in message) {
          const correlation = message.correlation;
          if (
            typeof correlation === "object" &&
            correlation !== null &&
            "operationId" in correlation
          )
            counters.enhancementRuns += 1;
          else counters.automatic += 1;
        }
        if (message.type === "PREPARE_BACKGROUND_IMAGE")
          counters.backgroundPreparations += 1;
        if (
          message.type === "MATERIALIZE_SNAPSHOT" &&
          "correlation" in message &&
          typeof message.correlation === "object" &&
          message.correlation !== null &&
          "operation" in message.correlation
        ) {
          if (message.correlation.operation === "background")
            counters.backgroundCommits += 1;
          if (message.correlation.operation === "enhancement")
            counters.enhancementCommits += 1;
        }
      }
      Reflect.apply(
        nativePostMessage,
        this,
        options === undefined ? [message] : [message, options],
      );
    };
  });

  const upload = uploadComponent(page);
  const preview = previewComponent(page);
  await page.goto("/en/editor-v2");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
  await upload.choose(phase33ImageCorpus.representative.path);
  await expect(preview.image).toBeVisible({ timeout: 6 * 60_000 });

  await page.getByRole("button", { name: "Background", exact: true }).click();
  await page
    .getByLabel("Choose background image")
    .setInputFiles(phase33ImageCorpus.smoke.path);
  await expect(page.getByText("Background preview has unapplied changes.")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Document revision 2")).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(() => counters(page))
    .toMatchObject({
      automatic: 1,
      backgroundPreparations: 1,
      backgroundCommits: 1,
    });

  const gridButton = page.getByRole("button", { name: /Grid:/ });
  const firstGridLabel = await gridButton.textContent();
  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect
    .poll(async () => (await counters(page)).enhancementRuns)
    .toBeGreaterThan(0);
  await gridButton.click();
  await expect(gridButton).not.toHaveText(firstGridLabel ?? "");
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const firstOutcome = await waitForEnhancementTerminal(page);
  await expect.poll(async () => (await counters(page)).enhancementRuns).toBe(2);

  await page.getByRole("button", { name: "Enhancements", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const secondOutcome = await waitForEnhancementTerminal(page);
  await expect.poll(async () => (await counters(page)).enhancementRuns).toBe(4);
  expect((await counters(page)).enhancementCommits).toBe(
    [firstOutcome, secondOutcome].filter((outcome) => outcome === "changed").length,
  );
  expect(modelResources.size).toBeGreaterThan(0);
  const mattingResources = [...modelResources].filter((url) =>
    url.toLowerCase().includes("vitmatte"),
  );
  expect(mattingResources.length).toBeGreaterThan(0);
  expect(
    mattingResources.every((url) =>
      url.includes("358d428c452e5e0cd52955011a8b51944731d28e"),
    ),
  ).toBe(true);

  await preview.resetButton.click();
  await expect
    .poll(() =>
      page.locator("main").evaluate((element) => ({
        artifacts: Number(element.getAttribute("data-artifact-count")),
        leases: Number(element.getAttribute("data-lease-count")),
        objectUrls: Number(element.getAttribute("data-object-url-count")),
      })),
    )
    .toEqual({ artifacts: 0, leases: 0, objectUrls: 0 });
});

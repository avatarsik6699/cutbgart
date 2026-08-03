import type { Page } from "@playwright/test";

import {
  advanceMockEditorV2Stage,
  completeMockEditorV2Run,
  mockEditorV2RunCount,
} from "../mock-editor-v2-worker";

export function editorV2ScenarioDriver(page: Page) {
  return {
    stage: (stage: "model-loading" | "automatic-remove", fraction?: number) =>
      advanceMockEditorV2Stage(page, stage, fraction),
    completeRun: () => completeMockEditorV2Run(page),
    runCount: () => mockEditorV2RunCount(page),
    resourceCounts: () =>
      page.locator("main").evaluate((element) => ({
        artifacts: Number(element.getAttribute("data-artifact-count")),
        leases: Number(element.getAttribute("data-lease-count")),
        objectUrls: Number(element.getAttribute("data-object-url-count")),
      })),
  };
}

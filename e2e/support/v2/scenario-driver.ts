import type { Page } from "@playwright/test";

import {
  advanceMockEditorV2Stage,
  completeMockEditorV2Run,
  mockEditorV2RunCount,
  mockEditorV2ManualCommitCount,
  mockEditorV2MagicCommitCount,
  mockEditorV2MagicPredictionCount,
  mockEditorV2BackgroundCommitCount,
  mockEditorV2BackgroundPreparationCount,
  mockEditorV2EnhancementCommitCount,
  mockEditorV2EnhancementRunCount,
  completeMockEditorV2Enhancement,
  setMockEditorV2EnhancementOutcome,
} from "../mock-editor-v2-worker";

export function editorV2ScenarioDriver(page: Page) {
  return {
    stage: (stage: "model-loading" | "automatic-remove", fraction?: number) =>
      advanceMockEditorV2Stage(page, stage, fraction),
    completeRun: () => completeMockEditorV2Run(page),
    runCount: () => mockEditorV2RunCount(page),
    manualCommitCount: () => mockEditorV2ManualCommitCount(page),
    magicCommitCount: () => mockEditorV2MagicCommitCount(page),
    magicPredictionCount: () => mockEditorV2MagicPredictionCount(page),
    backgroundCommitCount: () => mockEditorV2BackgroundCommitCount(page),
    backgroundPreparationCount: () => mockEditorV2BackgroundPreparationCount(page),
    enhancementCommitCount: () => mockEditorV2EnhancementCommitCount(page),
    enhancementRunCount: () => mockEditorV2EnhancementRunCount(page),
    completeEnhancement: () => completeMockEditorV2Enhancement(page),
    setEnhancementOutcome: (outcome: "changed" | "unchanged" | "failed") =>
      setMockEditorV2EnhancementOutcome(page, outcome),
    resourceCounts: () =>
      page.locator("main").evaluate((element) => ({
        artifacts: Number(element.getAttribute("data-artifact-count")),
        leases: Number(element.getAttribute("data-lease-count")),
        objectUrls: Number(element.getAttribute("data-object-url-count")),
      })),
  };
}

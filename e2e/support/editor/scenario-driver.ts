import type { Page } from "@playwright/test";

import {
  advanceMockEditorStage,
  completeMockEditorRun,
  failMockEditorRun,
  mockEditorRunCount,
  mockEditorRunModelModes,
  mockEditorManualCommitCount,
  mockEditorMagicCommitCount,
  mockEditorMagicPredictionCount,
  mockEditorBackgroundCommitCount,
  mockEditorBackgroundPreparationCount,
  mockEditorEnhancementCommitCount,
  mockEditorEnhancementRunCount,
  completeMockEditorEnhancement,
  setMockEditorEnhancementOutcome,
} from "../mock-editor-worker";

export function editorScenarioDriver(page: Page) {
  return {
    stage: (stage: "model-loading" | "automatic-remove", fraction?: number) =>
      advanceMockEditorStage(page, stage, fraction),
    completeRun: () => completeMockEditorRun(page),
    failRun: () => failMockEditorRun(page),
    runCount: () => mockEditorRunCount(page),
    runModelModes: () => mockEditorRunModelModes(page),
    manualCommitCount: () => mockEditorManualCommitCount(page),
    magicCommitCount: () => mockEditorMagicCommitCount(page),
    magicPredictionCount: () => mockEditorMagicPredictionCount(page),
    backgroundCommitCount: () => mockEditorBackgroundCommitCount(page),
    backgroundPreparationCount: () => mockEditorBackgroundPreparationCount(page),
    enhancementCommitCount: () => mockEditorEnhancementCommitCount(page),
    enhancementRunCount: () => mockEditorEnhancementRunCount(page),
    completeEnhancement: () => completeMockEditorEnhancement(page),
    setEnhancementOutcome: (outcome: "changed" | "unchanged" | "failed") =>
      setMockEditorEnhancementOutcome(page, outcome),
    resourceCounts: () =>
      page.locator("main").evaluate((element) => ({
        artifacts: Number(element.getAttribute("data-artifact-count")),
        leases: Number(element.getAttribute("data-lease-count")),
        objectUrls: Number(element.getAttribute("data-object-url-count")),
      })),
  };
}

import { test as base } from "@playwright/test";

import { installMockEditorWorker, resetMockEditorWorker } from "../mock-editor-worker";
import { exportComponent } from "./export";
import { previewComponent } from "./preview";
import { progressComponent } from "./progress";
import { editorScenarioDriver } from "./scenario-driver";
import { uploadComponent } from "./upload";

type EditorFixture = {
  upload: ReturnType<typeof uploadComponent>;
  progress: ReturnType<typeof progressComponent>;
  preview: ReturnType<typeof previewComponent>;
  exportPng: ReturnType<typeof exportComponent>;
  scenario: ReturnType<typeof editorScenarioDriver>;
};

export const test = base.extend<{ editor: EditorFixture }>({
  editor: async ({ page }, applyFixture) => {
    await installMockEditorWorker(page);
    await applyFixture({
      upload: uploadComponent(page),
      progress: progressComponent(page),
      preview: previewComponent(page),
      exportPng: exportComponent(page),
      scenario: editorScenarioDriver(page),
    });
    await resetMockEditorWorker(page);
  },
});

export { expect } from "@playwright/test";

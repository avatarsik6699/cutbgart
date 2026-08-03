import { test as base } from "@playwright/test";

import {
  installMockEditorV2Worker,
  resetMockEditorV2Worker,
} from "../mock-editor-v2-worker";
import { exportComponent } from "./export";
import { previewComponent } from "./preview";
import { progressComponent } from "./progress";
import { editorV2ScenarioDriver } from "./scenario-driver";
import { uploadComponent } from "./upload";

type EditorV2Fixture = {
  upload: ReturnType<typeof uploadComponent>;
  progress: ReturnType<typeof progressComponent>;
  preview: ReturnType<typeof previewComponent>;
  exportPng: ReturnType<typeof exportComponent>;
  scenario: ReturnType<typeof editorV2ScenarioDriver>;
};

export const test = base.extend<{ editorV2: EditorV2Fixture }>({
  editorV2: async ({ page }, applyFixture) => {
    await installMockEditorV2Worker(page);
    await applyFixture({
      upload: uploadComponent(page),
      progress: progressComponent(page),
      preview: previewComponent(page),
      exportPng: exportComponent(page),
      scenario: editorV2ScenarioDriver(page),
    });
    await resetMockEditorV2Worker(page);
  },
});

export { expect } from "@playwright/test";

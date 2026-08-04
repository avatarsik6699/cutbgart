import type { Page } from "@playwright/test";

export function previewComponent(page: Page) {
  return {
    image: page.getByRole("img", {
      name: /Image (?:with|before and after) background remov|Изображение (?:без фона|до и после удаления фона)/,
    }),
    resetButton: page.getByRole("button", {
      name: /Start over|Back to upload|Начать заново|К загрузке/,
    }),
  };
}

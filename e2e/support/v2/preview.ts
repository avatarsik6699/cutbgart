import type { Page } from "@playwright/test";

export function previewComponent(page: Page) {
  return {
    image: page.getByRole("img", {
      name: /Image with background removed|Изображение без фона/,
    }),
    resetButton: page.getByRole("button", { name: /Start over|Начать заново/ }),
  };
}

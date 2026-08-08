import type { Page } from "@playwright/test";

export function progressComponent(page: Page) {
  return {
    cancelButton: page.getByRole("button", {
      name: /Back to upload|К загрузке/,
    }),
    retryButton: page.getByRole("button", { name: /Try again|Повторить/ }),
    currentStage: page.locator('[data-main-page-phase] > [role="status"]').first(),
  };
}

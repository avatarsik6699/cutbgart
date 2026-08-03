import type { Page } from "@playwright/test";

export function progressComponent(page: Page) {
  return {
    cancelButton: page.getByRole("button", { name: /Cancel|Отменить/ }),
    retryButton: page.getByRole("button", { name: /Retry|Повторить/ }),
    currentStage: page.locator('[aria-current="step"]'),
  };
}

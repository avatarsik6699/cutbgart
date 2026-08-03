import type { Page } from "@playwright/test";

export function exportComponent(page: Page) {
  const button = page.getByRole("button", { name: /Download PNG|Скачать PNG/ });
  return {
    button,
    async download() {
      const pending = page.waitForEvent("download");
      await button.click();
      return pending;
    },
  };
}

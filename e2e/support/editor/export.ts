import type { Page } from "@playwright/test";

export function exportComponent(page: Page) {
  const button = page
    .getByRole("button", {
      name: /^(?:Download(?: (?:committed )?PNG)?|Скачать(?: (?:сохранённый )?PNG)?)$/,
    })
    .first();
  return {
    button,
    async download() {
      const pending = page.waitForEvent("download");
      await button.click();
      return pending;
    },
  };
}

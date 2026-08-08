import type { Page } from "@playwright/test";

export function uploadComponent(page: Page) {
  const input = page.getByLabel(/Upload an image|Загрузить изображения/);
  return {
    input,
    choose: (file: string) => input.setInputFiles(file),
  };
}

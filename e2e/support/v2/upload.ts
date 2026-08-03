import type { Page } from "@playwright/test";

export function uploadComponent(page: Page) {
  const input = page.getByLabel(/Choose an image|Выбрать изображение/);
  return {
    input,
    choose: (file: string) => input.setInputFiles(file),
  };
}

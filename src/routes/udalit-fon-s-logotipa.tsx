import { createFileRoute } from "@tanstack/react-router";

import { LogoPage } from "../pages/logo";
import { SITE_URL, buildHowToJsonLd } from "../shared/lib/seo";

const PATH = "/udalit-fon-s-logotipa";

export const Route = createFileRoute("/udalit-fon-s-logotipa")({
  head: () => ({
    meta: [
      { title: "Удалить фон с логотипа онлайн — BG Remove App" },
      {
        name: "description",
        content:
          "Удалите фон с логотипа прямо в браузере — бесплатно, без регистрации, без загрузки на сервер.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${PATH}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildHowToJsonLd({
            name: "Как удалить фон с логотипа",
            description:
              "Пошаговая инструкция по удалению фона с изображения логотипа прямо в браузере.",
            url: `${SITE_URL}${PATH}`,
            steps: [
              {
                name: "Загрузите изображение",
                text: "Перетащите файл с логотипом или выберите его с устройства.",
              },
              {
                name: "Дождитесь обработки",
                text: "Модель удаления фона загрузится и обработает изображение прямо в браузере.",
              },
              {
                name: "Скачайте результат",
                text: "Сохраните готовый PNG с прозрачным фоном на устройство.",
              },
            ],
          }),
        ),
      },
    ],
  }),
  component: LogoPage,
});

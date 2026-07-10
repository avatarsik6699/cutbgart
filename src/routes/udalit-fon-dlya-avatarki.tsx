import { createFileRoute } from "@tanstack/react-router";

import { AvatarPage } from "../pages/avatar";
import { SITE_URL, buildHowToJsonLd } from "../shared/lib/seo";

const PATH = "/udalit-fon-dlya-avatarki";

export const Route = createFileRoute("/udalit-fon-dlya-avatarki")({
  head: () => ({
    meta: [
      { title: "Удалить фон для аватарки онлайн — BG Remove App" },
      {
        name: "description",
        content:
          "Удалите фон для аватарки прямо в браузере — бесплатно, без регистрации, без загрузки на сервер.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${PATH}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildHowToJsonLd({
            name: "Как удалить фон для аватарки",
            description:
              "Пошаговая инструкция по удалению фона с фото профиля прямо в браузере.",
            url: `${SITE_URL}${PATH}`,
            steps: [
              {
                name: "Загрузите фото",
                text: "Перетащите фото или выберите файл с устройства.",
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
  component: AvatarPage,
});

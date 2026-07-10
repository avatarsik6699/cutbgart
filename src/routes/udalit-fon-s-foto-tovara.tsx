import { createFileRoute } from "@tanstack/react-router";

import { ProductPhotoPage } from "../pages/product-photo";
import { SITE_URL, buildHowToJsonLd } from "../shared/lib/seo";

const PATH = "/udalit-fon-s-foto-tovara";

export const Route = createFileRoute("/udalit-fon-s-foto-tovara")({
  head: () => ({
    meta: [
      {
        title: "Удалить фон с фото товара онлайн бесплатно — BG Remove App",
      },
      {
        name: "description",
        content:
          "Удалите фон с фото товара для маркетплейса прямо в браузере — бесплатно, без регистрации, без загрузки на сервер.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${PATH}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildHowToJsonLd({
            name: "Как удалить фон с фото товара",
            description:
              "Пошаговая инструкция по удалению фона с фотографии товара для маркетплейса прямо в браузере.",
            url: `${SITE_URL}${PATH}`,
            steps: [
              {
                name: "Загрузите фото",
                text: "Перетащите фото товара в область загрузки или выберите файл с устройства.",
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
  component: ProductPhotoPage,
});

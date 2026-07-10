import { createFileRoute } from "@tanstack/react-router";

import { DocumentPhotoPage } from "../pages/document-photo";
import { SITE_URL, buildHowToJsonLd } from "../shared/lib/seo";

const PATH = "/udalit-fon-s-foto-na-dokumenty";

export const Route = createFileRoute("/udalit-fon-s-foto-na-dokumenty")({
  head: () => ({
    meta: [
      {
        title: "Удалить фон с фото на документы онлайн — BG Remove App",
      },
      {
        name: "description",
        content:
          "Удалите фон с фото на документы прямо в браузере — бесплатно, без регистрации, без загрузки на сервер.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${PATH}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildHowToJsonLd({
            name: "Как удалить фон с фото на документы",
            description:
              "Пошаговая инструкция по удалению фона с фотографии для документов прямо в браузере.",
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
                text: "Сохраните готовый PNG с прозрачным фоном и подложите нужный цвет фона перед подачей документа.",
              },
            ],
          }),
        ),
      },
    ],
  }),
  component: DocumentPhotoPage,
});

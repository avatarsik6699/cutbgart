import { createFileRoute } from "@tanstack/react-router";

import { AvatarPage } from "../pages/avatar";
import { SITE_URL, buildHowToJsonLd, buildSocialMeta } from "../shared/lib/seo";

const PATH = "/udalit-fon-dlya-avatarki";
const TITLE = "Удалить фон для аватарки онлайн — cutbg";
const DESCRIPTION =
  "Удалите фон для аватарки прямо в браузере — бесплатно, без регистрации, без загрузки на сервер.";

export const Route = createFileRoute("/udalit-fon-dlya-avatarki")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "ru",
      alternates: [
        { locale: "ru", path: PATH },
        { locale: "en", path: "/en/remove-background-from-avatar" },
      ],
    });
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        ...social.meta,
      ],
      links: social.links,
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
    };
  },
  component: AvatarPage,
});

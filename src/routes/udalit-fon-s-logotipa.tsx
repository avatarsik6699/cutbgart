import { createFileRoute } from "@tanstack/react-router";

import { LogoPage } from "../pages/logo";
import { SITE_URL, buildHowToJsonLd, buildSocialMeta } from "../shared/lib/seo";

const PATH = "/udalit-fon-s-logotipa";
const TITLE = "Удалить фон с логотипа онлайн — cutbg";
const DESCRIPTION =
  "Удалите фон с логотипа прямо в браузере — бесплатно, без регистрации, без загрузки на сервер.";

export const Route = createFileRoute("/udalit-fon-s-logotipa")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "ru",
      alternates: [
        { locale: "ru", path: PATH },
        { locale: "en", path: "/en/remove-background-from-logo" },
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
    };
  },
  component: LogoPage,
});

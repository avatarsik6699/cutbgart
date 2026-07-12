import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "../../pages/about";
import { buildSocialMeta } from "../../shared/lib/seo";

const PATH = "/en/about";
const TITLE = "About — cutbg";
const DESCRIPTION =
  "About cutbg: a free, anonymous, in-browser background-removal tool. How it works, the tech behind it, and the author.";

export const Route = createFileRoute("/en/about")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "en",
      alternates: [
        { locale: "ru", path: "/about" },
        { locale: "en", path: PATH },
      ],
    });
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        ...social.meta,
      ],
      links: social.links,
    };
  },
  component: AboutPage,
});

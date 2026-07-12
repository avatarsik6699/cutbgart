import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "../pages/about";
import { buildSocialMeta } from "../shared/lib/seo";

const PATH = "/about";
const TITLE = "About — cutbg";
const DESCRIPTION =
  "About cutbg: a free, anonymous, in-browser background-removal tool. How it works, the tech behind it, and the author.";

export const Route = createFileRoute("/about")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "ru",
      alternates: [
        { locale: "ru", path: PATH },
        { locale: "en", path: "/en/about" },
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

import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "../pages/about";
import { SITE_URL } from "../shared/lib/seo";

const PATH = "/about";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — BG Remove App" },
      {
        name: "description",
        content:
          "About BG Remove App: a free, anonymous, in-browser background-removal tool. How it works, the tech behind it, and the author.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${PATH}` }],
  }),
  component: AboutPage,
});

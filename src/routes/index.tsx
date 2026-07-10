import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "../pages/home";
import { SITE_URL, buildWebApplicationJsonLd } from "../shared/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remove Image Background — BG Remove App" },
      {
        name: "description",
        content:
          "Remove the background from a photo in your browser — upload, process, and download a transparent PNG. No sign-up, no upload to a server.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildWebApplicationJsonLd({
            name: "BG Remove App",
            url: SITE_URL,
            description:
              "Free, anonymous, in-browser background-removal tool. Upload a photo and download a transparent PNG — no sign-up, no server upload.",
          }),
        ),
      },
    ],
  }),
  component: HomePage,
});

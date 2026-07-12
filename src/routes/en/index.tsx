import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "../../pages/home";
import {
  SITE_URL,
  buildSocialMeta,
  buildWebApplicationJsonLd,
} from "../../shared/lib/seo";

const PATH = "/en";
const TITLE = "cutbg — Remove Image Background";
const DESCRIPTION =
  "Remove the background from a photo in your browser — upload, process, and download a transparent PNG. No sign-up, no upload to a server.";

export const Route = createFileRoute("/en/")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "en",
      alternates: [
        { locale: "ru", path: "/" },
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
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            buildWebApplicationJsonLd({
              name: "cutbg",
              url: `${SITE_URL}${PATH}`,
              description:
                "Free, anonymous, in-browser background-removal tool. Upload a photo and download a transparent PNG — no sign-up, no server upload.",
            }),
          ),
        },
      ],
    };
  },
  component: HomePage,
});

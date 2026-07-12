import { createFileRoute } from "@tanstack/react-router";

import { LogoPage } from "../../pages/logo";
import { SITE_URL, buildHowToJsonLd, buildSocialMeta } from "../../shared/lib/seo";

const PATH = "/en/remove-background-from-logo";
const TITLE = "Remove Background from a Logo Online, Free — cutbg";
const DESCRIPTION =
  "Turn a logo image into a transparent PNG by removing its background — free, right in your browser, no sign-up, no server upload.";

export const Route = createFileRoute("/en/remove-background-from-logo")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "en",
      alternates: [
        { locale: "ru", path: "/udalit-fon-s-logotipa" },
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
            buildHowToJsonLd({
              name: "How to remove the background from a logo",
              description:
                "Step-by-step instructions to remove the background from a logo image, right in your browser.",
              url: `${SITE_URL}${PATH}`,
              steps: [
                {
                  name: "Upload your logo",
                  text: "Drag your logo file into the upload area or choose it from your device.",
                },
                {
                  name: "Wait for processing",
                  text: "The background-removal model loads and processes the image right in your browser.",
                },
                {
                  name: "Download the result",
                  text: "Save the finished PNG with a transparent background to your device.",
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

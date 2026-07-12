import { createFileRoute } from "@tanstack/react-router";

import { DocumentPhotoPage } from "../../pages/document-photo";
import { SITE_URL, buildHowToJsonLd, buildSocialMeta } from "../../shared/lib/seo";

const PATH = "/en/remove-background-from-id-photo";
const TITLE = "Remove Background from an ID Photo Online, Free — cutbg";
const DESCRIPTION =
  "Remove the background from a passport, visa, or ID photo — free, right in your browser, no sign-up, no server upload.";

export const Route = createFileRoute("/en/remove-background-from-id-photo")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "en",
      alternates: [
        { locale: "ru", path: "/udalit-fon-s-foto-na-dokumenty" },
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
              name: "How to remove the background from an ID photo",
              description:
                "Step-by-step instructions to remove the background from an ID or document photo, right in your browser.",
              url: `${SITE_URL}${PATH}`,
              steps: [
                {
                  name: "Upload your photo",
                  text: "Drag your photo into the upload area or choose a file from your device.",
                },
                {
                  name: "Wait for processing",
                  text: "The background-removal model loads and processes the image right in your browser.",
                },
                {
                  name: "Download the result",
                  text: "Save the finished PNG with a transparent background, then place it over the required color before submitting your document.",
                },
              ],
            }),
          ),
        },
      ],
    };
  },
  component: DocumentPhotoPage,
});

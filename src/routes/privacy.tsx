import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "../pages/privacy";
import { buildSocialMeta } from "../shared/lib/seo";

const PATH = "/privacy";
const TITLE = "Privacy — cutbg";
const DESCRIPTION =
  "cutbg's privacy policy: your image is processed entirely on your device and never sent to a server. Aggregate-only analytics, minimal local storage.";

export const Route = createFileRoute("/privacy")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "ru",
      alternates: [
        { locale: "ru", path: PATH },
        { locale: "en", path: "/en/privacy" },
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
  component: PrivacyPage,
});

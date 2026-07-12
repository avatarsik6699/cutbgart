import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "../../pages/privacy";
import { buildSocialMeta } from "../../shared/lib/seo";

const PATH = "/en/privacy";
const TITLE = "Privacy — cutbg";
const DESCRIPTION =
  "cutbg's privacy policy: your image is processed entirely on your device and never sent to a server. Aggregate-only analytics, minimal local storage.";

export const Route = createFileRoute("/en/privacy")({
  head: () => {
    const social = buildSocialMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      locale: "en",
      alternates: [
        { locale: "ru", path: "/privacy" },
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
  component: PrivacyPage,
});

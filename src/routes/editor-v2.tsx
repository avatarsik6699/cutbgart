import { createFileRoute } from "@tanstack/react-router";

import { EditorV2Page } from "@/pages/editor-v2";

export const Route = createFileRoute("/editor-v2")({
  head: () => ({
    meta: [
      { title: "cutbg editor v2" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EditorV2Page,
});

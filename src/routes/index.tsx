import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "../pages/home";

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
  }),
  component: HomePage,
});

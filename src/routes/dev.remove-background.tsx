import { createFileRoute } from "@tanstack/react-router";

import { DevRemoveBackgroundPage } from "../pages/dev-remove-background";

export const Route = createFileRoute("/dev/remove-background")({
  head: () => ({
    meta: [
      { title: "remove-background dev harness" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevRemoveBackgroundPage,
});

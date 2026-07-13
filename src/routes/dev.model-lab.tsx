import { createFileRoute } from "@tanstack/react-router";

import { ModelLabPage } from "../pages/model-lab";

export const Route = createFileRoute("/dev/model-lab")({
  head: () => ({
    meta: [
      { title: "cutbg browser model evaluation lab" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ModelLabPage,
});

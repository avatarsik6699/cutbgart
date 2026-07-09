import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "../pages/home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "BG Remove App — hello world" }],
  }),
  component: HomePage,
});

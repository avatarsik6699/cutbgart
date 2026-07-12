import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    // Paraglide owns locale <-> URL mapping (SPEC.md §5.5): strip the /en
    // prefix before route matching, re-add it when building hrefs/links.
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

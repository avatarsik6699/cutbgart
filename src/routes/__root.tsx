/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../app/styles/globals.css?url";
import { ServiceWorkerRegistration } from "../app/service-worker-registration";
import { env } from "../shared/config";
import { getLocale } from "../paraglide/runtime";
import { ThemeProvider } from "../shared/lib";
import { NavigationProgress, TooltipProvider } from "../shared/ui";
import { NotFoundPage } from "../pages/not-found";
import { RouteErrorPage } from "../pages/route-error";

// Umami + Cloudflare Web Analytics (Phase 05, SPEC.md §7.6). Each script is
// only added when its env var is configured — unset in local dev, so dev
// stays script-free (`shared/config/env`).
const analyticsScripts = [
  ...(env.umamiScriptUrl && env.umamiWebsiteId
    ? [
        {
          src: env.umamiScriptUrl,
          defer: true,
          "data-website-id": env.umamiWebsiteId,
        },
      ]
    : []),
  ...(env.cfBeaconToken
    ? [
        {
          src: "https://static.cloudflareinsights.com/beacon.min.js",
          defer: true,
          "data-cf-beacon": JSON.stringify({ token: env.cfBeaconToken }),
        },
      ]
    : []),
];

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "cutbg" },
      { name: "theme-color", content: "#0A0C0E" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: analyticsScripts,
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ reset }) => <RouteErrorPage onRetry={reset} />,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={getLocale()} className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <ThemeProvider>
          <NavigationProgress />
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

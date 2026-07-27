import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "./paraglide/server";
import { securityHeaders } from "./shared/config/security-headers";

// Paraglide 2.21 initializes this storage lazily inside its async middleware.
// Two simultaneous cold-start requests can both observe it as missing and the
// second initialization then replaces the first request's active store.
// Warm up the same public middleware instance and serialize real requests
// behind it so Vite cannot split direct runtime imports into another module
// instance during development.
const paraglideReady = paraglideMiddleware(
  new Request("http://paraglide.local/"),
  () => new Response(null, { status: 204 }),
).then(() => undefined);

export default {
  async fetch(req: Request): Promise<Response> {
    await paraglideReady;
    // Pass the original `req`, not a modified one — required by Paraglide's
    // TanStack Start integration to avoid redirect loops (SPEC.md §5.5).
    const response = await paraglideMiddleware(req, () => handler.fetch(req));
    for (const [name, value] of Object.entries(securityHeaders)) {
      response.headers.set(name, value);
    }
    // Keep TanStack's original streaming Response. Re-wrapping its body after
    // paraglideMiddleware returns can schedule stream pulls outside the
    // request's AsyncLocalStorage locale context.
    return response;
  },
};

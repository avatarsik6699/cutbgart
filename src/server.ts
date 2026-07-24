import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "./paraglide/server";
import { securityHeaders } from "./shared/config/security-headers";

export default {
  async fetch(req: Request): Promise<Response> {
    // Pass the original `req`, not a modified one — required by Paraglide's
    // TanStack Start integration to avoid redirect loops (SPEC.md §5.5).
    const response = await paraglideMiddleware(req, () => handler.fetch(req));
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(securityHeaders)) {
      headers.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

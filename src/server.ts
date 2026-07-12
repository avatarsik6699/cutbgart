import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "./paraglide/server";

export default {
  fetch(req: Request): Promise<Response> {
    // Pass the original `req`, not a modified one — required by Paraglide's
    // TanStack Start integration to avoid redirect loops (SPEC.md §5.5).
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
};

import { Link } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";
import { buttonVariants, SiteShell } from "@/shared/ui";

/**
 * Root-route `notFoundComponent` (PHASE_31 T8 full-inventory finding —
 * `__root.tsx` previously had none, so an unmapped path fell back to
 * TanStack Router's bare `<p>Not Found</p>`).
 */
export function NotFoundPage() {
  return (
    <SiteShell>
      <main
        data-testid="not-found-page"
        className="mx-auto flex max-w-xl flex-col items-start gap-4 p-6 sm:p-8"
      >
        <h1 className="text-2xl font-semibold">{m.notFoundTitle()}</h1>
        <p className="text-sm text-muted-foreground">{m.notFoundBody()}</p>
        <Link to="/" className={buttonVariants({ variant: "default" })}>
          {m.notFoundGoHome()}
        </Link>
      </main>
    </SiteShell>
  );
}

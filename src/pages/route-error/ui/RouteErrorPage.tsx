import { Link } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";
import { Button, SiteShell, buttonVariants } from "@/shared/ui";

interface RouteErrorPageProps {
  onRetry: () => void;
}

/**
 * Root-route `errorComponent` (PHASE_31 T8 full-inventory finding —
 * `__root.tsx` previously had none, so an uncaught render/loader error had
 * no branded fallback).
 */
export function RouteErrorPage({ onRetry }: RouteErrorPageProps) {
  return (
    <SiteShell>
      <main
        data-testid="route-error-page"
        role="alert"
        className="mx-auto flex max-w-xl flex-col items-start gap-4 p-6 sm:p-8"
      >
        <h1 className="text-2xl font-semibold">{m.routeErrorTitle()}</h1>
        <p className="text-sm text-muted-foreground">{m.routeErrorBody()}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onRetry}>
            {m.routeErrorRetry()}
          </Button>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            {m.routeErrorGoHome()}
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}

import { m } from "@/paraglide/messages";
import { Button, SiteLink, Typography, buttonVariants } from "@/shared/ui";
import { SiteShell } from "@/widgets/site-shell";

type Props = {
  onRetry: () => void;
};

/**
 * Root-route `errorComponent` (PHASE_31 T8 full-inventory finding —
 * `__root.tsx` previously had none, so an uncaught render/loader error had
 * no branded fallback).
 */
export function RouteErrorPage(props: Props) {
  return (
    <SiteShell>
      <main
        data-testid="route-error-page"
        role="alert"
        className="mx-auto flex max-w-xl flex-col items-start gap-4 p-6 sm:p-8"
      >
        <Typography variant="page-title">{m.routeErrorTitle()}</Typography>
        <Typography variant="body-muted">{m.routeErrorBody()}</Typography>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={props.onRetry}>
            {m.routeErrorRetry()}
          </Button>
          <SiteLink
            to="/"
            variant="plain"
            className={buttonVariants({ variant: "outline" })}
          >
            {m.routeErrorGoHome()}
          </SiteLink>
        </div>
      </main>
    </SiteShell>
  );
}

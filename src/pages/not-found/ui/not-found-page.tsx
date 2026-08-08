import { m } from "@/paraglide/messages";
import { buttonVariants, SiteLink, Typography } from "@/shared/ui";
import { SiteShell } from "@/widgets/site-shell";

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
        <Typography variant="page-title">{m.notFoundTitle()}</Typography>
        <Typography variant="body-muted">{m.notFoundBody()}</Typography>
        <SiteLink
          to="/"
          variant="plain"
          className={buttonVariants({ variant: "default" })}
        >
          {m.notFoundGoHome()}
        </SiteLink>
      </main>
    </SiteShell>
  );
}

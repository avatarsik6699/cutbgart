import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";
import { SiteShell } from "@/widgets/site-shell";

/**
 * `/about` — concise project information (SPEC.md §5.1, does not block launch).
 * Static content only; does not compose the upload/remove-background
 * features (there is no product action to take on this page).
 */
export function AboutPage() {
  return (
    <SiteShell>
      <main
        data-testid="about-page"
        className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-8"
      >
        <header className="flex flex-col gap-2">
          <Typography variant="page-title">{m.aboutTitle()}</Typography>
          <Typography variant="body-muted">{m.aboutIntro()}</Typography>
          <Typography variant="caption-muted">{m.trustBadge()}</Typography>
        </header>

        <section className="flex flex-col gap-2">
          <Typography variant="section-title">{m.aboutHowHeading()}</Typography>
          <Typography variant="body-muted">{m.aboutHowBody()}</Typography>
        </section>
      </main>
    </SiteShell>
  );
}

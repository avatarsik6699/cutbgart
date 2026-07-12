import { m } from "@/paraglide/messages";
import { SiteShell } from "@/shared/ui";

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
          <h1 className="text-2xl font-semibold">{m.aboutTitle()}</h1>
          <p className="text-sm text-muted-foreground">{m.aboutIntro()}</p>
          <p className="text-xs text-muted-foreground">{m.trustBadge()}</p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{m.aboutHowHeading()}</h2>
          <p className="text-sm text-muted-foreground">{m.aboutHowBody()}</p>
        </section>
      </main>
    </SiteShell>
  );
}

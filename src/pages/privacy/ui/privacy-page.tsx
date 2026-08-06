import { m } from "@/paraglide/messages";
import { FeedbackLink, Typography } from "@/shared/ui";
import { SiteShell } from "@/widgets/site-shell";

/**
 * `/privacy` — static privacy-policy page (SPEC.md §7.2, §7.5, §7.6). Fulfils
 * the "image never leaves your device" claim that existed in the spec since
 * v1.0 but was never implemented through Phase 11.
 */
export function PrivacyPage() {
  return (
    <SiteShell>
      <main
        data-testid="privacy-page"
        className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-8"
      >
        <header className="flex flex-col gap-2">
          <Typography variant="page-title">{m.privacyTitle()}</Typography>
          <Typography variant="body-muted">{m.privacyIntro()}</Typography>
        </header>

        <section className="flex flex-col gap-2">
          <Typography variant="section-title">{m.privacyDeviceHeading()}</Typography>
          <Typography variant="body-muted">{m.privacyDeviceBody()}</Typography>
        </section>

        <section className="flex flex-col gap-2">
          <Typography variant="section-title">{m.privacyAnalyticsHeading()}</Typography>
          <Typography variant="body-muted">{m.privacyAnalyticsBody()}</Typography>
        </section>

        <section className="flex flex-col gap-2">
          <Typography variant="section-title">{m.privacyContactHeading()}</Typography>
          <Typography variant="body-muted">
            {m.privacyContactBody()} <FeedbackLink variant="inline" label="Telegram" />
          </Typography>
        </section>
      </main>
    </SiteShell>
  );
}

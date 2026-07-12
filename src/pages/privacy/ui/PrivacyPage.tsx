import { MessageCircle } from "lucide-react";

import { m } from "@/paraglide/messages";
import { SiteShell } from "@/shared/ui";

const TELEGRAM_FEEDBACK_URL = "https://t.me/+HaqBWI1A3vg4MWJi";

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
          <h1 className="text-2xl font-semibold">{m.privacyTitle()}</h1>
          <p className="text-sm text-muted-foreground">{m.privacyIntro()}</p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{m.privacyDeviceHeading()}</h2>
          <p className="text-sm text-muted-foreground">{m.privacyDeviceBody()}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{m.privacyAnalyticsHeading()}</h2>
          <p className="text-sm text-muted-foreground">{m.privacyAnalyticsBody()}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{m.privacyContactHeading()}</h2>
          <p className="text-sm text-muted-foreground">
            {m.privacyContactBody()}{" "}
            <a
              href={TELEGRAM_FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Telegram
            </a>
          </p>
        </section>
      </main>
    </SiteShell>
  );
}

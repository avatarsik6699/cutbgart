import { m } from "@/paraglide/messages";
import { SiteShell } from "@/shared/ui";
import { ToolWorkspace } from "@/widgets/tool-workspace";

/**
 * `/udalit-fon-s-logotipa` (ru) / `/en/remove-background-from-logo` (en) —
 * logo background-removal scenario (SPEC.md §5.1, required). Composes
 * `widgets/tool-workspace` (Phase 12 F4); all copy is locale-driven via the
 * message catalog (Phase 12 F12) so this one component serves both routes.
 */
export function LogoPage() {
  return (
    <SiteShell>
      <main
        data-testid="logo-page"
        className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8"
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{m.logoTitle()}</h1>
          <p className="text-sm text-muted-foreground">{m.logoLead()}</p>
          <p className="text-xs text-muted-foreground">{m.trustBadge()}</p>
        </header>

        <p className="text-sm text-muted-foreground">{m.logoBody1()}</p>
        <p className="text-sm text-muted-foreground">{m.logoBody2()}</p>

        <ToolWorkspace />

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg font-medium">{m.scenarioExampleHeading()}</h2>
          <img
            src="/images/logo-example.webp"
            alt={m.logoExampleAlt()}
            loading="lazy"
            width={960}
            height={540}
            className="w-full rounded-xl border border-border"
          />
          <p className="text-sm text-muted-foreground">{m.logoExampleCaption()}</p>
        </section>
      </main>
    </SiteShell>
  );
}

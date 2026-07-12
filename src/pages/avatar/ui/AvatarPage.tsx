import { m } from "@/paraglide/messages";
import { SiteShell } from "@/shared/ui";
import { ToolWorkspace } from "@/widgets/tool-workspace";

/**
 * `/udalit-fon-dlya-avatarki` (ru) / `/en/remove-background-from-avatar`
 * (en) — social profile picture scenario (SPEC.md §5.1, required). Composes
 * `widgets/tool-workspace` (Phase 12 F4); all copy is locale-driven via the
 * message catalog (Phase 12 F12) so this one component serves both routes.
 */
export function AvatarPage() {
  return (
    <SiteShell>
      <main
        data-testid="avatar-page"
        className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8"
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{m.avatarTitle()}</h1>
          <p className="text-sm text-muted-foreground">{m.avatarLead()}</p>
          <p className="text-xs text-muted-foreground">{m.trustBadge()}</p>
        </header>

        <p className="text-sm text-muted-foreground">{m.avatarBody1()}</p>
        <p className="text-sm text-muted-foreground">{m.avatarBody2()}</p>

        <ToolWorkspace />

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg font-medium">{m.scenarioExampleHeading()}</h2>
          <img
            src="/images/avatar-example.webp"
            alt={m.avatarExampleAlt()}
            loading="lazy"
            width={960}
            height={540}
            className="w-full rounded-xl border border-border"
          />
          <p className="text-sm text-muted-foreground">{m.avatarExampleCaption()}</p>
        </section>
      </main>
    </SiteShell>
  );
}

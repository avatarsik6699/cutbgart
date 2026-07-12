import { m } from "@/paraglide/messages";
import { SiteShell } from "@/shared/ui";
import { ToolWorkspace } from "@/widgets/tool-workspace";

/**
 * `/udalit-fon-s-foto-tovara` (ru) / `/en/remove-background-from-product-photo`
 * (en) — product/marketplace listing photo scenario (SPEC.md §5.1, required).
 * Composes `widgets/tool-workspace` (Phase 12 F4), the same reused
 * composition as `pages/home`; all copy is locale-driven via the message
 * catalog (Phase 12 F12) so this one component serves both routes.
 */
export function ProductPhotoPage() {
  return (
    <SiteShell>
      <main
        data-testid="product-photo-page"
        className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8"
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{m.productPhotoTitle()}</h1>
          <p className="text-sm text-muted-foreground">{m.productPhotoLead()}</p>
          <p className="text-xs text-muted-foreground">{m.trustBadge()}</p>
        </header>

        <p className="text-sm text-muted-foreground">{m.productPhotoBody1()}</p>
        <p className="text-sm text-muted-foreground">{m.productPhotoBody2()}</p>

        <ToolWorkspace />

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg font-medium">{m.scenarioExampleHeading()}</h2>
          <img
            src="/images/product-photo-example.webp"
            alt={m.productPhotoExampleAlt()}
            loading="lazy"
            width={1254}
            height={1254}
            className="mx-auto h-auto w-auto max-w-[min(100%,40rem)] rounded-xl border border-border"
          />
          <p className="text-sm text-muted-foreground">
            {m.productPhotoExampleCaption()}
          </p>
        </section>
      </main>
    </SiteShell>
  );
}

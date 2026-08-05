import { m } from "@/paraglide/messages";
import { PublicEditorWorkspace } from "@/widgets/public-editor";
import { SiteShell } from "@/shared/ui";

/**
 * `/udalit-fon-s-foto-na-dokumenty` (ru) / `/en/remove-background-from-id-photo`
 * (en) — ID/document photo scenario. The surrounding content stays
 * locale-driven while the editor uses the sole public v2 composition.
 */
export function DocumentPhotoPage() {
  return (
    <SiteShell>
      <main
        data-testid="document-photo-page"
        className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8"
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{m.documentPhotoTitle()}</h1>
          <p className="text-sm text-muted-foreground">{m.documentPhotoLead()}</p>
          <p className="text-xs text-muted-foreground">{m.trustBadge()}</p>
        </header>

        <p className="text-sm text-muted-foreground">{m.documentPhotoBody1()}</p>
        <p className="text-sm text-muted-foreground">{m.documentPhotoBody2()}</p>

        <PublicEditorWorkspace />

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg font-medium">{m.scenarioExampleHeading()}</h2>
          <img
            src="/images/document-photo-example.webp"
            alt={m.documentPhotoExampleAlt()}
            loading="lazy"
            width={1086}
            height={1448}
            className="mx-auto h-auto w-auto max-w-[min(100%,40rem)] rounded-xl border border-border"
          />
          <p className="text-sm text-muted-foreground">
            {m.documentPhotoExampleCaption()}
          </p>
        </section>
      </main>
    </SiteShell>
  );
}

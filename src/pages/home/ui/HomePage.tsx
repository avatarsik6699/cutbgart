import { Rocket, LockKeyhole, HandCoins } from "lucide-react";
import { m } from "@/paraglide/messages";
import { SiteShell } from "@/shared/ui";
import { ToolWorkspace } from "@/widgets/tool-workspace";
import { ModelStorageTrigger } from "@/features/model-storage";

const FEATURES = [
  { icon: LockKeyhole, title: m.heroFeatureClientTitle, body: m.heroFeatureClientBody },
  { icon: HandCoins, title: m.heroFeatureFreeTitle, body: m.heroFeatureFreeBody },
  { icon: Rocket, title: m.heroFeatureFastTitle, body: m.heroFeatureFastBody },
];

export function HomePage() {
  return (
    <SiteShell headerUtilitySlot={<ModelStorageTrigger />}>
      <main
        data-testid="home-page"
        className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12"
      >
        <ToolWorkspace
          emptyIntroSlot={
            <section className="flex h-full flex-col justify-center gap-7 py-4">
              <header className="flex flex-col items-start gap-5 text-left">
                <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
                  {m.heroHeadline()}
                </h1>
                <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {m.heroSubheadline()}
                </p>
              </header>
              <div className="grid gap-4">
                {FEATURES.map(({ icon: Icon, title, body }) => (
                  <div key={title()} className="flex max-w-xl gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card/80">
                      <Icon className="size-4 text-primary" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-sm font-medium">{title()}</h2>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {body()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          }
        />
      </main>
    </SiteShell>
  );
}

import { Rocket, LockKeyhole, HandCoins } from "lucide-react";
import { m } from "@/paraglide/messages";
import { SiteShell } from "@/shared/ui";
import { ToolWorkspace } from "@/widgets/tool-workspace";

const FEATURES = [
  { icon: LockKeyhole, title: m.heroFeatureClientTitle, body: m.heroFeatureClientBody },
  { icon: HandCoins, title: m.heroFeatureFreeTitle, body: m.heroFeatureFreeBody },
  { icon: Rocket, title: m.heroFeatureFastTitle, body: m.heroFeatureFastBody },
];

export function HomePage() {
  return (
    <SiteShell>
      <main
        data-testid="home-page"
        className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14"
      >
        <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            {m.trustBadge()}
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            {m.heroHeadline()}
          </h1>
          <p className="max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            {m.heroSubheadline()}
          </p>
        </header>

        <section className="mx-auto grid max-w-4xl gap-5 border-y py-5 sm:grid-cols-3 sm:gap-0 sm:divide-x">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title()} className="flex gap-3 sm:px-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-medium">{title()}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {body()}
                </p>
              </div>
            </div>
          ))}
        </section>

        <ToolWorkspace />
      </main>
    </SiteShell>
  );
}

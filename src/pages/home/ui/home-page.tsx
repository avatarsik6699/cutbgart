import { MainPageIntro, SiteShell } from "@/shared/ui";
import { ToolWorkspace } from "@/widgets/tool-workspace";
import { ModelStorageTrigger } from "@/features/model-storage";

export function HomePage() {
  return (
    <SiteShell headerUtilitySlot={<ModelStorageTrigger />}>
      <main
        data-testid="home-page"
        className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12"
      >
        <ToolWorkspace emptyIntroSlot={<MainPageIntro />} />
      </main>
    </SiteShell>
  );
}

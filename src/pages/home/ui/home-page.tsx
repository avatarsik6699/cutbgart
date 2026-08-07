import { PublicEditorWorkspace } from "@/widgets/public-editor";
import { SiteShell } from "@/widgets/site-shell";

export function HomePage() {
  return (
    <SiteShell homeNavigationActive variant="home">
      <PublicEditorWorkspace
        as="main"
        className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12"
      />
    </SiteShell>
  );
}

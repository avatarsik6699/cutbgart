import { m } from "@/paraglide/messages";
import { ScenarioPageLayout } from "@/shared/ui";
import { PublicEditorDiagnostics, PublicEditorWorkspace } from "@/widgets/public-editor";
import { SiteShell } from "@/widgets/site-shell";

/**
 * `/udalit-fon-s-logotipa` (ru) / `/en/remove-background-from-logo` (en) —
 * logo background-removal scenario. The surrounding content stays
 * locale-driven while the editor uses the sole public v2 composition.
 */
export function LogoPage() {
  return (
    <SiteShell HeaderUtilities={<PublicEditorDiagnostics />}>
      <ScenarioPageLayout
        body={[m.logoBody1(), m.logoBody2()]}
        example={{
          alt: m.logoExampleAlt(),
          caption: m.logoExampleCaption(),
          height: 1254,
          src: "/images/logo-example.webp",
          width: 1254,
        }}
        exampleHeading={m.scenarioExampleHeading()}
        lead={m.logoLead()}
        testId="logo-page"
        title={m.logoTitle()}
        trust={m.trustBadge()}
      >
        <PublicEditorWorkspace />
      </ScenarioPageLayout>
    </SiteShell>
  );
}

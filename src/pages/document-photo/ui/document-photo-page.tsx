import { m } from "@/paraglide/messages";
import { ScenarioPageLayout } from "@/shared/ui";
import { PublicEditorDiagnostics, PublicEditorWorkspace } from "@/widgets/public-editor";
import { SiteShell } from "@/widgets/site-shell";

/**
 * `/udalit-fon-s-foto-na-dokumenty` (ru) / `/en/remove-background-from-id-photo`
 * (en) — ID/document photo scenario. The surrounding content stays
 * locale-driven while the editor uses the sole public v2 composition.
 */
export function DocumentPhotoPage() {
  return (
    <SiteShell HeaderUtilities={<PublicEditorDiagnostics />}>
      <ScenarioPageLayout
        body={[m.documentPhotoBody1(), m.documentPhotoBody2()]}
        example={{
          alt: m.documentPhotoExampleAlt(),
          caption: m.documentPhotoExampleCaption(),
          height: 1448,
          src: "/images/document-photo-example.webp",
          width: 1086,
        }}
        exampleHeading={m.scenarioExampleHeading()}
        lead={m.documentPhotoLead()}
        testId="document-photo-page"
        title={m.documentPhotoTitle()}
        trust={m.trustBadge()}
      >
        <PublicEditorWorkspace />
      </ScenarioPageLayout>
    </SiteShell>
  );
}

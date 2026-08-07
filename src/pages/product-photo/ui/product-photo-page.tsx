import { m } from "@/paraglide/messages";
import { ScenarioPageLayout } from "@/shared/ui";
import { EditorWorkspace } from "@/widgets/editor";
import { SiteShell } from "@/widgets/site-shell";

/**
 * `/udalit-fon-s-foto-tovara` (ru) / `/en/remove-background-from-product-photo`
 * (en) — product/marketplace listing photo scenario. The surrounding content
 * stays locale-driven while the editor uses the sole public editor composition.
 */
export function ProductPhotoPage() {
  return (
    <SiteShell>
      <ScenarioPageLayout
        body={[m.productPhotoBody1(), m.productPhotoBody2()]}
        example={{
          alt: m.productPhotoExampleAlt(),
          caption: m.productPhotoExampleCaption(),
          height: 1254,
          src: "/images/product-photo-example.webp",
          width: 1254,
        }}
        exampleHeading={m.scenarioExampleHeading()}
        lead={m.productPhotoLead()}
        testId="product-photo-page"
        title={m.productPhotoTitle()}
        trust={m.trustBadge()}
      >
        <EditorWorkspace />
      </ScenarioPageLayout>
    </SiteShell>
  );
}

import { m } from "@/paraglide/messages";
import { ScenarioPageLayout } from "@/shared/ui";
import { PublicEditorWorkspace } from "@/widgets/public-editor";
import { SiteShell } from "@/widgets/site-shell";

/**
 * `/udalit-fon-dlya-avatarki` (ru) / `/en/remove-background-from-avatar`
 * (en) — social profile picture scenario. The surrounding content stays
 * locale-driven while the editor uses the sole public v2 composition.
 */
export function AvatarPage() {
  return (
    <SiteShell>
      <ScenarioPageLayout
        body={[m.avatarBody1(), m.avatarBody2()]}
        example={{
          alt: m.avatarExampleAlt(),
          caption: m.avatarExampleCaption(),
          height: 1254,
          src: "/images/avatar-example.webp",
          width: 1254,
        }}
        exampleHeading={m.scenarioExampleHeading()}
        lead={m.avatarLead()}
        testId="avatar-page"
        title={m.avatarTitle()}
        trust={m.trustBadge()}
      >
        <PublicEditorWorkspace />
      </ScenarioPageLayout>
    </SiteShell>
  );
}

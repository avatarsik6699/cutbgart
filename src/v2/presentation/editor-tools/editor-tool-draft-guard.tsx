import { m } from "@/paraglide/messages";
import { Button, Typography } from "@/shared/ui";

type Props = Readonly<{
  onContinue(): void;
  onDiscard(): void;
}>;

export function EditorToolDraftGuard(props: Props) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="editor-v2-draft-guard-title"
      aria-describedby="editor-v2-draft-guard-body"
      className="rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      data-testid="editor-draft-guard"
    >
      <Typography id="editor-v2-draft-guard-title" variant="heading-3" as="h2">
        {m.editorDraftGuardTitle()}
      </Typography>
      <Typography
        id="editor-v2-draft-guard-body"
        variant="body-small"
        as="p"
        className="mt-1"
      >
        {m.editorDraftGuardBody()}
      </Typography>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={props.onContinue}>
          {m.editorDraftContinue()}
        </Button>
        <Button type="button" variant="destructive" onClick={props.onDiscard}>
          {m.editorDraftDiscard()}
        </Button>
      </div>
    </div>
  );
}

import { m } from "@/paraglide/messages";
import { useDocumentActorSelectors } from "@/v2/presentation";
import type { ActiveEditorSessionSnapshot, EditorSession } from "@/v2/runtime-browser";
import { Typography } from "@/v2/shared/ui";

import { EditorV2DocumentPanel } from "./editor-v2-document-panel";
import { EditorV2Stage } from "./editor-v2-stage";

type Props = {
  grid: "fine" | "wide";
  session: EditorSession;
  snapshot: ActiveEditorSessionSnapshot;
};

export function EditorV2ActiveDocument(props: Props) {
  const document = useDocumentActorSelectors(props.snapshot.actor);
  return (
    <>
      <EditorV2DocumentPanel
        progress={document.progress}
        session={props.session}
        status={document.status}
      />
      <EditorV2Stage
        fileName={props.snapshot.fileName}
        grid={props.grid}
        height={props.snapshot.height}
        onFile={(file) => void props.session.importImage(file)}
        previewUrl={props.snapshot.previewUrl}
        resultUrl={props.snapshot.resultUrl}
        status={document.status}
        width={props.snapshot.width}
      />
      {document.status === "error" ? (
        <Typography
          variant="body-small"
          as="p"
          role="alert"
          className="text-destructive mt-4 lg:col-span-2"
        >
          {m.editorV2RuntimeFailure()}
        </Typography>
      ) : null}
    </>
  );
}

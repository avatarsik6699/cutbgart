import { useEffect } from "react";

import {
  MagicCutoutWorkspace,
  ManualCutoutWorkspace,
  useDocumentActorSelectors,
} from "@/v2/presentation";
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

  useEffect(
    function routeDocumentHistoryShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (
          document.manualDraft !== null ||
          document.magicDraft !== null ||
          !(event.ctrlKey || event.metaKey)
        )
          return;
        if (event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y") return;
        event.preventDefault();
        if (event.key.toLowerCase() === "y" || event.shiftKey)
          props.session.redoDocument();
        else props.session.undoDocument();
      }
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeDocumentHistoryShortcutsFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [document.magicDraft, document.manualDraft, props.session],
  );

  return (
    <>
      <EditorV2DocumentPanel
        progress={document.progress}
        session={props.session}
        status={document.status}
        canUndoDocument={document.canUndoDocument}
        canRedoDocument={document.canRedoDocument}
        manualOpen={document.manualDraft !== null}
        magicOpen={document.magicDraft !== null}
        revision={document.revision}
      />
      {document.magicDraft !== null && props.snapshot.previewUrl !== null ? (
        <MagicCutoutWorkspace
          candidates={document.magicCandidates}
          draft={document.magicDraft}
          height={props.snapshot.height}
          runtimeProgress={props.snapshot.magicProgress}
          session={props.session}
          sourceUrl={props.snapshot.previewUrl}
          width={props.snapshot.width}
        />
      ) : null}
      {document.magicDraft === null &&
      document.manualDraft !== null &&
      props.snapshot.previewUrl !== null ? (
        <ManualCutoutWorkspace
          height={props.snapshot.height}
          session={props.session}
          sourceUrl={props.snapshot.previewUrl}
          width={props.snapshot.width}
        />
      ) : null}
      {document.magicDraft === null && document.manualDraft === null ? (
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
      ) : null}
      {document.error !== null ? (
        <Typography
          variant="body-small"
          as="p"
          role="alert"
          className="text-destructive mt-4 lg:col-span-2"
        >
          {document.error}
        </Typography>
      ) : null}
    </>
  );
}

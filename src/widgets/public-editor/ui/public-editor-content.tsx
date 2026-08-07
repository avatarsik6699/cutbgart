import { useSelector } from "@xstate/react";

import {
  selectDocumentStatus,
  type DocumentMachineTypes,
  type DocumentSnapshotLike,
} from "@/v2/application";
import type { EditorSessionTypes } from "@/v2/runtime-browser";

import {
  useEditorSessionSelector,
  usePublicEditorViewSelector,
  type PublicEditorViewSnapshot,
} from "../model";
import { AutomaticProcessingConnector } from "./connectors/automatic-processing-connector";
import { CompletedDocumentConnector } from "./connectors/completed-document-connector";
import { ImageAdmissionConnector } from "./connectors/image-admission-connector";

const selectActiveActor = (
  snapshot: EditorSessionTypes.Snapshot,
): DocumentMachineTypes.ActorRef | null =>
  snapshot.kind === "document" ? snapshot.actor : null;
const selectBatchMode = (snapshot: PublicEditorViewSnapshot) => snapshot.batchMode;
const selectShowsDocumentWorkspace = (snapshot: DocumentSnapshotLike) =>
  snapshot.context.document.activeDraft !== null ||
  selectDocumentStatus(snapshot) === "result";

function ActiveDocumentContent(props: { actor: DocumentMachineTypes.ActorRef }) {
  const showsDocumentWorkspace = useSelector(props.actor, selectShowsDocumentWorkspace);
  return showsDocumentWorkspace ? (
    <CompletedDocumentConnector />
  ) : (
    <AutomaticProcessingConnector actor={props.actor} />
  );
}

export function PublicEditorContent() {
  const actor = useEditorSessionSelector(selectActiveActor);
  const batchMode = usePublicEditorViewSelector(selectBatchMode);
  if (actor !== null) return <ActiveDocumentContent actor={actor} />;
  if (batchMode) return <AutomaticProcessingConnector actor={null} />;
  return <ImageAdmissionConnector />;
}

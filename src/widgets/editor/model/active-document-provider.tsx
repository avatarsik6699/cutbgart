import { useState, type ReactNode } from "react";

import type { DocumentMachineTypes } from "@/editor/application";

import { ActiveDocumentContext } from "./active-document-context";
import { ActiveDocumentModel } from "./active-document-model";
import { useEditorModel } from "./editor-context";

export function ActiveDocumentProvider(props: {
  actor: DocumentMachineTypes.ActorRef;
  children: ReactNode;
}) {
  const editor = useEditorModel();
  const [model] = useState(() => new ActiveDocumentModel(editor, props.actor));

  return (
    <ActiveDocumentContext.Provider value={model}>
      {props.children}
    </ActiveDocumentContext.Provider>
  );
}

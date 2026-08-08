import { useEffect, useState, type ReactNode } from "react";

import type { EditorSessionTypes } from "@/editor/runtime";

import { EditorContext } from "./editor-context";
import { EditorModel } from "./editor-model";

type Props = Readonly<{
  children: ReactNode;
  sessionOptions?: EditorSessionTypes.Options;
}>;

export function EditorProvider(props: Props) {
  const [model] = useState(() => new EditorModel(props.sessionOptions));

  useEffect(
    function ownEditorModelFx() {
      model.hydrate();
      return () => {
        void model.dispose();
      };
    },
    [model],
  );

  return <EditorContext.Provider value={model}>{props.children}</EditorContext.Provider>;
}

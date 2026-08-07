import { useEffect, useState, type ReactNode } from "react";

import type { EditorSessionTypes } from "@/v2/runtime-browser";

import { PublicEditorModelContext } from "./public-editor-context";
import { PublicEditorModel } from "./public-editor-model";

type Props = Readonly<{
  children: ReactNode;
  sessionOptions?: EditorSessionTypes.Options;
}>;

export function PublicEditorModelProvider(props: Props) {
  const [model] = useState(() => new PublicEditorModel(props.sessionOptions));

  useEffect(
    function ownPublicEditorModelFx() {
      model.hydrate();
      return () => {
        void model.dispose();
      };
    },
    [model],
  );

  return (
    <PublicEditorModelContext.Provider value={model}>
      {props.children}
    </PublicEditorModelContext.Provider>
  );
}

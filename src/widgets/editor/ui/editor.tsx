import { useEffect, useRef } from "react";

import { useIsHydrated } from "@/shared/lib";
import type { EditorSessionTypes } from "@/editor/runtime";

import { EditorProvider, useEditorModel } from "../model";
import { EditorContent } from "./editor-content";

export type EditorProps = Readonly<{
  as?: "div" | "main";
  className?: string;
  sessionOptions?: EditorSessionTypes.Options;
}>;

type SurfaceProps = Omit<EditorProps, "sessionOptions">;

function EditorSurface(props: SurfaceProps) {
  const model = useEditorModel();
  const hydrated = useIsHydrated();
  const containerRef = useRef<HTMLDivElement>(null);
  const Container = props.as ?? "div";

  useEffect(
    function synchronizeResourceAttributesFx() {
      function updateResourceAttributes(): void {
        const container = containerRef.current;
        if (container === null) return;
        const resources = model.session.resources();
        container.dataset.artifactCount = String(resources.artifacts);
        container.dataset.leaseCount = String(resources.leases);
        container.dataset.objectUrlCount = String(resources.objectUrls);
      }

      updateResourceAttributes();
      return model.session.subscribe(updateResourceAttributes);
    },
    [model],
  );

  return (
    <Container
      ref={containerRef}
      data-testid="home-page"
      data-hydrated={hydrated}
      data-artifact-count="0"
      data-lease-count="0"
      data-object-url-count="0"
      className={props.className}
    >
      <EditorContent />
    </Container>
  );
}

export function EditorWorkspace(props: EditorProps) {
  return (
    <EditorProvider sessionOptions={props.sessionOptions}>
      <EditorSurface as={props.as} className={props.className} />
    </EditorProvider>
  );
}

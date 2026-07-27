import type { ReactNode } from "react";

import { m } from "@/paraglide/messages";

export interface EditorStageProps {
  children: ReactNode;
  documentId: string;
  loading?: boolean;
}

/**
 * Stable visual footprint shared by every editor tool. Tool changes replace
 * panel controls, not this stage or its image child.
 */
export function EditorStage({ children, documentId, loading = false }: EditorStageProps) {
  return (
    <section
      aria-label={m.editorStageLabel()}
      aria-busy={loading}
      data-testid="editor-stage"
      data-stage-document-id={documentId}
      className="editor-stage relative grid h-[20rem] place-items-center overflow-hidden rounded-2xl border bg-muted/25 p-3 sm:h-[28rem]"
    >
      {loading ? (
        <div
          className="size-full min-h-[18rem] animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
          data-testid="editor-stage-placeholder"
          aria-hidden="true"
        />
      ) : (
        <div className="grid size-full min-w-0 place-items-center">{children}</div>
      )}
    </section>
  );
}

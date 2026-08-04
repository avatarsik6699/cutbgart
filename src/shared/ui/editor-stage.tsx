import { useCallback, useEffect, useId, useState, type ReactNode } from "react";

import { m } from "@/paraglide/messages";

export type EditorStageProps = Readonly<{
  children: ReactNode;
  documentId: string;
  loading?: boolean;
  overlaySlot?: ReactNode | ((controls: EditorStageFullscreenControls) => ReactNode);
}>;

export type EditorStageFullscreenControls = Readonly<{
  expanded: boolean;
  toggleFullscreen: () => void;
}>;

/** Stable visual footprint shared by legacy and v2 main-page presentation. */
export function EditorStage(props: EditorStageProps) {
  const stageDomId = useId();
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [inlineExpandedDocumentId, setInlineExpandedDocumentId] = useState<string | null>(
    null,
  );
  const inlineExpanded = inlineExpandedDocumentId === props.documentId;
  const expanded = nativeFullscreen || inlineExpanded;

  useEffect(
    function observeNativeFullscreenFx() {
      function handleFullscreenChange() {
        setNativeFullscreen(document.fullscreenElement?.id === stageDomId);
      }
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () =>
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
    },
    [stageDomId],
  );

  useEffect(
    function guardInlineFullscreenFx() {
      if (!inlineExpanded) return;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      function handleEscape(event: KeyboardEvent) {
        if (event.key === "Escape") setInlineExpandedDocumentId(null);
      }
      window.addEventListener("keydown", handleEscape);
      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener("keydown", handleEscape);
      };
    },
    [inlineExpanded],
  );

  const toggleFullscreen = useCallback(() => {
    const stage = document.getElementById(stageDomId);
    if (!stage) return;
    if (document.fullscreenElement === stage) {
      void document.exitFullscreen();
      return;
    }
    if (inlineExpanded) {
      setInlineExpandedDocumentId(null);
      return;
    }
    if (document.fullscreenEnabled && stage.requestFullscreen) {
      void stage
        .requestFullscreen()
        .catch(() => setInlineExpandedDocumentId(props.documentId));
      return;
    }
    setInlineExpandedDocumentId(props.documentId);
  }, [props.documentId, inlineExpanded, stageDomId]);

  return (
    <section
      id={stageDomId}
      aria-label={m.editorStageLabel()}
      aria-busy={props.loading ?? false}
      data-testid="editor-stage"
      data-stage-document-id={props.documentId}
      data-expanded={expanded}
      data-inline-expanded={inlineExpanded}
      className={`editor-stage grid place-items-center overflow-hidden bg-muted/25 p-3 ${
        inlineExpanded
          ? "fixed inset-0 z-[80] h-[100dvh] rounded-none border-0 bg-background p-4"
          : "editor-stage-grid relative h-[clamp(22rem,62dvh,46rem)] rounded-lg border border-border"
      }`}
    >
      {props.loading ? (
        <div
          className="editor-stage-loading relative size-full cursor-wait overflow-hidden rounded-xl"
          data-testid="editor-stage-placeholder"
        >
          <div className="absolute inset-0 grid place-items-center">{props.children}</div>
        </div>
      ) : (
        <div className="grid size-full min-w-0 place-items-center [container-type:size]">
          {props.children}
        </div>
      )}
      {typeof props.overlaySlot === "function"
        ? props.overlaySlot({ expanded, toggleFullscreen })
        : props.overlaySlot}
    </section>
  );
}

import { useEffect, useRef } from "react";

import {
  BackgroundWorkspace,
  EnhancementWorkspace,
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

type ActiveTool = "manual" | "magic" | "background" | "enhancements" | null;

export function EditorV2ActiveDocument(props: Props) {
  const document = useDocumentActorSelectors(props.snapshot.actor);
  const lastToolLauncherRef = useRef<HTMLButtonElement>(null);
  const draftOpen =
    document.manualDraft !== null ||
    document.magicDraft !== null ||
    document.backgroundDraft !== null ||
    document.enhancementDraft !== null;
  const dirtyDraft =
    document.manualDraft?.dirty === true ||
    document.magicDraft?.dirty === true ||
    document.backgroundDraft?.dirty === true ||
    document.enhancementDraft?.dirty === true;
  const canApplyBackground =
    document.backgroundDraft?.dirty === true &&
    document.backgroundDraft.status !== "applying" &&
    props.snapshot.backgroundRuntime.status === "ready";
  const canApplyEnhancements =
    document.enhancementDraft !== null &&
    document.enhancementDraft.selectedOperationIds.length > 0 &&
    document.enhancementDraft.status !== "queued" &&
    document.enhancementDraft.status !== "running" &&
    document.enhancementDraft.status !== "applying";
  let activeTool: ActiveTool = null;
  if (document.manualDraft) activeTool = "manual";
  else if (document.magicDraft) activeTool = "magic";
  else if (document.backgroundDraft) activeTool = "background";
  else if (document.enhancementDraft) activeTool = "enhancements";
  const previousActiveToolRef = useRef<typeof activeTool>(null);

  useEffect(
    function restoreToolLauncherFocusFx() {
      const previousActiveTool = previousActiveToolRef.current;
      if (activeTool === null && previousActiveTool !== null)
        lastToolLauncherRef.current?.focus();
      previousActiveToolRef.current = activeTool;
    },
    [activeTool],
  );

  function beginManualFx(button: HTMLButtonElement): void {
    lastToolLauncherRef.current = button;
    props.session.beginManual();
  }

  function beginMagicFx(button: HTMLButtonElement): void {
    lastToolLauncherRef.current = button;
    props.session.beginMagic();
  }

  function beginBackgroundFx(button: HTMLButtonElement): void {
    lastToolLauncherRef.current = button;
    props.session.beginBackground();
  }

  function beginEnhancementsFx(button: HTMLButtonElement): void {
    lastToolLauncherRef.current = button;
    props.session.beginEnhancements();
  }

  useEffect(
    function routeDocumentHistoryShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (draftOpen || !(event.ctrlKey || event.metaKey)) return;
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
    [draftOpen, props.session],
  );

  useEffect(
    function routeFinishingDraftGuardsFx() {
      function beforeUnloadFx(event: BeforeUnloadEvent): void {
        if (!dirtyDraft) return;
        event.preventDefault();
        event.returnValue = "";
      }
      function keyDownFx(event: KeyboardEvent): void {
        if (document.backgroundDraft !== null) {
          if (event.key === "Escape") {
            event.preventDefault();
            props.session.cancelBackground();
          } else if (
            canApplyBackground &&
            (event.ctrlKey || event.metaKey) &&
            event.key === "Enter"
          ) {
            event.preventDefault();
            props.session.applyBackground();
          }
        } else if (document.enhancementDraft !== null) {
          if (event.key === "Escape") {
            event.preventDefault();
            props.session.cancelEnhancements();
          } else if (
            canApplyEnhancements &&
            (event.ctrlKey || event.metaKey) &&
            event.key === "Enter"
          ) {
            event.preventDefault();
            props.session.applyEnhancements();
          }
        }
      }
      globalThis.addEventListener("beforeunload", beforeUnloadFx);
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeFinishingDraftGuardsFx() {
        globalThis.removeEventListener("beforeunload", beforeUnloadFx);
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [
      canApplyBackground,
      canApplyEnhancements,
      dirtyDraft,
      document.backgroundDraft,
      document.enhancementDraft,
      props.session,
    ],
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
        backgroundOpen={document.backgroundDraft !== null}
        enhancementOpen={document.enhancementDraft !== null}
        revision={document.revision}
        onBeginManual={beginManualFx}
        onBeginMagic={beginMagicFx}
        onBeginBackground={beginBackgroundFx}
        onBeginEnhancements={beginEnhancementsFx}
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
      {document.backgroundDraft !== null && props.snapshot.foregroundUrl !== null ? (
        <BackgroundWorkspace
          draft={document.backgroundDraft}
          foregroundUrl={props.snapshot.foregroundUrl}
          height={props.snapshot.height}
          runtime={props.snapshot.backgroundRuntime}
          session={props.session}
          width={props.snapshot.width}
        />
      ) : null}
      {document.enhancementDraft !== null && props.snapshot.resultUrl !== null ? (
        <EnhancementWorkspace
          draft={document.enhancementDraft}
          height={props.snapshot.height}
          previewUrl={props.snapshot.resultUrl}
          runtime={props.snapshot.enhancementRuntime}
          session={props.session}
          width={props.snapshot.width}
        />
      ) : null}
      {!draftOpen ? (
        <EditorV2Stage
          fileName={props.snapshot.fileName}
          grid={props.grid}
          height={props.snapshot.height}
          onFiles={(files) => void props.session.importImages(files)}
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

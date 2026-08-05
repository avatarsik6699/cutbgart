import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import {
  EditorToolDraftGuard,
  EditorToolWorkspaceView,
  useDocumentActorSelectors,
  type CutoutPresentationMode,
  type BackgroundInteraction,
  type EditorToolId,
  type EditorToolWorkspaceIntent,
  type EditorToolWorkspaceProjection,
  type EnhancementInteraction,
  type MagicCutoutInteraction,
  type ManualCutoutInteraction,
} from "@/v2/presentation";
import {
  loadManualSourceBitmap,
  type ActiveEditorSessionSnapshot,
  type EditorSession,
  type ManualCutoutBox,
} from "@/v2/runtime-browser";
import { Typography } from "@/v2/shared/ui";
import { LocalExecutionReadout } from "@/widgets/tool-workspace";

import { EditorV2ToolWorkspace } from "./editor-v2-tool-workspace";

type Props = Readonly<{
  downloadSlot?: ReactNode;
  locale: "ru" | "en";
  onLeave(): void;
  session: EditorSession;
  snapshot: ActiveEditorSessionSnapshot;
  workspaceActionsSlot?: ReactNode;
}>;

type PendingNavigation =
  | Readonly<{ type: "tool"; tool: EditorToolId }>
  | Readonly<{ type: "cutout-mode"; mode: CutoutPresentationMode }>
  | Readonly<{ type: "leave" }>;

export function EditorV2ActiveDocument(props: Props) {
  const document = useDocumentActorSelectors(props.snapshot.actor);
  let initialTool: EditorToolId = "cutout";
  if (document.backgroundDraft !== null) initialTool = "background";
  else if (document.enhancementDraft !== null) initialTool = "enhance";
  const initialCutoutMode: CutoutPresentationMode = document.manualDraft
    ? "manual"
    : "magic";
  const [selectedTool, setSelectedTool] = useState<EditorToolId>(initialTool);
  const [selectedCutoutMode, setSelectedCutoutMode] =
    useState<CutoutPresentationMode>(initialCutoutMode);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(
    null,
  );
  const defaultToolRequestedRef = useRef(false);
  const magicApplyRequestedRef = useRef<string | null>(null);
  const magicStateRef = useRef({
    draft: document.magicDraft,
    candidates: document.magicCandidates,
  });
  const manualCanvasBindingRef = useRef<Readonly<{
    bitmap: ImageBitmap;
    canvas: HTMLCanvasElement;
    imageData: ImageData;
    version: number;
  }> | null>(null);
  const manualCanvasVersionRef = useRef(0);
  const subscribeActive = useCallback(
    function subscribeActiveDocument(listener: () => void): () => void {
      return props.session.subscribeActive(listener);
    },
    [props.session],
  );
  const draftHistoryFlags = useSyncExternalStore(
    subscribeActive,
    function readActiveDraftHistoryFlags(): number {
      const manual = props.session.manualDraft();
      const magic = props.session.magicDraft()?.snapshot() ?? null;
      const canUndo = manual?.canUndo === true || magic?.canUndo === true;
      const canRedo = manual?.canRedo === true || magic?.canRedo === true;
      return Number(canUndo) | (Number(canRedo) << 1);
    },
    function readServerDraftHistoryFlags(): number {
      return 0;
    },
  );
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
  const activeTool = selectedTool;
  const cutoutMode = selectedCutoutMode;
  const documentId =
    document.manualDraft?.documentId ??
    document.magicDraft?.documentId ??
    document.backgroundDraft?.documentId ??
    document.enhancementDraft?.documentId ??
    props.session.workspaceSnapshot().selectedDocumentId;
  const requestMagicApply = useCallback(
    function requestMagicApplyCommand(): void {
      const draft = magicStateRef.current.draft;
      if (draft === null || !draft.dirty) return;
      if (draft.selectedCandidateId !== null) {
        props.session.applyMagic();
        return;
      }
      magicApplyRequestedRef.current = `${draft.draftId}:${draft.draftRevision}`;
      props.session.predictMagic();
    },
    [props.session],
  );
  const toolInteractions = useMemo(
    function createToolInteractions() {
      function repaintManualCanvas(box?: ManualCutoutBox): void {
        const binding = manualCanvasBindingRef.current;
        const engine = props.session.manualDraft();
        if (binding === null || engine === null) return;
        const context = binding.canvas.getContext("2d");
        if (context === null) return;
        engine.applyAlpha(binding.imageData, box);
        if (box === undefined) {
          context.putImageData(binding.imageData, 0, 0);
          return;
        }
        context.putImageData(
          binding.imageData,
          0,
          0,
          box.minX,
          box.minY,
          box.maxX - box.minX + 1,
          box.maxY - box.minY + 1,
        );
      }

      const manual: ManualCutoutInteraction = {
        apply: () => props.session.applyManual(),
        begin: (point, brush) => {
          const box = props.session.manualDraft()?.begin(point, brush) ?? null;
          if (box !== null) repaintManualCanvas(box);
        },
        cancel: () => props.session.cancelManual(),
        cancelGesture: () => {
          const box = props.session.manualDraft()?.cancelGesture() ?? null;
          if (box !== null) {
            repaintManualCanvas(box);
            props.session.notifyManualDirty();
          }
        },
        connectCanvas: (canvas, sourceUrl, width, height) => {
          const version = manualCanvasVersionRef.current + 1;
          manualCanvasVersionRef.current = version;
          let active = true;
          manualCanvasBindingRef.current?.bitmap.close();
          manualCanvasBindingRef.current = null;
          void loadManualSourceBitmap(sourceUrl)
            .then(function bindManualCanvasFx(bitmap) {
              if (!active || version !== manualCanvasVersionRef.current) {
                bitmap.close();
                return;
              }
              const context = canvas.getContext("2d");
              if (context === null) {
                bitmap.close();
                return;
              }
              context.drawImage(bitmap, 0, 0, width, height);
              manualCanvasBindingRef.current = {
                bitmap,
                canvas,
                imageData: context.getImageData(0, 0, width, height),
                version,
              };
              repaintManualCanvas();
            })
            .catch(() => undefined);
          return function disconnectManualCanvasFx() {
            active = false;
            if (manualCanvasBindingRef.current?.version !== version) return;
            manualCanvasBindingRef.current.bitmap.close();
            manualCanvasBindingRef.current = null;
          };
        },
        end: () => {
          if (props.session.manualDraft()?.end() !== null) {
            props.session.notifyManualDirty();
          }
        },
        move: (point, brush) => {
          const box = props.session.manualDraft()?.move(point, brush) ?? null;
          if (box !== null) repaintManualCanvas(box);
        },
        readViewState: () => props.session.manualViewState(),
        redo: () => {
          const box = props.session.manualDraft()?.redo() ?? null;
          if (box !== null) {
            repaintManualCanvas(box);
            props.session.notifyManualDirty();
          }
        },
        snapshot: () => {
          const engine = props.session.manualDraft();
          return engine === null
            ? null
            : { canRedo: engine.canRedo, canUndo: engine.canUndo, dirty: engine.dirty };
        },
        undo: () => {
          const box = props.session.manualDraft()?.undo() ?? null;
          if (box !== null) {
            repaintManualCanvas(box);
            props.session.notifyManualDirty();
          }
        },
        writeViewState: (state) => props.session.setManualViewState(state),
      };
      const magic: MagicCutoutInteraction = {
        apply: requestMagicApply,
        appendPoint: (point) => {
          props.session.magicDraft()?.appendPoint(point);
        },
        beginStroke: (input) => props.session.magicDraft()?.beginStroke(input) ?? false,
        cancel: () => props.session.cancelMagic(),
        cancelStroke: () => {
          props.session.magicDraft()?.cancelStroke();
        },
        commitStroke: () => {
          const committed = props.session.magicDraft()?.commitStroke() ?? null;
          if (committed !== null) props.session.notifyMagicChanged();
          return committed !== null;
        },
        displayStrokes: () => props.session.magicDraft()?.displayStrokes() ?? [],
        readViewState: () => props.session.magicViewState(),
        redo: () => props.session.redoMagic(),
        snapshot: () => props.session.magicDraft()?.snapshot() ?? null,
        undo: () => props.session.undoMagic(),
        writeViewState: (state) => props.session.setMagicViewState(state),
      };
      const background: BackgroundInteraction = {
        apply: () => props.session.applyBackground(),
        cancel: () => props.session.cancelBackground(),
        change: (fill) => props.session.changeBackground(fill),
        selectImage: (file) => void props.session.selectBackgroundImage(file),
      };
      const enhancement: EnhancementInteraction = {
        apply: () => props.session.applyEnhancements(),
        cancel: () => props.session.cancelEnhancements(),
        change: (operationIds) => props.session.changeEnhancements(operationIds),
        retry: () => props.session.retryEnhancements(),
      };
      return { background, enhancement, magic, manual } as const;
    },
    [props.session, requestMagicApply],
  );

  useEffect(
    function syncMagicApplyStateFx() {
      magicStateRef.current = {
        draft: document.magicDraft,
        candidates: document.magicCandidates,
      };
    },
    [document.magicCandidates, document.magicDraft],
  );

  useEffect(
    function completeAutomaticMagicApplyFx() {
      const request = magicApplyRequestedRef.current;
      const draft = document.magicDraft;
      if (request === null) return;
      if (
        draft === null ||
        request !== `${draft.draftId}:${draft.draftRevision}` ||
        draft.status === "error"
      ) {
        magicApplyRequestedRef.current = null;
        return;
      }
      if (draft.status !== "preview") return;
      if (draft.selectedCandidateId === null) {
        const best = document.magicCandidates[0];
        if (best !== undefined) props.session.selectMagicCandidate(best.candidateId);
        return;
      }
      magicApplyRequestedRef.current = null;
      props.session.applyMagic();
    },
    [document.magicCandidates, document.magicDraft, props.session],
  );

  useEffect(
    function openSelectedToolFx() {
      if (draftOpen) {
        defaultToolRequestedRef.current = false;
        return;
      }
      if (document.status !== "result" || defaultToolRequestedRef.current) return;
      defaultToolRequestedRef.current = true;
      if (selectedTool === "background") props.session.beginBackground();
      else if (selectedTool === "enhance") props.session.beginEnhancements();
      else if (selectedCutoutMode === "manual") props.session.beginManual();
      else props.session.beginMagic();
    },
    [document.status, draftOpen, props.session, selectedCutoutMode, selectedTool],
  );

  useEffect(
    function routeDocumentHistoryShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (dirtyDraft || !(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y") return;
        event.preventDefault();
        if (document.manualDraft) props.session.cancelManual();
        else if (document.magicDraft) props.session.cancelMagic();
        else if (document.backgroundDraft) props.session.cancelBackground();
        else if (document.enhancementDraft) props.session.cancelEnhancements();
        if (event.key.toLowerCase() === "y" || event.shiftKey)
          props.session.redoDocument();
        else props.session.undoDocument();
      }
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeDocumentHistoryShortcutsFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [
      dirtyDraft,
      document.backgroundDraft,
      document.enhancementDraft,
      document.magicDraft,
      document.manualDraft,
      props.session,
    ],
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
            document.backgroundDraft.dirty &&
            document.backgroundDraft.status !== "applying" &&
            props.snapshot.backgroundRuntime.status === "ready" &&
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
            document.enhancementDraft.selectedOperationIds.length > 0 &&
            !["queued", "running", "applying"].includes(
              document.enhancementDraft.status,
            ) &&
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
      dirtyDraft,
      document.backgroundDraft,
      document.enhancementDraft,
      props.session,
      props.snapshot.backgroundRuntime.status,
    ],
  );

  function cancelActiveDraft(): void {
    if (document.manualDraft) props.session.cancelManual();
    else if (document.magicDraft) props.session.cancelMagic();
    else if (document.backgroundDraft) props.session.cancelBackground();
    else if (document.enhancementDraft) props.session.cancelEnhancements();
  }

  function startTool(tool: EditorToolId): void {
    setSelectedTool(tool);
    if (tool === "background") props.session.beginBackground();
    else if (tool === "enhance") props.session.beginEnhancements();
    else props.session.beginMagic();
  }

  function startCutoutMode(mode: CutoutPresentationMode): void {
    setSelectedTool("cutout");
    setSelectedCutoutMode(mode);
    if (mode === "manual") props.session.beginManual();
    else props.session.beginMagic();
  }

  function completeNavigation(navigation: PendingNavigation): void {
    cancelActiveDraft();
    if (navigation.type === "tool") startTool(navigation.tool);
    else if (navigation.type === "cutout-mode") startCutoutMode(navigation.mode);
    else props.onLeave();
  }

  function requestNavigation(navigation: PendingNavigation): void {
    if (dirtyDraft) setPendingNavigation(navigation);
    else completeNavigation(navigation);
  }

  function handleIntent(intent: EditorToolWorkspaceIntent): void {
    if (intent.type === "choose-tool") {
      if (intent.tool !== activeTool)
        requestNavigation({ type: "tool", tool: intent.tool });
    } else if (intent.type === "choose-cutout-mode") {
      if (intent.mode !== cutoutMode)
        requestNavigation({ type: "cutout-mode", mode: intent.mode });
    } else if (intent.type === "undo-document") {
      if (draftOpen && !dirtyDraft) cancelActiveDraft();
      props.session.undoDocument();
    } else if (intent.type === "redo-document") {
      if (draftOpen && !dirtyDraft) cancelActiveDraft();
      props.session.redoDocument();
    } else if (intent.type === "undo-draft") {
      if (document.manualDraft) toolInteractions.manual.undo();
      else if (document.magicDraft) toolInteractions.magic.undo();
    } else if (intent.type === "redo-draft") {
      if (document.manualDraft) toolInteractions.manual.redo();
      else if (document.magicDraft) toolInteractions.magic.redo();
    } else if (intent.type === "apply-active-tool") {
      if (document.manualDraft) props.session.applyManual();
      else if (document.magicDraft) props.session.applyMagic();
      else if (document.backgroundDraft) props.session.applyBackground();
      else if (document.enhancementDraft) props.session.applyEnhancements();
    } else if (intent.type === "cancel-active-tool") cancelActiveDraft();
    else if (intent.type === "retry-active-tool") props.session.retryEnhancements();
    else if (intent.type === "choose-background")
      props.session.changeBackground(intent.fill);
    else if (intent.type === "choose-enhancements")
      props.session.changeEnhancements(intent.operationIds);
    else if (intent.type === "download-committed") void props.session.exportPng();
    else if (intent.type === "leave-workspace") requestNavigation({ type: "leave" });
  }

  if (
    documentId === null ||
    props.snapshot.previewUrl === null ||
    props.snapshot.resultUrl === null
  ) {
    return null;
  }

  const busy = [
    "manual-applying",
    "magic-predicting",
    "magic-applying",
    "background-applying",
    "enhancement-queued",
    "enhancement-running",
    "enhancement-applying",
  ].includes(document.status);
  const projection: EditorToolWorkspaceProjection = {
    locale: props.locale,
    documentId,
    revision: document.revision,
    activeTool,
    cutoutMode,
    canUndoDraft: (draftHistoryFlags & 1) !== 0,
    canRedoDraft: (draftHistoryFlags & 2) !== 0,
    canUndoDocument: document.hasPastDocumentHistory,
    canRedoDocument: document.hasFutureDocumentHistory,
    dirtyDraft,
    busy,
    sourcePreviewUrl: props.snapshot.previewUrl,
    committedResultUrl: props.snapshot.resultUrl,
    width: props.snapshot.width,
    height: props.snapshot.height,
    manualDraft: document.manualDraft,
    magicDraft: document.magicDraft,
    backgroundDraft: document.backgroundDraft,
    enhancementDraft: document.enhancementDraft,
  };
  return (
    <EditorToolWorkspaceView
      projection={projection}
      onIntent={handleIntent}
      downloadSlot={
        props.downloadSlot ?? (
          <Button onClick={() => handleIntent({ type: "download-committed" })}>
            {m.editorV2DownloadPng()}
          </Button>
        )
      }
      statusSlot={
        <LocalExecutionReadout
          busy={busy}
          inferencePath={props.session.processingSelection()?.inferencePath ?? "wasm"}
        />
      }
      workspaceActionsSlot={props.workspaceActionsSlot}
      guardSlot={
        pendingNavigation ? (
          <EditorToolDraftGuard
            onContinue={() => setPendingNavigation(null)}
            onDiscard={() => {
              const navigation = pendingNavigation;
              setPendingNavigation(null);
              completeNavigation(navigation);
            }}
          />
        ) : undefined
      }
    >
      <EditorV2ToolWorkspace
        backgroundInteraction={toolInteractions.background}
        backgroundRuntime={props.snapshot.backgroundRuntime}
        enhancementInteraction={toolInteractions.enhancement}
        enhancementRuntime={props.snapshot.enhancementRuntime}
        fileName={props.snapshot.fileName}
        foregroundUrl={props.snapshot.foregroundUrl}
        magicInteraction={toolInteractions.magic}
        magicProgress={props.snapshot.magicProgress}
        manualInteraction={toolInteractions.manual}
        onCutoutModeChange={(mode) => handleIntent({ type: "choose-cutout-mode", mode })}
        onFiles={(files) => void props.session.importImages(files)}
        projection={projection}
        status={document.status}
      />
      {document.error !== null ? (
        <Typography
          variant="body-small"
          as="p"
          role="alert"
          className="text-destructive [grid-area:error]"
        >
          {document.error}
        </Typography>
      ) : null}
    </EditorToolWorkspaceView>
  );
}

import type { AutomaticModelMode } from "@/shared/lib";
import type { ExportSize } from "@/v2/domain";
export type { ExportSize } from "@/v2/domain";

export type MainPageEditorIntent =
  | { type: "choose-files"; files: readonly File[] }
  | { type: "choose-quality"; mode: AutomaticModelMode }
  | { type: "cancel" }
  | { type: "retry" }
  | { type: "reset" }
  | { type: "choose-export-size"; size: ExportSize }
  | { type: "download-selected" }
  | { type: "begin-manual" }
  | { type: "begin-magic" }
  | { type: "begin-background" }
  | { type: "begin-enhancements" }
  | { type: "undo-document" }
  | { type: "redo-document" }
  | { type: "focus-restored" };

export type MainPageEditorProjection = Readonly<{
  admissionError:
    | "unsupported-file"
    | "exceeds-size-limit"
    | "invalid-image"
    | "preparation-failed"
    | "multiple-files"
    | null;
  canRedoDocument: boolean;
  canUndoDocument: boolean;
  exportError: string | null;
  exportStatus: "idle" | "preparing" | "succeeded" | "cancelled" | "error";
  fallbackUsed: boolean;
  height: number | null;
  inferencePath: "webgpu" | "wasm";
  locale: "ru" | "en";
  phase: "empty" | "preparing" | "loading-model" | "processing" | "result" | "error";
  qualityMode: AutomaticModelMode;
  exportSize: ExportSize;
  progressPercent: number | null;
  retryable: boolean;
  restoreFocusTool: "manual" | "magic" | "background" | "enhancements" | null;
  revision: number;
  sourcePreviewUrl: string | null;
  committedResultUrl: string | null;
  width: number | null;
}>;

/**
 * The presentation owns no workflow state. It renders one immutable value and
 * reports user actions through this single boundary; the v2 adapter translates
 * those actions to application/runtime owners.
 */
export type MainPageEditorPresentationProps = Readonly<{
  projection: MainPageEditorProjection;
  onIntent: (intent: MainPageEditorIntent) => void;
}>;

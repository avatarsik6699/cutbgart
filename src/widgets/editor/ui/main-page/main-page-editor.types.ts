import type { AutomaticModelMode } from "@/shared/lib";
import type { DocumentId, WorkspaceItemId } from "@/editor/domain";
import type { EditorSessionTypes } from "@/editor/runtime";

export declare namespace MainPageEditorTypes {
  type Phase =
    "empty" | "preparing" | "loading-model" | "processing" | "result" | "error";

  type AdmissionError = EditorSessionTypes.ImportError | "multiple-files" | null;

  type RestoreFocusTool = "manual" | "magic" | "background" | "enhancements" | null;

  type BatchItemProjection = Readonly<{
    itemId: WorkspaceItemId;
    documentId: DocumentId | null;
    fileName: string;
    status: EditorSessionTypes.ItemStatus;
    error: Readonly<{ message: string; retryable: boolean }> | null;
    previewUrl: string | null;
    queuePosition: number | null;
    qualityMode: AutomaticModelMode;
    selected: boolean;
  }>;

  type BatchProjection = Readonly<{
    items: readonly BatchItemProjection[];
    capacity: Readonly<{ current: number; limit: 20 }>;
    admissionError: Readonly<{
      code: "capacity-exceeded";
      rejectedCount: number;
    }> | null;
    counts: Readonly<{
      active: number;
      queued: number;
      completed: number;
      failed: number;
    }>;
    export: EditorSessionTypes.BatchExportSnapshot;
  }>;

  type BatchActionsProjection = Readonly<{
    atCapacity: boolean;
  }>;
}

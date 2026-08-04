import type { WorkspaceItemId } from "@/v2/domain";

import type { EditorImportError } from "../editor-session/editor-session.types";
import type { PreparedImageImport } from "../editor-session/image-import-preparation";

export const WORKSPACE_ITEM_LIMIT = 20;
export const IMPORT_PREPARATION_CONCURRENCY = 2;

export type BatchImportTask = Readonly<{
  itemId: WorkspaceItemId;
  file: File;
}>;

export type BatchImportResult =
  | Readonly<{
      itemId: WorkspaceItemId;
      file: File;
      ok: true;
      value: PreparedImageImport;
    }>
  | Readonly<{
      itemId: WorkspaceItemId;
      file: File;
      ok: false;
      error: EditorImportError | "cancelled";
    }>;

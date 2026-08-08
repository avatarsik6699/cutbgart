import type { WorkspaceItemId } from "@/editor/domain";

import type { EditorSessionTypes } from "../editor-session/editor-session.types";
import type { PreparedImageImport } from "../editor-session/image-import-preparation";

export const WORKSPACE_ITEM_LIMIT = 20;
export const IMPORT_PREPARATION_CONCURRENCY = 2;

export declare namespace BatchImportTypes {
  type Task = Readonly<{
    itemId: WorkspaceItemId;
    file: File;
  }>;

  type Result =
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
        error: EditorSessionTypes.ImportError | "cancelled";
      }>;
}

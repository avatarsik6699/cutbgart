import { useCallback, useMemo, useState } from "react";

import type { EditDocumentScope } from "../../../entities/edit-document";
import type { ProcessedImage } from "../../../entities/processed-image";
import {
  commitProcessedImage,
  redoEdit,
  resetEditDocument,
  selectEditHistory,
  undoEdit,
  type CommitEditOptions,
} from "./editor-history";

export function useEditorHistory(
  initialScope: EditDocumentScope | null = null,
  locale: "en" | "ru" = "en",
) {
  const [scope, setScope] = useState(initialScope);
  const commit = useCallback((image: ProcessedImage, options: CommitEditOptions) => {
    setScope((current) =>
      current ? commitProcessedImage(current, image, options) : current,
    );
  }, []);
  const undo = useCallback(
    () => setScope((current) => (current ? undoEdit(current) : current)),
    [],
  );
  const redo = useCallback(
    () => setScope((current) => (current ? redoEdit(current) : current)),
    [],
  );
  const reset = useCallback(
    () => setScope((current) => (current ? resetEditDocument(current) : current)),
    [],
  );
  const selectors = useMemo(
    () =>
      selectEditHistory(
        scope?.history ?? { past: [], future: [], retainedHistoricalBytes: 0 },
        locale,
      ),
    [locale, scope],
  );
  return { scope, setScope, commit, undo, redo, reset, ...selectors };
}

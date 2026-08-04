import { useCallback, useRef } from "react";

import { useUploadPreparation } from "../model/use-upload-preparation";
import type { UploadResult } from "../model/types";
import { FileDropzone } from "./file-dropzone";

export type UploadDropzoneProps = {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  onUploads?: (results: Array<{ fileName: string; result: UploadResult }>) => void;
  onPreparationChange?: (fileCount: number) => void;
  batchMode?: boolean;
  className?: string;
};

/**
 * Full-area drag-and-drop / click-to-browse / clipboard-paste upload zone
 * (SPEC.md §1.3, §5.2). The real `<input type="file">` covers the whole zone
 * so it stays keyboard-accessible (Tab + Enter/Space opens the file dialog)
 * rather than being a visual-only drop target (SPEC.md §5.4). Hidden on
 * narrow viewports in favor of `ChoosePhotoButton`.
 */
export function UploadDropzone(props: UploadDropzoneProps) {
  // Guards the preparation counter against overlapping triggers (e.g. a
  // paste while a drop is still validating): only the most recent call's
  // `.finally` may zero the shared counter, so a newer in-flight upload's
  // count is never wiped out from under it (PHASE_31 T8, mirrors
  // `use-background-fill.ts`'s revision pattern).
  const revisionRef = useRef(0);
  const preparation = useUploadPreparation();
  const disabled = props.disabled ?? false;
  const batchMode = props.batchMode ?? false;

  const handleFile = useCallback(
    (file: File) => {
      revisionRef.current += 1;
      const revision = revisionRef.current;
      props.onPreparationChange?.(1);
      void preparation
        .prepareFile(file)
        .then((result) => {
          if (revisionRef.current === revision) props.onUpload(result);
        })
        .finally(() => {
          if (revisionRef.current === revision) props.onPreparationChange?.(0);
        });
    },
    [preparation, props],
  );

  const handleFiles = useCallback(
    (files: readonly File[]) => {
      if ((files.length === 1 && !batchMode) || !props.onUploads) {
        if (files[0]) handleFile(files[0]);
        return;
      }
      revisionRef.current += 1;
      const revision = revisionRef.current;
      props.onPreparationChange?.(files.length);
      void preparation
        .prepareFiles([...files])
        .then((results) => {
          if (revisionRef.current === revision) props.onUploads?.(results);
        })
        .finally(() => {
          if (revisionRef.current === revision) props.onPreparationChange?.(0);
        });
    },
    [batchMode, handleFile, preparation, props],
  );

  return (
    <FileDropzone className={props.className} disabled={disabled} onFiles={handleFiles} />
  );
}

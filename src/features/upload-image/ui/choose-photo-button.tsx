import { useCallback, useRef } from "react";

import { useUploadPreparation } from "../model/use-upload-preparation";
import type { UploadResult } from "../model/types";
import { ChooseFilesButton } from "./choose-files-button";

export type ChoosePhotoButtonProps = {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  onUploads?: (results: Array<{ fileName: string; result: UploadResult }>) => void;
  onPreparationChange?: (fileCount: number) => void;
  batchMode?: boolean;
  label?: string;
  className?: string;
};

/**
 * Mobile "choose photo" control with camera capture (`capture` attribute),
 * replacing the drag-and-drop zone on narrow viewports (SPEC.md §5.4).
 */
export function ChoosePhotoButton(props: ChoosePhotoButtonProps) {
  // Guards the preparation counter against overlapping triggers: only the
  // most recent call's `.finally` may zero the shared counter (PHASE_31 T8,
  // mirrors `use-background-fill.ts`'s revision pattern).
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

  return (
    <ChooseFilesButton
      className={props.className}
      disabled={disabled}
      label={props.label}
      onFiles={(files) => {
        if ((files.length > 1 || batchMode) && props.onUploads) {
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
        } else if (files[0]) {
          handleFile(files[0]);
        }
      }}
    />
  );
}

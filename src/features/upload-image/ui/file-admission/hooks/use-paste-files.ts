import { useEffect, useEffectEvent } from "react";

import type { FileAdmissionTypes } from "../file-admission.types";

export function usePasteFiles(params: FileAdmissionTypes.PasteParams): void {
  const { disabled = false, multiple = true } = params;
  const onFilesEvent = useEffectEvent(params.onFiles);

  useEffect(
    function registerPasteUploadFx() {
      if (disabled) return;

      function handlePaste(event: ClipboardEvent) {
        const items = event.clipboardData?.items;
        if (items === undefined) return;

        const files: File[] = [];
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (item?.kind !== "file") continue;
          const file = item.getAsFile();
          if (file === null) continue;
          files.push(file);
          if (!multiple) break;
        }
        if (files.length > 0) onFilesEvent(files);
      }

      window.addEventListener("paste", handlePaste);
      return function unregisterPasteUploadFx() {
        window.removeEventListener("paste", handlePaste);
      };
    },
    [disabled, multiple],
  );
}

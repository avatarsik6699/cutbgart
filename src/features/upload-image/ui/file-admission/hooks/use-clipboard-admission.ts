import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { m } from "@/paraglide/messages";

import type { FileAdmissionTypes } from "../file-admission.types";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

class ClipboardUnavailableError extends Error {}

function clipboardFile(blob: Blob, index: number): File {
  const extension = blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1];
  return new File([blob], `clipboard-${index + 1}.${extension ?? "png"}`, {
    type: blob.type,
  });
}

function permissionError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function clipboardReadErrorMessage(error: unknown): string {
  if (error instanceof ClipboardUnavailableError) return m.uploadClipboardUnavailable();
  if (permissionError(error)) return m.uploadClipboardPermissionDenied();
  return m.uploadClipboardFailed();
}

async function imageFilesFromClipboard(
  items: readonly ClipboardItem[],
  multiple: boolean,
  isCurrent: () => boolean,
): Promise<readonly File[] | null> {
  const files: File[] = [];
  for (const item of items) {
    const type = item.types.find((candidate) => ACCEPTED_IMAGE_TYPES.has(candidate));
    if (type === undefined) continue;
    const blob = await item.getType(type);
    if (!isCurrent()) return null;
    files.push(clipboardFile(blob, files.length));
    if (!multiple) break;
  }
  return files;
}

async function readClipboardImageFiles(
  multiple: boolean,
  isCurrent: () => boolean,
): Promise<readonly File[] | null> {
  const clipboard = navigator.clipboard;
  if (clipboard?.read === undefined) throw new ClipboardUnavailableError();
  const items = await clipboard.read();
  if (!isCurrent()) return null;
  return imageFilesFromClipboard(items, multiple, isCurrent);
}

export function useClipboardAdmission(
  params: FileAdmissionTypes.ClipboardParams,
): FileAdmissionTypes.ClipboardResult {
  const { disabled = false, multiple = true } = params;
  const onFiles = params.onFiles;
  const [feedback, setFeedback] = useState<FileAdmissionTypes.ClipboardFeedback>({
    kind: "idle",
  });
  const runRef = useRef(0);
  const onPasteFilesEvent = useEffectEvent(params.onFiles);

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
        if (files.length > 0) {
          setFeedback({ kind: "idle" });
          onPasteFilesEvent(files);
        }
      }

      window.addEventListener("paste", handlePaste);
      return function unregisterPasteUploadFx() {
        window.removeEventListener("paste", handlePaste);
      };
    },
    [disabled, multiple],
  );

  useEffect(
    function invalidateClipboardReadFx() {
      if (!disabled) return;
      runRef.current += 1;
    },
    [disabled],
  );

  useEffect(function cancelClipboardReadOnUnmountFx() {
    return () => {
      runRef.current += 1;
    };
  }, []);

  const readClipboard = useCallback(async () => {
    if (disabled) return;
    const run = runRef.current + 1;
    runRef.current = run;
    setFeedback({ kind: "reading", message: m.uploadClipboardReading() });

    try {
      const files = await readClipboardImageFiles(multiple, () => runRef.current === run);
      if (files === null) return;
      if (files.length === 0) {
        setFeedback({ kind: "error", message: m.uploadClipboardEmpty() });
        return;
      }
      setFeedback({ kind: "idle" });
      onFiles(files);
    } catch (error) {
      if (runRef.current !== run) return;
      setFeedback({
        kind: "error",
        message: clipboardReadErrorMessage(error),
      });
    }
  }, [disabled, multiple, onFiles]);

  return {
    feedback: disabled ? { kind: "idle" } : feedback,
    readClipboard,
  };
}

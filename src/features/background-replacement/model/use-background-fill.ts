import { useCallback, useEffect, useRef, useState } from "react";

import type { BackgroundFill, ProcessedImage } from "../../../entities/processed-image";
import { normalizeHexColor, TRANSPARENT_FILL } from "./types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sameFill(a: BackgroundFill, b: BackgroundFill): boolean {
  if (a.type === "color" && b.type === "color") return a.value === b.value;
  if (a.type === "gradient" && b.type === "gradient") {
    return (
      a.kind === b.kind &&
      a.stops[0].color === b.stops[0].color &&
      a.stops[1].color === b.stops[1].color
    );
  }
  if (a.type === "image" && b.type === "image") return a.blob === b.blob;
  return a.type === "transparent" && b.type === "transparent";
}

export async function prepareBackgroundImage(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported file format "${file.type || "unknown"}". Use JPEG, PNG, or WebP.`,
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 20MB.`,
    );
  }
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_DIMENSION) return file;
    const scale = MAX_DIMENSION / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the background image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not encode the background image.")),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}

/**
 * Preview is instant and CSS-only (`onPreview`, no worker call) so browsing
 * colors/gradients/images never blocks on canvas decode/PNG-encode work.
 * The worker-side recomposite (`onApply`) only ever runs once, on explicit
 * `save()` — encoding every intermediate value (even debounced) still meant
 * an encode after nearly every interaction and read as a persistent hang
 * (Phase 11 Architect Review Notes).
 */
export function useBackgroundFill({
  image,
  onPreview,
  onApply,
  onResult,
}: {
  // Deliberately narrower than `ProcessedImage`: this hook only ever reads
  // `source.blob`/`backgroundFill`. Accepting the full `ProcessedImage` here
  // (which carries `alphaMatte`'s multi-megapixel `Uint8ClampedArray`) would
  // put that buffer back on this identity-changing prop's path — the exact
  // "large typed array through a changing prop" freeze documented in
  // docs/KNOWN_GOTCHAS.md, this time triggered by every batch item switch.
  image: Pick<ProcessedImage, "source" | "backgroundFill">;
  onPreview: (fill: BackgroundFill) => void;
  onApply: (fill: BackgroundFill) => Promise<ProcessedImage>;
  onResult: (image: ProcessedImage) => void;
}) {
  const initialSavedFill = image.backgroundFill ?? TRANSPARENT_FILL;
  const [fill, setFill] = useState(initialSavedFill);
  // The last fill `onApply` actually encoded — compared against `fill` to
  // derive `dirty`. Kept as state (not a ref) because it must be read during
  // render; refs are only safe to read from effects/handlers (`react-hooks/refs`).
  const [savedFill, setSavedFill] = useState(initialSavedFill);
  const [saving, setSaving] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const revisionRef = useRef(0);
  const sourceRef = useRef(image.source.blob);
  const committedFillRef = useRef(initialSavedFill);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      revisionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const nextSavedFill = image.backgroundFill ?? TRANSPARENT_FILL;
    if (
      sourceRef.current === image.source.blob &&
      sameFill(committedFillRef.current, nextSavedFill)
    )
      return;
    sourceRef.current = image.source.blob;
    committedFillRef.current = nextSavedFill;
    revisionRef.current += 1;
    setFill(nextSavedFill);
    setSavedFill(nextSavedFill);
    setSaving(false);
    setPreparingImage(false);
    setError(null);
    onPreview(nextSavedFill);
  }, [image.backgroundFill, image.source.blob, onPreview]);

  const preview = useCallback(
    (nextFill: BackgroundFill) => {
      revisionRef.current += 1;
      setFill(nextFill);
      setError(null);
      onPreview(nextFill);
    },
    [onPreview],
  );

  const selectColor = useCallback(
    (value: string) => {
      const normalized = normalizeHexColor(value);
      preview(normalized ? { type: "color", value: normalized } : TRANSPARENT_FILL);
    },
    [preview],
  );

  const selectImage = useCallback(
    async (file: File) => {
      const revision = revisionRef.current + 1;
      revisionRef.current = revision;
      setPreparingImage(true);
      setError(null);
      try {
        const blob = await prepareBackgroundImage(file);
        if (mountedRef.current && revisionRef.current === revision) {
          const nextFill: BackgroundFill = { type: "image", blob };
          setFill(nextFill);
          onPreview(nextFill);
        }
      } catch (reason) {
        if (mountedRef.current && revisionRef.current === revision)
          setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (mountedRef.current && revisionRef.current === revision)
          setPreparingImage(false);
      }
    },
    [onPreview],
  );

  const dirty = !sameFill(fill, savedFill);

  const save = useCallback(async () => {
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    const nextFill = fill;
    setSaving(true);
    setError(null);
    try {
      const updated = await onApply(nextFill);
      if (mountedRef.current && revisionRef.current === revision) {
        const nextSavedFill = updated.backgroundFill ?? TRANSPARENT_FILL;
        committedFillRef.current = nextSavedFill;
        setFill(nextSavedFill);
        setSavedFill(nextSavedFill);
        onResult(updated);
      }
    } catch (reason) {
      if (mountedRef.current && revisionRef.current === revision) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (mountedRef.current && revisionRef.current === revision) setSaving(false);
    }
  }, [fill, onApply, onResult]);

  const cancel = useCallback(() => {
    revisionRef.current += 1;
    const committedFill = committedFillRef.current;
    setFill(committedFill);
    setSavedFill(committedFill);
    setSaving(false);
    setPreparingImage(false);
    setError(null);
    onPreview(committedFill);
  }, [onPreview]);

  return {
    fill,
    dirty,
    saving,
    // Exposes the whole draft/preparation window to the owning panel. Downloads
    // deliberately remain bound to the committed document while this is true.
    busy: saving || preparingImage || dirty,
    error,
    preview,
    selectColor,
    selectImage,
    save,
    cancel,
  };
}

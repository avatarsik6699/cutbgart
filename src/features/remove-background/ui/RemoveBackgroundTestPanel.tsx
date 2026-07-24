import { useEffect, useState } from "react";

import type { ProcessedImage, QualityMode } from "../../../entities/processed-image";
import { useBackgroundRemoval } from "../model/useBackgroundRemoval";

/**
 * Creates object URLs for a `ProcessedImage`'s source/result blobs and
 * revokes them on cleanup or when `result` changes — the canonical
 * synchronize-with-an-external-system effect
 * (https://react.dev/learn/synchronizing-with-effects), explicit
 * `URL.revokeObjectURL` release per SPEC.md's `ProcessedImage` contract.
 */
function useObjectUrls(result: ProcessedImage | null): {
  sourceUrl: string | null;
  resultUrl: string | null;
} {
  const [urls, setUrls] = useState<{
    sourceUrl: string | null;
    resultUrl: string | null;
  }>({
    sourceUrl: null,
    resultUrl: null,
  });

  useEffect(() => {
    if (!result) {
      return;
    }
    const sourceUrl = URL.createObjectURL(result.source.blob);
    const resultUrl = URL.createObjectURL(result.result);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing React state with externally-owned Blob URLs (an external system), not deriving state from props.
    setUrls({ sourceUrl, resultUrl });
    return () => {
      URL.revokeObjectURL(sourceUrl);
      URL.revokeObjectURL(resultUrl);
    };
  }, [result]);

  return result ? urls : { sourceUrl: null, resultUrl: null };
}

export interface RemoveBackgroundTestPanelProps {
  /** Passed through to `useBackgroundRemoval` (SPEC.md §5.2 — sourced from
   * `features/quality-mode-toggle`, not hardcoded). Falls back to the
   * device-detected default when omitted. */
  qualityMode?: QualityMode;
}

/**
 * Undesigned harness proving the `remove-background` pipeline end to end in
 * isolation (SPEC.md §8, Phase 02) — no design system exists yet (Phase 03).
 */
export function RemoveBackgroundTestPanel({
  qualityMode,
}: RemoveBackgroundTestPanelProps = {}) {
  const {
    state,
    deviceCapabilities,
    lightweightMode,
    selectFile,
    recomputeMaxQuality,
    retry,
    reset,
  } = useBackgroundRemoval(qualityMode);

  const { sourceUrl, resultUrl } = useObjectUrls(
    state.status === "result" ? state.result : null,
  );

  return (
    <main
      data-testid="remove-background-test-harness"
      className="mx-auto max-w-xl p-8 font-mono text-sm"
    >
      <h1 className="mb-4 text-lg font-semibold">remove-background — dev test harness</h1>

      <p className="mb-2">
        device: {deviceCapabilities ? deviceCapabilities.inferencePath : "detecting…"} ·
        default quality:{" "}
        {deviceCapabilities ? deviceCapabilities.defaultQualityMode : "—"}
      </p>

      {lightweightMode && (
        <p role="status" className="mb-4 border border-yellow-500 p-2">
          Running in lightweight mode — WebGPU is unavailable, using the slower WASM path.
        </p>
      )}

      <p className="mb-4">
        state: <strong>{state.status}</strong>
      </p>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={state.status === "model-loading" || state.status === "processing"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            selectFile(file);
          }
          event.target.value = "";
        }}
      />

      {state.status === "model-loading" && (
        <p className="mt-4">
          loading {state.qualityMode} model… {state.progress.toFixed(0)}%
        </p>
      )}

      {state.status === "processing" && <p className="mt-4">processing…</p>}

      {state.status === "result" && (
        <div className="mt-4">
          <p className="mb-2">quality mode: {state.result.qualityMode}</p>
          <div className="mb-2 flex gap-4">
            {sourceUrl && <img src={sourceUrl} alt="source" className="max-w-[200px]" />}
            {resultUrl && (
              <img
                src={resultUrl}
                alt="background removed result"
                className="max-w-[200px]"
              />
            )}
          </div>
          {resultUrl && (
            <a href={resultUrl} download="result.png" className="mr-4 underline">
              download
            </a>
          )}
          <button type="button" onClick={reset} className="mr-4 underline">
            process another image
          </button>
          {state.result.qualityMode !== "max" &&
            state.result.qualityMode !== "isnet-fp32" && (
              <button type="button" onClick={recomputeMaxQuality} className="underline">
                recompute in max quality
              </button>
            )}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-4 border border-red-500 p-2">
          <p className="mb-2">{state.error.message}</p>
          {state.error.action === "retry" ? (
            <button type="button" onClick={retry} className="underline">
              try again
            </button>
          ) : (
            <button type="button" onClick={reset} className="underline">
              reset
            </button>
          )}
        </div>
      )}
    </main>
  );
}

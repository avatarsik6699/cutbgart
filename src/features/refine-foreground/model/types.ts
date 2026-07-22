import type {
  AlphaMatte,
  PixelRect,
  RefinementConstraintMap,
  SourceImage,
} from "../../../entities/processed-image";

export type ForegroundRefinementStatus =
  "idle" | "preparing" | "refining" | "applying" | "fallback" | "result" | "error";

export type ForegroundCleanupPath = "decontaminate" | "edge-aware-fallback" | "unchanged";

export type ForegroundCleanupFallback =
  "none" | "no-soft-edge" | "no-background-samples" | "processing-failed";

export interface DirtyPixelPatch {
  bounds: PixelRect;
  /** Source-sized RGBA rows cropped to `bounds`, in row-major order. */
  rgba: Uint8ClampedArray;
}

export interface ForegroundRefinementRequest {
  requestId: string;
  source: SourceImage;
  matte: AlphaMatte;
  constraints: RefinementConstraintMap | null;
  componentCleanup?: boolean;
}

export interface ForegroundRefinementResult {
  /** Source-sized PNG colour layer. Its alpha bytes equal the decoded source. */
  foreground: Blob;
  /** Constraint-aware matte, never mutated after the result is posted. */
  matte: AlphaMatte;
  dirtyPatch: DirtyPixelPatch | null;
  requestedPath: "decontaminate";
  actualPath: ForegroundCleanupPath;
  fallback: ForegroundCleanupFallback;
  fallbackReason?: string;
  durationMs: number;
  /** Best-effort observation only; never inferred when the runtime omits it. */
  memoryBytes: number | "unavailable";
}

export type ForegroundRefinementErrorCode =
  "invalid-input" | "processing-failed" | "device-out-of-memory" | "cancelled";

export interface ForegroundRefinementError {
  code: ForegroundRefinementErrorCode;
  message: string;
  recoverable: boolean;
}

export type ForegroundRefinementWorkerRequest =
  | { type: "refine-foreground"; request: ForegroundRefinementRequest }
  | { type: "cancel"; requestId: string }
  | { type: "dispose"; requestId: string };

export type ForegroundRefinementWorkerResponse =
  | { type: "progress"; requestId: string; percent: number | null }
  | { type: "result"; requestId: string; result: ForegroundRefinementResult }
  | {
      type: "fallback";
      requestId: string;
      fallback: Exclude<ForegroundCleanupFallback, "none">;
      reason: string;
    }
  | { type: "error"; requestId: string; error: ForegroundRefinementError }
  | { type: "disposed"; requestId: string };

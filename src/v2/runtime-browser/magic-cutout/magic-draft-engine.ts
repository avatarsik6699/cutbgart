import type { DocumentId, MagicDraftId } from "@/v2/domain";

import type { MagicCutoutRuntimeTypes } from "./magic-cutout.types";

export const MAGIC_STROKE_LIMIT = 50;
export const MAGIC_STROKE_POINT_LIMIT = 512;

type MutableStroke = {
  id: string;
  mode: MagicCutoutRuntimeTypes.Stroke["mode"];
  points: MagicCutoutRuntimeTypes.Point[];
  radius: number;
};

function validPoint(point: MagicCutoutRuntimeTypes.Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function distanceSquared(
  left: MagicCutoutRuntimeTypes.Point,
  right: MagicCutoutRuntimeTypes.Point,
): number {
  const x = left.x - right.x;
  const y = left.y - right.y;
  return x * x + y * y;
}

function copyStroke(
  stroke: MagicCutoutRuntimeTypes.Stroke,
): MagicCutoutRuntimeTypes.Stroke {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })) };
}

export class MagicDraftEngine {
  readonly documentId: DocumentId;
  readonly draftId: MagicDraftId;
  readonly height: number;
  readonly width: number;
  readonly #strokes: MagicCutoutRuntimeTypes.Stroke[] = [];
  readonly #redo: MagicCutoutRuntimeTypes.Stroke[] = [];
  #activeStroke: MutableStroke | null = null;
  #disposed = false;
  #revision = 0;

  constructor(options: {
    documentId: DocumentId;
    draftId: MagicDraftId;
    width: number;
    height: number;
  }) {
    if (!Number.isSafeInteger(options.width) || options.width <= 0) {
      throw new Error("Magic draft width must be a positive integer");
    }
    if (!Number.isSafeInteger(options.height) || options.height <= 0) {
      throw new Error("Magic draft height must be a positive integer");
    }
    this.documentId = options.documentId;
    this.draftId = options.draftId;
    this.width = options.width;
    this.height = options.height;
  }

  beginStroke(input: MagicCutoutRuntimeTypes.StrokeStart): boolean {
    this.#assertUsable();
    if (
      this.#activeStroke !== null ||
      this.#strokes.length >= MAGIC_STROKE_LIMIT ||
      input.id.trim().length === 0 ||
      !validPoint(input.point) ||
      !Number.isFinite(input.radius) ||
      input.radius <= 0
    ) {
      return false;
    }
    this.#activeStroke = {
      id: input.id,
      mode: input.mode,
      points: [this.#normalizePoint(input.point)],
      radius: input.radius,
    };
    return true;
  }

  appendPoint(point: MagicCutoutRuntimeTypes.Point): boolean {
    this.#assertUsable();
    const stroke = this.#activeStroke;
    if (stroke === null || !validPoint(point)) return false;
    const normalized = this.#normalizePoint(point);
    const previous = stroke.points.at(-1);
    if (previous === undefined) return false;
    const minimumDistance = Math.max(0.75, stroke.radius * 0.08);
    if (distanceSquared(previous, normalized) < minimumDistance * minimumDistance) {
      return false;
    }

    if (stroke.points.length === MAGIC_STROKE_POINT_LIMIT) {
      stroke.points[stroke.points.length - 1] = normalized;
      return true;
    }
    stroke.points.push(normalized);
    return true;
  }

  commitStroke(): MagicCutoutRuntimeTypes.Stroke | null {
    this.#assertUsable();
    const stroke = this.#activeStroke;
    this.#activeStroke = null;
    if (stroke === null || stroke.points.length === 0) return null;
    const committed = copyStroke(stroke);
    this.#strokes.push(committed);
    this.#redo.length = 0;
    this.#advanceRevision();
    return copyStroke(committed);
  }

  cancelStroke(): boolean {
    this.#assertUsable();
    if (this.#activeStroke === null) return false;
    this.#activeStroke = null;
    return true;
  }

  undo(): MagicCutoutRuntimeTypes.Stroke | null {
    this.#assertUsable();
    if (this.#activeStroke !== null) return null;
    const stroke = this.#strokes.pop();
    if (stroke === undefined) return null;
    this.#redo.push(stroke);
    this.#advanceRevision();
    return copyStroke(stroke);
  }

  redo(): MagicCutoutRuntimeTypes.Stroke | null {
    this.#assertUsable();
    if (this.#activeStroke !== null || this.#strokes.length >= MAGIC_STROKE_LIMIT) {
      return null;
    }
    const stroke = this.#redo.pop();
    if (stroke === undefined) return null;
    this.#strokes.push(stroke);
    this.#advanceRevision();
    return copyStroke(stroke);
  }

  predictionStrokes(): readonly MagicCutoutRuntimeTypes.Stroke[] {
    this.#assertUsable();
    return this.#strokes.map(copyStroke);
  }

  displayStrokes(): readonly MagicCutoutRuntimeTypes.Stroke[] {
    this.#assertUsable();
    return [
      ...this.#strokes.map(copyStroke),
      ...(this.#activeStroke === null ? [] : [copyStroke(this.#activeStroke)]),
    ];
  }

  snapshot(): MagicCutoutRuntimeTypes.DraftSnapshot {
    return {
      documentId: this.documentId,
      draftId: this.draftId,
      revision: this.#revision,
      dirty: this.#strokes.length > 0,
      strokeCount: this.#strokes.length,
      redoCount: this.#redo.length,
      canUndo: !this.#disposed && this.#activeStroke === null && this.#strokes.length > 0,
      canRedo: !this.#disposed && this.#activeStroke === null && this.#redo.length > 0,
      gestureActive: this.#activeStroke !== null,
      disposed: this.#disposed,
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#activeStroke = null;
    this.#strokes.length = 0;
    this.#redo.length = 0;
  }

  #advanceRevision(): void {
    if (this.#revision === Number.MAX_SAFE_INTEGER) {
      throw new Error("Magic draft revision overflow");
    }
    this.#revision += 1;
  }

  #normalizePoint(point: MagicCutoutRuntimeTypes.Point): MagicCutoutRuntimeTypes.Point {
    return {
      x: Math.max(0, Math.min(this.width - 1, point.x)),
      y: Math.max(0, Math.min(this.height - 1, point.y)),
    };
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error("Magic draft is disposed");
  }
}

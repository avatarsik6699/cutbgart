import { brushBox, interpolatePoints, unionBox } from "./manual-cutout-geometry";
import type {
  ManualCutoutBox,
  ManualCutoutBrush,
  ManualCutoutPatch,
  ManualCutoutPoint,
} from "./manual-cutout.types";

export const MANUAL_DRAFT_PATCH_LIMIT = 20;

type ActiveGesture = {
  beforeAlpha: Uint8ClampedArray;
  box: ManualCutoutBox | null;
  differenceCount: number;
  last: ManualCutoutPoint;
};

function copyRegion(
  alpha: Uint8ClampedArray,
  width: number,
  box: ManualCutoutBox,
): Uint8ClampedArray {
  const boxWidth = box.maxX - box.minX + 1;
  const result = new Uint8ClampedArray(boxWidth * (box.maxY - box.minY + 1));
  for (let y = box.minY; y <= box.maxY; y += 1) {
    const sourceStart = y * width + box.minX;
    result.set(
      alpha.subarray(sourceStart, sourceStart + boxWidth),
      (y - box.minY) * boxWidth,
    );
  }
  return result;
}

export class ManualDraftEngine {
  readonly #baseline: Uint8ClampedArray;
  readonly #height: number;
  readonly #initial: Uint8ClampedArray;
  readonly #working: Uint8ClampedArray;
  readonly #width: number;
  #future: ManualCutoutPatch[] = [];
  #gesture: ActiveGesture | null = null;
  #past: ManualCutoutPatch[] = [];
  #differenceCount = 0;

  constructor(
    alpha: Uint8ClampedArray,
    width: number,
    height: number,
    baseline: Uint8ClampedArray = alpha,
  ) {
    if (
      width <= 0 ||
      height <= 0 ||
      alpha.length !== width * height ||
      baseline.length !== width * height
    ) {
      throw new Error("Manual draft alpha dimensions are invalid");
    }
    this.#baseline = baseline.slice();
    this.#initial = alpha.slice();
    this.#working = alpha.slice();
    this.#width = width;
    this.#height = height;
  }

  get canRedo(): boolean {
    return this.#future.length > 0;
  }
  get canUndo(): boolean {
    return this.#past.length > 0;
  }
  get dirty(): boolean {
    return this.#differenceCount > 0;
  }
  get width(): number {
    return this.#width;
  }
  get height(): number {
    return this.#height;
  }

  alphaCopy(): Uint8ClampedArray {
    return this.#working.slice();
  }

  applyAlpha(image: ImageData, box?: ManualCutoutBox): void {
    if (image.width !== this.#width || image.height !== this.#height) {
      throw new Error("Manual preview dimensions changed");
    }
    const region = box ?? {
      minX: 0,
      minY: 0,
      maxX: this.#width - 1,
      maxY: this.#height - 1,
    };
    for (let y = region.minY; y <= region.maxY; y += 1) {
      for (let x = region.minX; x <= region.maxX; x += 1) {
        const pixel = y * this.#width + x;
        image.data[pixel * 4 + 3] = this.#working[pixel] ?? 0;
      }
    }
  }

  begin(point: ManualCutoutPoint, brush: ManualCutoutBrush): ManualCutoutBox | null {
    if (this.#gesture !== null) this.cancelGesture();
    this.#gesture = {
      beforeAlpha: this.#working.slice(),
      box: null,
      differenceCount: this.#differenceCount,
      last: point,
    };
    return this.#stamp(point, brush);
  }

  move(point: ManualCutoutPoint, brush: ManualCutoutBrush): ManualCutoutBox | null {
    const gesture = this.#gesture;
    if (gesture === null) return null;
    let changed: ManualCutoutBox | null = null;
    for (const candidate of interpolatePoints(gesture.last, point, brush.radius)) {
      changed = unionBox(changed, this.#stamp(candidate, brush));
    }
    gesture.last = point;
    return changed;
  }

  end(): ManualCutoutPatch | null {
    const gesture = this.#gesture;
    this.#gesture = null;
    if (gesture?.box === null || gesture === null) return null;
    const patch = {
      box: gesture.box,
      before: copyRegion(gesture.beforeAlpha, this.#width, gesture.box),
      after: copyRegion(this.#working, this.#width, gesture.box),
    };
    if (patch.before.every((value, index) => value === patch.after[index])) return null;
    this.#past = [...this.#past, patch].slice(-MANUAL_DRAFT_PATCH_LIMIT);
    this.#future = [];
    return patch;
  }

  cancelGesture(): ManualCutoutBox | null {
    const gesture = this.#gesture;
    if (gesture === null) return null;
    this.#working.set(gesture.beforeAlpha);
    this.#differenceCount = gesture.differenceCount;
    this.#gesture = null;
    return gesture.box;
  }

  undo(): ManualCutoutBox | null {
    const patch = this.#past.at(-1);
    if (patch === undefined) return null;
    this.#writeRegion(patch.box, patch.before);
    this.#past = this.#past.slice(0, -1);
    this.#future = [...this.#future, patch];
    return patch.box;
  }

  redo(): ManualCutoutBox | null {
    const patch = this.#future.at(-1);
    if (patch === undefined) return null;
    this.#writeRegion(patch.box, patch.after);
    this.#future = this.#future.slice(0, -1);
    this.#past = [...this.#past, patch];
    return patch.box;
  }

  #stamp(point: ManualCutoutPoint, brush: ManualCutoutBrush): ManualCutoutBox | null {
    const box = brushBox(point, brush.radius, this.#width, this.#height);
    if (box === null) return null;
    const hardness = Math.min(1, Math.max(0, brush.hardness));
    for (let y = box.minY; y <= box.maxY; y += 1) {
      for (let x = box.minX; x <= box.maxX; x += 1) {
        const distance = Math.hypot(x - point.x, y - point.y) / brush.radius;
        if (distance >= 1) continue;
        const influence =
          distance <= hardness ? 1 : 1 - (distance - hardness) / (1 - hardness);
        const index = y * this.#width + x;
        const current = this.#working[index] ?? 0;
        const target = brush.mode === "erase" ? 0 : (this.#baseline[index] ?? 0);
        this.#setAlpha(index, Math.round(current + (target - current) * influence));
      }
    }
    if (this.#gesture !== null) this.#gesture.box = unionBox(this.#gesture.box, box);
    return box;
  }

  #setAlpha(index: number, value: number): void {
    const current = this.#working[index] ?? 0;
    const initial = this.#initial[index] ?? 0;
    if (current === initial && value !== initial) this.#differenceCount += 1;
    if (current !== initial && value === initial) this.#differenceCount -= 1;
    this.#working[index] = value;
  }

  #writeRegion(box: ManualCutoutBox, region: Uint8ClampedArray): void {
    const boxWidth = box.maxX - box.minX + 1;
    for (let y = box.minY; y <= box.maxY; y += 1) {
      for (let x = box.minX; x <= box.maxX; x += 1) {
        const regionIndex = (y - box.minY) * boxWidth + (x - box.minX);
        this.#setAlpha(y * this.#width + x, region[regionIndex] ?? 0);
      }
    }
  }
}

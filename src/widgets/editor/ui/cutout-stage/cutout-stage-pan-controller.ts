type Point = Readonly<{ x: number; y: number }>;

export type CutoutStagePanPointer = Readonly<{
  clientX: number;
  clientY: number;
  pointerId: number;
}>;

export class CutoutStagePanController {
  #content: HTMLDivElement | null = null;
  #pan: Point = { x: 0, y: 0 };
  #pointer: CutoutStagePanPointer | null = null;
  #zoom: number;

  constructor(initialZoom: number) {
    this.#zoom = initialZoom;
  }

  connect(element: HTMLDivElement | null): void {
    this.#content = element;
    this.#applyTransform();
  }

  start(pointer: CutoutStagePanPointer): void {
    this.#pointer = pointer;
  }

  move(pointer: CutoutStagePanPointer): boolean {
    if (this.#pointer?.pointerId !== pointer.pointerId) return false;
    this.#pan = this.#clamp({
      x: this.#pan.x + pointer.clientX - this.#pointer.clientX,
      y: this.#pan.y + pointer.clientY - this.#pointer.clientY,
    });
    this.#pointer = pointer;
    this.#applyTransform();
    return true;
  }

  stop(pointerId?: number): boolean {
    if (pointerId !== undefined && this.#pointer?.pointerId !== pointerId) return false;
    const active = this.#pointer !== null;
    this.#pointer = null;
    this.#pan = this.#clamp(this.#pan);
    this.#applyTransform();
    return active;
  }

  setZoom(zoom: number): void {
    this.#zoom = zoom;
    this.#pan = this.#clamp(this.#pan);
    this.#applyTransform();
  }

  reset(): void {
    this.#pan = { x: 0, y: 0 };
    this.setZoom(1);
  }

  #clamp(point: Point): Point {
    if (this.#content === null || this.#zoom <= 1) return { x: 0, y: 0 };
    const maxX = (this.#content.offsetWidth * (this.#zoom - 1)) / 2;
    const maxY = (this.#content.offsetHeight * (this.#zoom - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, point.x)),
      y: Math.max(-maxY, Math.min(maxY, point.y)),
    };
  }

  #applyTransform(): void {
    if (this.#content === null) return;
    this.#content.style.transform = `translate(${String(this.#pan.x)}px, ${String(
      this.#pan.y,
    )}px) scale(${String(this.#zoom)})`;
  }
}

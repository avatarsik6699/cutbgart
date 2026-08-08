/** Shared display diameter contract for both Cutout tools. Magic stores a
 * source-space radius internally, so its presentation/runtime boundaries use
 * `CUTOUT_BRUSH_DIAMETER_MIN / 2` etc. when reading/writing that state. */
export const CUTOUT_BRUSH_DIAMETER_MIN = 8;
export const CUTOUT_BRUSH_DIAMETER_MAX = 360;
export const CUTOUT_BRUSH_DIAMETER_DEFAULT_MAGIC = 36;
export const CUTOUT_BRUSH_DIAMETER_DEFAULT_MANUAL = 48;

export function isWebGpuFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /webgpu|device was lost|shader|storage buffers?|ortrun/i.test(message);
}

export function normalizeProcessingError(error: unknown, modelLoading: boolean) {
  return {
    code: modelLoading ? ("model-load-failed" as const) : ("processing-failed" as const),
    message: error instanceof Error ? error.message : "Local processing failed",
    retryable: true,
  };
}

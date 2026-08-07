import type { ProcessingCancellationSource } from "@/editor/application";

export function createNativeProcessingCancellationSource(): ProcessingCancellationSource {
  return {
    create() {
      const controller = new AbortController();
      return {
        signal: controller.signal,
        abort() {
          controller.abort();
        },
      };
    },
  };
}

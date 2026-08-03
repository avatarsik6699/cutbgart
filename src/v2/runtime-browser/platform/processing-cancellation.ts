import type { ProcessingCancellationSource } from "@/v2/application";

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

export type ModelSource = "cdn" | "upstream";

interface ModelSourceLoaderOptions {
  cdnConfigured: boolean;
  selectSource(source: ModelSource): void;
}

interface LoadOptions {
  onFallback?(cdnError: unknown): void;
}

export interface ModelSourceLoader {
  load<T>(factory: () => Promise<T>, options?: LoadOptions): Promise<T>;
  current(): ModelSource;
}

/**
 * Serializes pipeline creation because Transformers.js exposes model/WASM hosts
 * through one mutable global env object. If the private CDN fails, the worker
 * switches that object to upstream exactly once before retrying.
 */
export function createModelSourceLoader(
  options: ModelSourceLoaderOptions,
): ModelSourceLoader {
  let source: ModelSource = options.cdnConfigured ? "cdn" : "upstream";
  let queue: Promise<void> = Promise.resolve();
  options.selectSource(source);

  return {
    current: () => source,
    load<T>(factory: () => Promise<T>, loadOptions: LoadOptions = {}): Promise<T> {
      const execute = async (): Promise<T> => {
        try {
          return await factory();
        } catch (cdnError) {
          if (source !== "cdn") throw cdnError;

          source = "upstream";
          options.selectSource(source);
          loadOptions.onFallback?.(cdnError);
          try {
            return await factory();
          } catch (upstreamError) {
            throw new AggregateError(
              [cdnError, upstreamError],
              "Model load failed from both the configured CDN and the upstream source",
              { cause: upstreamError },
            );
          }
        }
      };

      const result = queue.then(execute, execute);
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

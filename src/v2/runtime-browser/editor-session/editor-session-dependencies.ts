import { ArtifactRepository } from "../artifacts";
import { ManualDraftRepository, WorkerManualCutoutCommitter } from "../manual-cutout";
import { createNativeDownloadAdapter, createNativeEditorIdSource } from "../platform";
import {
  createLocalModelConfig,
  createNativeProcessingWorkerFactory,
  detectBrowserProcessingCapabilities,
  LocalProcessingGateway,
  WorkerProcessingExecutor,
} from "../processing";
import type {
  EditorSessionDependencies,
  EditorSessionOptions,
} from "./editor-session.types";

export function createEditorSessionDependencies(
  options: EditorSessionOptions,
): EditorSessionDependencies {
  const ids = options.ids ?? createNativeEditorIdSource();
  const repository =
    options.repository ??
    new ArtifactRepository({
      assertions: "throw",
      idSource: { next: ids.artifact },
      memoryBudgetBytes: 512 * 1024 * 1024,
    });
  const gateway =
    options.gateway ??
    new LocalProcessingGateway(
      new WorkerProcessingExecutor({
        factory: createNativeProcessingWorkerFactory(),
        model: createLocalModelConfig(
          detectBrowserProcessingCapabilities().webGpu === "supported"
            ? "webgpu"
            : "wasm",
        ),
        repository,
      }),
    );
  return {
    download: options.download ?? createNativeDownloadAdapter(),
    gateway,
    ids,
    repository,
    manualCommitter:
      options.manualCommitter ?? new WorkerManualCutoutCommitter(repository),
    manualDrafts: options.manualDrafts ?? new ManualDraftRepository(),
  };
}

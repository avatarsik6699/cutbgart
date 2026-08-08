import type {
  ManualCutoutCommitRequest,
  ManualCutoutCommitter,
} from "@/editor/application";
import type { DocumentSnapshot } from "@/editor/domain";

import type { ArtifactRepository } from "../artifacts";
import {
  createNativeSnapshotCommitWorkerFactory,
  WorkerSnapshotCommitter,
  type SnapshotCommitter,
  type SnapshotCommitWorkerFactory,
} from "../snapshot-commit";

export type ManualCutoutWorkerFactory = SnapshotCommitWorkerFactory;

export function createNativeManualCutoutWorkerFactory(): ManualCutoutWorkerFactory {
  return createNativeSnapshotCommitWorkerFactory();
}

export class WorkerManualCutoutCommitter implements ManualCutoutCommitter {
  readonly #committer: SnapshotCommitter;

  constructor(
    repository: ArtifactRepository,
    factoryOrCommitter:
      | ManualCutoutWorkerFactory
      | SnapshotCommitter = createNativeManualCutoutWorkerFactory(),
  ) {
    this.#committer =
      "commit" in factoryOrCommitter
        ? factoryOrCommitter
        : new WorkerSnapshotCommitter(repository, factoryOrCommitter);
  }

  async commit(
    request: ManualCutoutCommitRequest,
    signal: AbortSignal,
  ): Promise<DocumentSnapshot> {
    return this.#committer.commit(
      { ...request, operation: "manual-cutout" },
      {
        kind: "manual-draft",
        documentId: request.documentId,
        draftId: request.draftId,
      },
      signal,
    );
  }
}

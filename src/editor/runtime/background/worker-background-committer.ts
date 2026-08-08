import type { BackgroundCommitInput, BackgroundCommitter } from "@/editor/application";
import type { DocumentSnapshot } from "@/editor/domain";

import type { SnapshotCommitter } from "../snapshot-commit";

export class WorkerBackgroundCommitter implements BackgroundCommitter {
  readonly #snapshots: SnapshotCommitter;

  constructor(snapshots: SnapshotCommitter) {
    this.#snapshots = snapshots;
  }

  commit(input: BackgroundCommitInput, signal: AbortSignal): Promise<DocumentSnapshot> {
    return this.#snapshots.commit(
      {
        automaticModelMode: input.snapshot.automaticModelMode,
        documentId: input.documentId,
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        draftRevision: input.draftRevision,
        operation: "background",
        source: input.source,
        draftMatte: input.snapshot.matte,
        foreground:
          input.snapshot.foreground ??
          (input.snapshot.background.type === "transparent"
            ? input.snapshot.composite
            : null),
        background: input.fill,
      },
      {
        kind: "background-draft",
        documentId: input.documentId,
        draftId: input.draftId,
      },
      signal,
    );
  }
}

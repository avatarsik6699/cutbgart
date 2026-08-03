import type { MagicCutoutCommitInput, MagicCutoutCommitter } from "@/v2/application";
import type { DocumentSnapshot } from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";
import type { SnapshotCommitter } from "../snapshot-commit";
import type { MagicCandidateRepository } from "./magic-candidate-repository";

export class WorkerMagicCutoutCommitter implements MagicCutoutCommitter {
  readonly #candidates: MagicCandidateRepository;
  readonly #repository: ArtifactRepository;
  readonly #snapshots: SnapshotCommitter;

  constructor(options: {
    candidates: MagicCandidateRepository;
    repository: ArtifactRepository;
    snapshots: SnapshotCommitter;
  }) {
    this.#candidates = options.candidates;
    this.#repository = options.repository;
    this.#snapshots = options.snapshots;
  }

  async commit(
    input: MagicCutoutCommitInput,
    signal: AbortSignal,
  ): Promise<DocumentSnapshot> {
    const candidate = this.#candidates.get(input.candidateId);
    if (
      candidate === null ||
      candidate.correlation.documentId !== input.documentId ||
      candidate.correlation.draftId !== input.draftId ||
      candidate.correlation.expectedRevision !== input.expectedRevision ||
      candidate.correlation.draftRevision !== input.draftRevision
    ) {
      throw new Error("Magic candidate is unavailable or stale");
    }
    const owner = {
      kind: "magic-draft",
      documentId: input.documentId,
      draftId: input.draftId,
    } as const;
    this.#repository.releaseOwnerIfPresent(owner);
    const draftMatte = this.#repository.register(
      candidate.data,
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: candidate.width,
        height: candidate.height,
        estimatedBytes: candidate.data.byteLength,
      },
      owner,
    );
    return this.#snapshots.commit(
      {
        documentId: input.documentId,
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        operation: "magic-cutout",
        draftMatte,
        foreground: input.foreground,
        source: candidate.source,
        background: input.background,
      },
      owner,
      signal,
    );
  }
}

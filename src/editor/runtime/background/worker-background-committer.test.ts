import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
} from "@/editor/domain";
import { buildDocumentSnapshot } from "@/editor/testing";

import type { SnapshotCommitter } from "../snapshot-commit";
import { WorkerBackgroundCommitter } from "./worker-background-committer";

describe("WorkerBackgroundCommitter", () => {
  it("delegates one correlated materialization while preserving matte and foreground IDs", async () => {
    const output = buildDocumentSnapshot({
      background: { type: "color", value: "#112233" },
      composite: createArtifactId("new-composite"),
    });
    const commit = vi.fn(() => Promise.resolve(output));
    const snapshots = { commit } as unknown as SnapshotCommitter;
    const committer = new WorkerBackgroundCommitter(snapshots);
    const snapshot = buildDocumentSnapshot({
      matte: createArtifactId("matte-1"),
      foreground: createArtifactId("foreground-1"),
      composite: createArtifactId("old-composite"),
    });
    const documentId = createDocumentId("document-1");
    const draftId = createBackgroundDraftId("background-draft-1");
    const signal = new AbortController().signal;

    await expect(
      committer.commit(
        {
          documentId,
          draftId,
          expectedRevision: 3,
          draftRevision: 2,
          source: createArtifactId("source-1"),
          snapshot,
          fill: { type: "color", value: "#112233" },
        },
        signal,
      ),
    ).resolves.toBe(output);
    expect(commit).toHaveBeenCalledWith(
      {
        documentId,
        draftId,
        expectedRevision: 3,
        draftRevision: 2,
        operation: "background",
        automaticModelMode: snapshot.automaticModelMode,
        source: createArtifactId("source-1"),
        draftMatte: snapshot.matte,
        foreground: snapshot.foreground,
        background: { type: "color", value: "#112233" },
      },
      { kind: "background-draft", documentId, draftId },
      signal,
    );
  });
});

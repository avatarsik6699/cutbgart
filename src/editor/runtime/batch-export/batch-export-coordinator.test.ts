import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  type DocumentSnapshot,
} from "@/editor/domain";
import { ArtifactRepository } from "../artifacts";
import { BatchExportCoordinator } from "./batch-export-coordinator";

describe("BatchExportCoordinator", () => {
  it("uses committed PNGs in document order with deterministic private names and cleanup", async () => {
    let artifact = 0;
    const repository = new ArtifactRepository({
      assertions: "throw",
      idSource: { next: () => createArtifactId(`artifact-${++artifact}`) },
      memoryBudgetBytes: 1024,
    });
    const entries = ["a", "b"].map((suffix) => {
      const documentId = createDocumentId(`document-${suffix}`);
      const owner = { kind: "document", documentId } as const;
      const matte = repository.register(
        new Uint8ClampedArray([255]),
        {
          kind: "matte",
          mediaType: "application/octet-stream",
          width: 1,
          height: 1,
          estimatedBytes: 1,
        },
        owner,
      );
      const composite = repository.register(
        new Blob([suffix], { type: "image/png" }),
        {
          kind: "composite",
          mediaType: "image/png",
          width: 1,
          height: 1,
          estimatedBytes: 1,
        },
        owner,
      );
      const snapshot: DocumentSnapshot = {
        automaticModelMode: "isnet-q8",
        matte,
        foreground: null,
        composite,
        background: { type: "transparent" },
      };
      return { documentId, snapshot };
    });
    const archives: Blob[] = [];
    const coordinator = new BatchExportCoordinator({
      repository,
      download: { start: vi.fn(), startBlob: (blob) => archives.push(blob) },
    });
    await coordinator.export(entries, 3);
    await coordinator.export(entries, 3);
    expect(archives).toHaveLength(2);
    const first = new Uint8Array(await archives[0]!.arrayBuffer());
    const second = new Uint8Array(await archives[1]!.arrayBuffer());
    expect(first).toEqual(second);
    const archiveText = new TextDecoder().decode(first);
    expect(archiveText.indexOf("cutbg-result-01.png")).toBeLessThan(
      archiveText.indexOf("cutbg-result-02.png"),
    );
    expect(archiveText).not.toContain("document-a");
    expect(coordinator.getSnapshot()).toMatchObject({
      status: "idle",
      includedCount: 2,
      skippedCount: 1,
    });
    expect(repository.stats().leases).toBe(4);
    repository.dispose();
  });

  it("reports empty failure and cancellation without retaining temporary leases", async () => {
    const documentId = createDocumentId("document-cancel");
    let artifact = 0;
    const repository = new ArtifactRepository({
      assertions: "throw",
      idSource: { next: () => createArtifactId(`cancel-${++artifact}`) },
      memoryBudgetBytes: 1024,
    });
    const owner = { kind: "document", documentId } as const;
    const matte = repository.register(
      new Uint8ClampedArray([255]),
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: 1,
        height: 1,
        estimatedBytes: 1,
      },
      owner,
    );
    const composite = repository.register(
      new Blob(["png"], { type: "image/png" }),
      {
        kind: "composite",
        mediaType: "image/png",
        width: 1,
        height: 1,
        estimatedBytes: 3,
      },
      owner,
    );
    const coordinator = new BatchExportCoordinator({
      repository,
      download: { start: vi.fn(), startBlob: vi.fn() },
    });
    await coordinator.export([], 1);
    expect(coordinator.getSnapshot()).toMatchObject({
      status: "error",
      includedCount: 0,
      skippedCount: 1,
    });
    const pending = coordinator.export(
      [
        {
          documentId,
          snapshot: {
            automaticModelMode: "isnet-q8",
            matte,
            foreground: null,
            composite,
            background: { type: "transparent" },
          },
        },
      ],
      1,
    );
    coordinator.cancel();
    await pending;
    expect(coordinator.getSnapshot().status).toBe("cancelled");
    expect(repository.stats().leases).toBe(2);
    repository.dispose();
  });
});

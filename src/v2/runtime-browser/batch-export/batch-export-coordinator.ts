import type { DocumentId, DocumentSnapshot } from "@/v2/domain";

import type { ArtifactRepository } from "../artifacts";
import type { DownloadAdapter } from "../platform";
import type { BatchExportSnapshot } from "../editor-session/editor-session.types";

export type BatchExportEntry = Readonly<{
  documentId: DocumentId;
  snapshot: DocumentSnapshot;
}>;

const FIXED_ZIP_TIMESTAMP = new Date("1980-01-01T00:00:00.000Z");

export class BatchExportCoordinator {
  readonly #download: DownloadAdapter;
  readonly #repository: ArtifactRepository;
  readonly #listeners = new Set<() => void>();
  #cancelled = false;
  #snapshot: BatchExportSnapshot = {
    status: "idle",
    includedCount: 0,
    skippedCount: 0,
    error: null,
  };

  constructor(options: { download: DownloadAdapter; repository: ArtifactRepository }) {
    this.#download = options.download;
    this.#repository = options.repository;
  }

  getSnapshot = (): BatchExportSnapshot => this.#snapshot;

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async export(entries: readonly BatchExportEntry[], totalCount: number): Promise<void> {
    if (this.#snapshot.status === "preparing") return;
    this.#cancelled = false;
    const skippedCount = Math.max(0, totalCount - entries.length);
    this.#publish({
      status: "preparing",
      includedCount: entries.length,
      skippedCount,
      error: null,
    });
    const leased: BatchExportEntry[] = [];
    try {
      const files: { name: string; input: Blob; lastModified: Date }[] = [];
      for (const [index, entry] of entries.entries()) {
        if (this.#cancelled) throw new DOMException("Export cancelled", "AbortError");
        const owner = { kind: "export", documentId: entry.documentId } as const;
        if (!this.#repository.retain(entry.snapshot.composite, owner)) continue;
        leased.push(entry);
        const value = this.#repository.read(entry.snapshot.composite);
        if (!(value instanceof Blob)) continue;
        files.push({
          name: `cutbg-result-${String(index + 1).padStart(2, "0")}.png`,
          input: value,
          lastModified: FIXED_ZIP_TIMESTAMP,
        });
      }
      if (files.length === 0) throw new Error("No completed images to export");
      const { downloadZip } = await import("client-zip");
      const archive = await downloadZip(files).blob();
      if (this.#cancelled) throw new DOMException("Export cancelled", "AbortError");
      this.#publish({
        status: "downloading",
        includedCount: files.length,
        skippedCount: totalCount - files.length,
        error: null,
      });
      this.#download.startBlob?.(archive, "cutbg-results.zip");
      this.#publish({
        status: "idle",
        includedCount: files.length,
        skippedCount: totalCount - files.length,
        error: null,
      });
    } catch (error) {
      this.#publish({
        status:
          this.#cancelled || (error instanceof Error && error.name === "AbortError")
            ? "cancelled"
            : "error",
        includedCount: leased.length,
        skippedCount,
        error: error instanceof Error ? error.message : "Could not create ZIP",
      });
    } finally {
      for (const entry of leased)
        this.#repository.releaseOwnerIfPresent({
          kind: "export",
          documentId: entry.documentId,
        });
    }
  }

  cancel(): void {
    this.#cancelled = true;
  }

  dispose(): void {
    this.cancel();
    this.#listeners.clear();
  }

  #publish(snapshot: BatchExportSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
  createEnhancementDraftId,
  createImageId,
  createMagicCandidateId,
  createMagicDraftId,
  createRunId,
  isProcessingTerminalEvent,
  isRevision,
  type ArtifactMetadata,
  type BrowserProcessingCapabilities,
  type DocumentSnapshot,
  type DocumentState,
  type ProcessingRequest,
} from "./index";

describe("v2 domain contracts", () => {
  it("creates opaque non-empty IDs without changing their wire value", () => {
    expect(createArtifactId("artifact-1")).toBe("artifact-1");
    expect(createDocumentId("document-1")).toBe("document-1");
    expect(createImageId("image-1")).toBe("image-1");
    expect(createMagicDraftId("magic-draft-1")).toBe("magic-draft-1");
    expect(createBackgroundDraftId("background-draft-1")).toBe("background-draft-1");
    expect(createEnhancementDraftId("enhancement-draft-1")).toBe("enhancement-draft-1");
    expect(createMagicCandidateId("candidate-1")).toBe("candidate-1");
    expect(createRunId("run-1")).toBe("run-1");
    expect(() => createRunId("  ")).toThrow("RunId must not be empty");
  });

  it("accepts only non-negative safe integer revisions", () => {
    expect(isRevision(0)).toBe(true);
    expect(isRevision(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isRevision(-1)).toBe(false);
    expect(isRevision(1.5)).toBe(false);
  });

  it("recognizes only explicit processing terminal events", () => {
    expect(isProcessingTerminalEvent({ type: "PROCESSING_SUCCEEDED" })).toBe(true);
    expect(isProcessingTerminalEvent({ type: "PROCESSING_FAILED" })).toBe(true);
    expect(isProcessingTerminalEvent({ type: "PROCESSING_CANCELLED" })).toBe(true);
    expect(isProcessingTerminalEvent({ type: "PROCESSING_PROGRESS" })).toBe(false);
  });

  it("keeps snapshots, requests, metadata, and capabilities ID/metadata-only", () => {
    expectTypeOf<DocumentSnapshot>().toExtend<{
      matte: string;
      foreground: string | null;
      composite: string;
      background: { type: string };
    }>();
    expectTypeOf<ProcessingRequest>().toExtend<{
      documentId: string;
      runId: string;
      expectedRevision: number;
      source: string;
    }>();
    expectTypeOf<ArtifactMetadata>().toExtend<{
      id: string;
      mediaType: string;
      estimatedBytes: number;
    }>();
    expectTypeOf<BrowserProcessingCapabilities>().toExtend<{
      backend: "local";
      maxHeavyJobs: 1;
    }>();
    expectTypeOf<DocumentState["committed"]>().toExtend<DocumentSnapshot | null>();
  });
});

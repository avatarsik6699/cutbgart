import {
  createArtifactId,
  createDocumentId,
  createImageId,
  createRunId,
  type DocumentSnapshot,
  type DocumentState,
  type ProcessingError,
  type ProcessingProgress,
  type ProcessingRequest,
} from "@/v2/domain";

export function buildDocumentSnapshot(
  overrides: Partial<DocumentSnapshot> = {},
): DocumentSnapshot {
  return {
    matte: createArtifactId("matte-1"),
    foreground: null,
    composite: createArtifactId("composite-1"),
    ...overrides,
  };
}

export function buildDocumentState(
  overrides: Partial<DocumentState> = {},
): DocumentState {
  return {
    documentId: createDocumentId("document-1"),
    imageId: createImageId("image-1"),
    source: createArtifactId("source-1"),
    revision: 0,
    committed: null,
    activeRun: null,
    pendingCommit: null,
    status: "ready",
    stage: null,
    progress: null,
    error: null,
    ...overrides,
  };
}

export function buildProcessingRequest(
  overrides: Partial<ProcessingRequest> = {},
): ProcessingRequest {
  return {
    documentId: createDocumentId("document-1"),
    runId: createRunId("run-1"),
    expectedRevision: 0,
    operation: "automatic-remove",
    source: createArtifactId("source-1"),
    ...overrides,
  };
}

export function buildProcessingProgress(
  overrides: Partial<ProcessingProgress> = {},
): ProcessingProgress {
  return {
    ...buildProcessingRequest(overrides),
    stage: "automatic-remove",
    fraction: 0.5,
    ...overrides,
  };
}

export function buildProcessingError(
  overrides: Partial<ProcessingError> = {},
): ProcessingError {
  return {
    code: "processing-failed",
    message: "Deterministic processing failure",
    retryable: true,
    ...overrides,
  };
}

import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createEditOperationId,
  createImageId,
  createManualDraftId,
  createRunId,
  type DocumentSnapshot,
  type DocumentState,
  type ProcessingError,
  type ProcessingProgress,
  type ProcessingRequest,
  type RunId,
} from "@/v2/domain";
import {
  createDocumentMachine,
  createWorkspaceMachine,
  ProcessingGatewayError,
  selectDocumentProgress,
  selectDocumentStatus,
  selectSelectedDocumentId,
  selectWorkspaceDocumentCount,
  type DocumentArtifactEffects,
  type DocumentRunIdSource,
  type ProcessingGateway,
  type ProcessingRun,
} from "./index";

const documentId = createDocumentId("document-1");
const source = createArtifactId("source-1");
const resultSnapshot: DocumentSnapshot = {
  matte: createArtifactId("matte-1"),
  foreground: null,
  composite: createArtifactId("composite-1"),
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

type GatewayRunHarness = {
  cancel: ReturnType<typeof vi.fn>;
  listeners: Set<(progress: ProcessingProgress) => void>;
  release: ReturnType<typeof vi.fn>;
  request: ProcessingRequest;
  resolveTerminal(value: Awaited<ProcessingRun["terminal"]>): void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function createGatewayHarness() {
  const runs: GatewayRunHarness[] = [];
  const dispose = vi.fn(() => Promise.resolve());
  const gateway: ProcessingGateway = {
    start(request) {
      const terminal = deferred<Awaited<ProcessingRun["terminal"]>>();
      const listeners = new Set<(progress: ProcessingProgress) => void>();
      let reachedTerminal = false;
      const resolveTerminal = (value: Awaited<ProcessingRun["terminal"]>) => {
        if (!reachedTerminal) {
          reachedTerminal = true;
          terminal.resolve(value);
        }
      };
      const cancel = vi.fn(() => {
        resolveTerminal({ type: "cancelled" });
      });
      const release = vi.fn();
      const result = terminal.promise.then((outcome) => {
        if (outcome.type === "succeeded") {
          return outcome.snapshot;
        }
        const error: ProcessingError =
          outcome.type === "failed"
            ? outcome.error
            : { code: "aborted", message: "Cancelled", retryable: true };
        throw new ProcessingGatewayError(error);
      });
      void result.catch(() => undefined);

      runs.push({ cancel, listeners, release, request, resolveTerminal });
      return {
        runId: request.runId,
        result,
        terminal: terminal.promise,
        cancel,
        release,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    },
    dispose,
  };

  return {
    dispose,
    gateway,
    runs,
    publish(index: number, progress: ProcessingProgress) {
      for (const listener of runs[index]?.listeners ?? []) {
        listener(progress);
      }
    },
  };
}

function createArtifactsHarness() {
  return {
    estimateHistoricalBytes: vi.fn<DocumentArtifactEffects["estimateHistoricalBytes"]>(
      () => 0,
    ),
    exportPng: vi.fn<DocumentArtifactEffects["exportPng"]>(),
    promoteRun: vi.fn<DocumentArtifactEffects["promoteRun"]>(() => true),
    releaseDocument: vi.fn<DocumentArtifactEffects["releaseDocument"]>(),
    releaseRun: vi.fn<DocumentArtifactEffects["releaseRun"]>(),
    releaseManualDraft: vi.fn<DocumentArtifactEffects["releaseManualDraft"]>(),
    commitManualHistory: vi.fn<DocumentArtifactEffects["commitManualHistory"]>(),
    moveDocumentHistory: vi.fn<DocumentArtifactEffects["moveDocumentHistory"]>(),
  } satisfies DocumentArtifactEffects;
}

function createRunIds(...ids: RunId[]): DocumentRunIdSource {
  let index = 0;
  return {
    next() {
      const id = ids[index];
      if (id === undefined) {
        throw new Error("No deterministic run ID remains");
      }
      index += 1;
      return id;
    },
  };
}

function createCancellationSource() {
  return {
    create() {
      const controller = new AbortController();
      return { signal: controller.signal, abort: () => controller.abort() };
    },
  };
}

function createDocumentState(status: DocumentState["status"]): DocumentState {
  return {
    documentId,
    imageId: createImageId("image-1"),
    source,
    revision: 0,
    committed: null,
    baseline: null,
    activeRun: null,
    pendingCommit: null,
    pendingManualCommit: null,
    activeMagicPrediction: null,
    pendingMagicCommit: null,
    magicCandidates: [],
    activeDraft: null,
    history: { past: [], future: [], retainedHistoricalBytes: 0 },
    status,
    stage: null,
    progress: null,
    error: null,
  };
}

const manualDependencies = {
  manualIds: {
    draft: () => createManualDraftId("draft-1"),
    operation: () => createEditOperationId("operation-1"),
  },
  manualCommitter: {
    commit: () => Promise.reject(new Error("Unexpected manual commit")),
  },
};

function waitForSnapshot<TSnapshot>(
  actor: {
    getSnapshot(): TSnapshot;
    subscribe(listener: (snapshot: TSnapshot) => void): { unsubscribe(): void };
  },
  predicate: (snapshot: TSnapshot) => boolean,
): Promise<TSnapshot> {
  const current = actor.getSnapshot();
  if (predicate(current)) {
    return Promise.resolve(current);
  }

  return new Promise((resolve) => {
    const subscription = actor.subscribe((snapshot) => {
      if (predicate(snapshot)) {
        subscription.unsubscribe();
        resolve(snapshot);
      }
    });
  });
}

describe("editor v2 document actor", () => {
  it("automatically runs once after preparation and commits through artifact promotion", async () => {
    const gateway = createGatewayHarness();
    const artifacts = createArtifactsHarness();
    const runId = createRunId("run-1");
    const machine = createDocumentMachine({
      ...manualDependencies,
      artifacts,
      cancellation: createCancellationSource(),
      gateway: gateway.gateway,
      runIds: createRunIds(runId),
    });
    const actor = createActor(machine, {
      input: { document: createDocumentState("preparing") },
    });
    actor.start();

    actor.send({
      type: "DOMAIN_EVENT",
      event: { type: "PREPARATION_SUCCEEDED", documentId },
    });
    await vi.waitFor(() => expect(gateway.runs).toHaveLength(1));
    expect(gateway.runs).toHaveLength(1);
    expect(gateway.runs[0]?.request).toMatchObject({
      documentId,
      runId,
      expectedRevision: 0,
    });

    gateway.publish(0, {
      documentId,
      runId,
      expectedRevision: 0,
      stage: "automatic-remove",
      fraction: 0.5,
    });
    await waitForSnapshot(
      actor,
      (snapshot) => snapshot.context.document.status === "processing",
    );
    expect(selectDocumentProgress(actor.getSnapshot())).toBe(0.5);

    gateway.runs[0]?.resolveTerminal({ type: "succeeded", snapshot: resultSnapshot });
    const result = await waitForSnapshot(
      actor,
      (snapshot) => snapshot.context.document.status === "result",
    );
    expect(result.context.document).toMatchObject({
      committed: resultSnapshot,
      revision: 1,
      activeRun: null,
    });
    expect(artifacts.promoteRun).toHaveBeenCalledOnce();
    expect(gateway.runs).toHaveLength(1);
    actor.stop();
  });

  it("cancels through the child actor and reaches a stable terminal state", async () => {
    const gateway = createGatewayHarness();
    const artifacts = createArtifactsHarness();
    const machine = createDocumentMachine({
      ...manualDependencies,
      artifacts,
      cancellation: createCancellationSource(),
      gateway: gateway.gateway,
      runIds: createRunIds(createRunId("run-1")),
    });
    const actor = createActor(machine, {
      input: { document: createDocumentState("ready") },
    });
    actor.start();
    actor.send({
      type: "COMMAND",
      command: { type: "START_AUTOMATIC_REMOVAL", documentId, backend: "local" },
    });
    await vi.waitFor(() => expect(gateway.runs).toHaveLength(1));

    actor.send({ type: "COMMAND", command: { type: "CANCEL_ACTIVE_RUN", documentId } });
    const ready = await waitForSnapshot(
      actor,
      (snapshot) => snapshot.context.document.status === "ready",
    );
    expect(selectDocumentStatus(ready)).toBe("ready");
    expect(gateway.runs[0]?.cancel).toHaveBeenCalled();
    expect(artifacts.releaseRun).toHaveBeenCalled();
    actor.stop();
  });

  it("treats root stop as cleanup and never stores gateway or artifacts in context", async () => {
    const gateway = createGatewayHarness();
    const artifacts = createArtifactsHarness();
    const machine = createDocumentMachine({
      ...manualDependencies,
      artifacts,
      cancellation: createCancellationSource(),
      gateway: gateway.gateway,
      runIds: createRunIds(createRunId("run-1")),
    });
    const actor = createActor(machine, {
      input: { document: createDocumentState("ready") },
    });
    actor.start();
    actor.send({
      type: "COMMAND",
      command: { type: "START_AUTOMATIC_REMOVAL", documentId, backend: "local" },
    });
    await vi.waitFor(() => expect(gateway.runs).toHaveLength(1));

    expect(Object.keys(actor.getSnapshot().context)).toEqual([
      "document",
      "lastCommandOutcome",
    ]);
    actor.stop();
    expect(gateway.runs[0]?.cancel).toHaveBeenCalled();
    expect(gateway.runs[0]?.release).toHaveBeenCalled();
    expect(artifacts.releaseRun).toHaveBeenCalled();
    expect(artifacts.releaseDocument).toHaveBeenCalled();
  });
});

describe("editor v2 workspace actor", () => {
  it("spawns one document child, rejects a second, and removes the child cleanly", () => {
    const gateway = createGatewayHarness();
    const artifacts = createArtifactsHarness();
    const documentMachine = createDocumentMachine({
      ...manualDependencies,
      artifacts,
      cancellation: createCancellationSource(),
      gateway: gateway.gateway,
      runIds: createRunIds(createRunId("run-1")),
    });
    const workspace = createActor(createWorkspaceMachine({ documentMachine }));
    workspace.start();
    workspace.send({ type: "REGISTER_DOCUMENT", document: createDocumentState("ready") });

    expect(selectWorkspaceDocumentCount(workspace.getSnapshot())).toBe(1);
    expect(selectSelectedDocumentId(workspace.getSnapshot())).toBe(documentId);
    expect(Object.keys(workspace.getSnapshot().children)).toEqual([
      `editor-v2-document:${documentId}`,
    ]);
    expect(Object.keys(workspace.getSnapshot().context)).toEqual([
      "documentIds",
      "lastCommandOutcome",
      "selectedDocumentId",
    ]);

    workspace.send({
      type: "REGISTER_DOCUMENT",
      document: {
        ...createDocumentState("ready"),
        documentId: createDocumentId("document-2"),
      },
    });
    expect(workspace.getSnapshot().context.lastCommandOutcome).toMatchObject({
      status: "rejected",
      reason: "document-exists",
    });

    workspace.send({ type: "REMOVE_DOCUMENT", documentId });
    expect(selectWorkspaceDocumentCount(workspace.getSnapshot())).toBe(0);
    expect(Object.keys(workspace.getSnapshot().children)).toEqual([]);
    expect(artifacts.releaseDocument).toHaveBeenCalled();
    workspace.stop();
  });
});

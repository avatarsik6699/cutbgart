import { createActor } from "xstate";

import {
  createDocumentMachine,
  createWorkspaceMachine,
  getDocumentActorId,
  type DocumentActorRef,
} from "@/v2/application";
import type { DocumentId, DocumentState } from "@/v2/domain";

import { createNativeProcessingCancellationSource } from "../platform";
import { createEditorArtifactEffects } from "./editor-artifact-effects";
import { DocumentResultProjection } from "./document-result-projection";
import { createEditorSessionDependencies } from "./editor-session-dependencies";
import type {
  EditorSession,
  EditorSessionOptions,
  EditorSessionSnapshot,
} from "./editor-session.types";
import { prepareImageImport } from "./image-import-preparation";

export function createEditorSession(options: EditorSessionOptions = {}): EditorSession {
  const dependencies = createEditorSessionDependencies(options);
  const { download, gateway, ids, repository } = dependencies;
  const listeners = new Set<() => void>();
  let currentDocumentId: DocumentId | null = null;
  let disposed = false;
  let importing = false;
  const resultProjection = new DocumentResultProjection(repository);
  let snapshot: EditorSessionSnapshot = {
    kind: "empty",
    actor: null,
    error: null,
    fileName: null,
    height: null,
    previewUrl: null,
    resultUrl: null,
    width: null,
  };

  const artifactEffects = createEditorArtifactEffects({
    download,
    fileName: () => snapshot.fileName,
    repository,
  });
  const documentMachine = createDocumentMachine({
    artifacts: artifactEffects,
    cancellation: createNativeProcessingCancellationSource(),
    gateway,
    runIds: { next: ids.run },
  });
  const workspace = createActor(createWorkspaceMachine({ documentMachine }));
  workspace.start();

  function emptySnapshot(
    error: Extract<EditorSessionSnapshot, { kind: "empty" }>["error"] = null,
  ): EditorSessionSnapshot {
    return {
      kind: "empty",
      actor: null,
      error,
      fileName: null,
      height: null,
      previewUrl: null,
      resultUrl: null,
      width: null,
    };
  }

  function publish(next: EditorSessionSnapshot): void {
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }

  async function performImport(file: File): Promise<void> {
    publish({
      kind: "preparing",
      actor: null,
      error: null,
      fileName: file.name,
      height: null,
      previewUrl: null,
      resultUrl: null,
      width: null,
    });
    const preparation = await prepareImageImport(file);
    if (disposed) {
      return;
    }
    if (!preparation.ok) {
      publish(emptySnapshot(preparation.error));
      return;
    }
    const prepared = preparation.value;

    const documentId = ids.document();
    const source = repository.register(
      file,
      {
        kind: "source",
        mediaType: prepared.mediaType,
        width: prepared.width,
        height: prepared.height,
        estimatedBytes: file.size,
      },
      { kind: "document", documentId },
    );
    const preview = repository.createObjectUrl(source, { kind: "preview", documentId });
    const document: DocumentState = {
      documentId,
      imageId: ids.image(),
      source,
      revision: 0,
      committed: null,
      activeRun: null,
      pendingCommit: null,
      status: "preparing",
      stage: null,
      progress: null,
      error: null,
    };
    currentDocumentId = documentId;
    workspace.send({ type: "REGISTER_DOCUMENT", document });
    const child = workspace.getSnapshot().children[getDocumentActorId(documentId)];
    if (child === undefined) {
      repository.releaseOwnerIfPresent({ kind: "preview", documentId });
      repository.releaseOwnerIfPresent({ kind: "document", documentId });
      publish(emptySnapshot("preparation-failed"));
      return;
    }
    const actor = child as DocumentActorRef;
    publish({
      kind: "document",
      actor,
      error: null,
      fileName: file.name,
      height: prepared.height,
      previewUrl: preview?.url ?? null,
      resultUrl: null,
      width: prepared.width,
    });
    resultProjection.watch(actor, documentId, (resultUrl) => {
      if (snapshot.kind === "document") publish({ ...snapshot, resultUrl });
    });
    actor.send({
      type: "DOMAIN_EVENT",
      event: { type: "PREPARATION_SUCCEEDED", documentId },
    });
  }

  async function importImage(file: File): Promise<void> {
    if (disposed || importing || snapshot.kind !== "empty") {
      return;
    }
    importing = true;
    try {
      await performImport(file);
    } finally {
      importing = false;
    }
  }

  function reset(): void {
    const documentId = currentDocumentId;
    if (snapshot.kind !== "document" || documentId === null) {
      return;
    }
    snapshot.actor.send({
      type: "COMMAND",
      command: { type: "RESET_DOCUMENT", documentId },
    });
    workspace.send({ type: "REMOVE_DOCUMENT", documentId });
    resultProjection.stop();
    currentDocumentId = null;
    publish(emptySnapshot());
  }

  return {
    cancel() {
      if (snapshot.kind === "document" && currentDocumentId !== null) {
        snapshot.actor.send({
          type: "COMMAND",
          command: { type: "CANCEL_ACTIVE_RUN", documentId: currentDocumentId },
        });
      }
    },
    async dispose() {
      if (disposed) {
        return;
      }
      reset();
      disposed = true;
      workspace.send({ type: "DISPOSE" });
      workspace.stop();
      await gateway.dispose();
      repository.dispose();
      listeners.clear();
    },
    exportPng() {
      const documentId = currentDocumentId;
      if (snapshot.kind !== "document" || documentId === null) {
        return;
      }
      snapshot.actor.send({
        type: "COMMAND",
        command: {
          type: "EXPORT_PNG",
          documentId,
          expectedRevision: snapshot.actor.getSnapshot().context.document.revision,
        },
      });
    },
    getSnapshot: () => snapshot,
    resources: () => repository.stats(),
    importImage,
    reset,
    retry() {
      if (snapshot.kind === "document" && currentDocumentId !== null) {
        snapshot.actor.send({
          type: "COMMAND",
          command: {
            type: "START_AUTOMATIC_REMOVAL",
            documentId: currentDocumentId,
            backend: "local",
          },
        });
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

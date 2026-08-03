import { setup, type AnyStateMachine } from "xstate";

import type {
  CommandOutcome,
  DocumentCommand,
  DocumentId,
  DocumentState,
} from "@/v2/domain";

import type { DocumentActorEvent, DocumentActorInput } from "../document";

export type WorkspaceActorContext = {
  documentIds: readonly DocumentId[];
  lastCommandOutcome: CommandOutcome | null;
  selectedDocumentId: DocumentId | null;
};

export type WorkspaceActorEvent =
  | { type: "REGISTER_DOCUMENT"; document: DocumentState }
  | { type: "DOCUMENT_COMMAND"; documentId: DocumentId; command: DocumentCommand }
  | { type: "REMOVE_DOCUMENT"; documentId: DocumentId }
  | { type: "DISPOSE" };

export type WorkspaceMachineDependencies = {
  documentMachine: AnyStateMachine;
};

export function getDocumentActorId(documentId: DocumentId): string {
  return `editor-v2-document:${documentId}`;
}

export function createWorkspaceMachine(dependencies: WorkspaceMachineDependencies) {
  const machineSetup = setup({
    types: {
      context: {} as WorkspaceActorContext,
      events: {} as WorkspaceActorEvent,
    },
    actors: {
      document: dependencies.documentMachine,
    },
  });

  return machineSetup.createMachine({
    id: "editor-v2-workspace",
    initial: "active",
    context: {
      documentIds: [],
      lastCommandOutcome: null,
      selectedDocumentId: null,
    },
    states: {
      active: {
        on: {
          REGISTER_DOCUMENT: [
            {
              guard: ({ context }) => context.documentIds.length === 0,
              actions: machineSetup.enqueueActions(({ enqueue, event }) => {
                if (event.type !== "REGISTER_DOCUMENT") {
                  return;
                }
                const input: DocumentActorInput = { document: event.document };
                enqueue.spawnChild("document", {
                  id: getDocumentActorId(event.document.documentId),
                  input,
                });
                enqueue.assign({
                  documentIds: [event.document.documentId],
                  selectedDocumentId: event.document.documentId,
                  lastCommandOutcome: {
                    status: "accepted",
                    command: "IMPORT_IMAGE",
                  },
                });
              }),
            },
            {
              actions: machineSetup.assign({
                lastCommandOutcome: {
                  status: "rejected",
                  command: "IMPORT_IMAGE",
                  reason: "document-exists",
                },
              }),
            },
          ],
          DOCUMENT_COMMAND: {
            actions: machineSetup.enqueueActions(({ context, enqueue, event }) => {
              if (event.type !== "DOCUMENT_COMMAND") {
                return;
              }
              if (!context.documentIds.includes(event.documentId)) {
                enqueue.assign({
                  lastCommandOutcome: {
                    status: "rejected",
                    command: event.command.type,
                    reason: "document-not-found",
                  },
                });
                return;
              }
              enqueue.sendTo(getDocumentActorId(event.documentId), {
                type: "COMMAND",
                command: event.command,
              } satisfies DocumentActorEvent);
            }),
          },
          REMOVE_DOCUMENT: {
            actions: machineSetup.enqueueActions(({ context, enqueue, event }) => {
              if (
                event.type !== "REMOVE_DOCUMENT" ||
                !context.documentIds.includes(event.documentId)
              ) {
                return;
              }
              enqueue.stopChild(getDocumentActorId(event.documentId));
              enqueue.assign({ documentIds: [], selectedDocumentId: null });
            }),
          },
          DISPOSE: { target: "disposed" },
        },
      },
      disposed: { type: "final" },
    },
  });
}

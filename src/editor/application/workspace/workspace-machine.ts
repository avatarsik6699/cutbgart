import { setup, type AnyStateMachine } from "xstate";

import type { DocumentMachineTypes } from "../document";
import type {
  DocumentId,
  WorkspaceCommand,
  WorkspaceCommandOutcome,
} from "@/editor/domain";

export type WorkspaceActorContext = {
  documentIds: readonly DocumentId[];
  lastCommandOutcome: WorkspaceCommandOutcome | null;
  selectedDocumentId: DocumentId | null;
};

export type WorkspaceActorEvent = WorkspaceCommand;

export type WorkspaceMachineDependencies = {
  documentMachine: AnyStateMachine;
};

export function getDocumentActorId(documentId: DocumentId): string {
  return `editor-document:${documentId}`;
}

function accepted(
  command: WorkspaceCommand["type"],
  documentId?: DocumentId,
): WorkspaceCommandOutcome {
  return documentId === undefined
    ? { status: "accepted", command }
    : { status: "accepted", command, documentId };
}

function rejected(
  command: WorkspaceCommand["type"],
  reason: Extract<WorkspaceCommandOutcome, { status: "rejected" }>["reason"],
  documentId?: DocumentId,
): WorkspaceCommandOutcome {
  return documentId === undefined
    ? { status: "rejected", command, reason }
    : { status: "rejected", command, reason, documentId };
}

function selectionAfterRemoval(
  documentIds: readonly DocumentId[],
  selectedDocumentId: DocumentId | null,
  removedDocumentId: DocumentId,
): DocumentId | null {
  if (selectedDocumentId !== removedDocumentId) return selectedDocumentId;
  const index = documentIds.indexOf(removedDocumentId);
  return documentIds[index + 1] ?? documentIds[index - 1] ?? null;
}

export function createWorkspaceMachine(dependencies: WorkspaceMachineDependencies) {
  const machineSetup = setup({
    types: {
      context: {} as WorkspaceActorContext,
      events: {} as WorkspaceActorEvent,
    },
    actors: { document: dependencies.documentMachine },
  });

  return machineSetup.createMachine({
    id: "editor-workspace",
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
              guard: ({ context, event }) =>
                !context.documentIds.includes(event.document.documentId),
              actions: machineSetup.enqueueActions(({ context, enqueue, event }) => {
                const registerEvent = event as Extract<
                  WorkspaceCommand,
                  { type: "REGISTER_DOCUMENT" }
                >;
                const documentId = registerEvent.document.documentId;
                const input: DocumentMachineTypes.ActorInput = {
                  document: registerEvent.document,
                };
                enqueue.spawnChild("document", {
                  id: getDocumentActorId(documentId),
                  input,
                });
                enqueue.assign({
                  documentIds: [...context.documentIds, documentId],
                  selectedDocumentId: context.selectedDocumentId ?? documentId,
                  lastCommandOutcome: accepted("REGISTER_DOCUMENT", documentId),
                });
              }),
            },
            {
              actions: machineSetup.assign({
                lastCommandOutcome: ({ event }) => {
                  const registerEvent = event as Extract<
                    WorkspaceCommand,
                    { type: "REGISTER_DOCUMENT" }
                  >;
                  return rejected(
                    "REGISTER_DOCUMENT",
                    "duplicate-document",
                    registerEvent.document.documentId,
                  );
                },
              }),
            },
          ],
          SELECT_DOCUMENT: [
            {
              guard: ({ context, event }) =>
                context.documentIds.includes(event.documentId),
              actions: machineSetup.assign({
                selectedDocumentId: ({ event }) =>
                  (event as Extract<WorkspaceCommand, { type: "SELECT_DOCUMENT" }>)
                    .documentId,
                lastCommandOutcome: ({ event }) => {
                  const selectEvent = event as Extract<
                    WorkspaceCommand,
                    { type: "SELECT_DOCUMENT" }
                  >;
                  return accepted("SELECT_DOCUMENT", selectEvent.documentId);
                },
              }),
            },
            {
              actions: machineSetup.assign({
                lastCommandOutcome: ({ event }) => {
                  const selectEvent = event as Extract<
                    WorkspaceCommand,
                    { type: "SELECT_DOCUMENT" }
                  >;
                  return rejected(
                    "SELECT_DOCUMENT",
                    "document-not-found",
                    selectEvent.documentId,
                  );
                },
              }),
            },
          ],
          DOCUMENT_COMMAND: [
            {
              guard: ({ context, event }) =>
                context.documentIds.includes(event.documentId),
              actions: machineSetup.enqueueActions(({ enqueue, event }) => {
                const commandEvent = event as Extract<
                  WorkspaceCommand,
                  { type: "DOCUMENT_COMMAND" }
                >;
                enqueue.sendTo(getDocumentActorId(commandEvent.documentId), {
                  type: "COMMAND",
                  command: commandEvent.command,
                } satisfies DocumentMachineTypes.ActorEvent);
                enqueue.assign({
                  lastCommandOutcome: accepted(
                    "DOCUMENT_COMMAND",
                    commandEvent.documentId,
                  ),
                });
              }),
            },
            {
              actions: machineSetup.assign({
                lastCommandOutcome: ({ event }) => {
                  const commandEvent = event as Extract<
                    WorkspaceCommand,
                    { type: "DOCUMENT_COMMAND" }
                  >;
                  return rejected(
                    "DOCUMENT_COMMAND",
                    "document-not-found",
                    commandEvent.documentId,
                  );
                },
              }),
            },
          ],
          REMOVE_DOCUMENT: [
            {
              guard: ({ context, event }) =>
                context.documentIds.includes(event.documentId),
              actions: machineSetup.enqueueActions(({ context, enqueue, event }) => {
                const removeEvent = event as Extract<
                  WorkspaceCommand,
                  { type: "REMOVE_DOCUMENT" }
                >;
                const nextSelection = selectionAfterRemoval(
                  context.documentIds,
                  context.selectedDocumentId,
                  removeEvent.documentId,
                );
                enqueue.stopChild(getDocumentActorId(removeEvent.documentId));
                enqueue.assign({
                  documentIds: context.documentIds.filter(
                    (documentId) => documentId !== removeEvent.documentId,
                  ),
                  selectedDocumentId: nextSelection,
                  lastCommandOutcome: accepted("REMOVE_DOCUMENT", removeEvent.documentId),
                });
              }),
            },
            {
              actions: machineSetup.assign({
                lastCommandOutcome: ({ event }) => {
                  const removeEvent = event as Extract<
                    WorkspaceCommand,
                    { type: "REMOVE_DOCUMENT" }
                  >;
                  return rejected(
                    "REMOVE_DOCUMENT",
                    "document-not-found",
                    removeEvent.documentId,
                  );
                },
              }),
            },
          ],
          DISPOSE: {
            target: "disposed",
            actions: machineSetup.enqueueActions(({ context, enqueue }) => {
              for (const documentId of context.documentIds)
                enqueue.stopChild(getDocumentActorId(documentId));
              enqueue.assign({
                documentIds: [],
                selectedDocumentId: null,
                lastCommandOutcome: accepted("DISPOSE"),
              });
            }),
          },
        },
      },
      disposed: {
        on: {
          "*": {
            actions: machineSetup.assign({
              lastCommandOutcome: ({ event }) => {
                const documentId = "documentId" in event ? event.documentId : undefined;
                return rejected(event.type, "workspace-disposed", documentId);
              },
            }),
          },
        },
      },
    },
  });
}

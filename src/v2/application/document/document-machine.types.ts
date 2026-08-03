import type { ActorRefFrom } from "xstate";

import type {
  CommandOutcome,
  DocumentCommand,
  DocumentEffect,
  DocumentEvent,
  DocumentState,
  RunId,
} from "@/v2/domain";
import type { ProcessingCancellationSource, ProcessingGateway } from "../processing";

export type DocumentRunIdSource = { next(): RunId };

export type DocumentArtifactEffects = {
  exportPng(effect: Extract<DocumentEffect, { type: "export-png" }>): void;
  promoteRun(effect: Extract<DocumentEffect, { type: "promote-run" }>): boolean;
  releaseDocument(effect: Extract<DocumentEffect, { type: "release-document" }>): void;
  releaseRun(effect: Extract<DocumentEffect, { type: "release-run-if-owned" }>): void;
};

export type DocumentMachineDependencies = {
  artifacts: DocumentArtifactEffects;
  cancellation: ProcessingCancellationSource;
  gateway: ProcessingGateway;
  runIds: DocumentRunIdSource;
};

export type DocumentActorInput = { document: DocumentState };
export type DocumentActorContext = {
  document: DocumentState;
  lastCommandOutcome: CommandOutcome | null;
};
export type DocumentActorEvent =
  | { type: "COMMAND"; command: DocumentCommand }
  | { type: "DOMAIN_EVENT"; event: DocumentEvent };

export type DocumentActorRef = ActorRefFrom<
  ReturnType<typeof import("./document-machine").createDocumentMachine>
>;

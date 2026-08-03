import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";

import { createRunId, type DocumentState, type ProcessingStage } from "@/v2/domain";
import {
  buildDocumentSnapshot,
  buildDocumentState,
  buildProcessingError,
  buildProcessingProgress,
  createDeterministicIds,
  FakeProcessingGateway,
} from "@/v2/testing";

import { createDocumentMachine, type DocumentArtifactEffects } from "./index";

const cancellableStages = [
  "queued",
  "model-loading",
  "decode",
  "automatic-remove",
  "post-process",
  "composite",
  "encode-png",
] as const satisfies readonly ProcessingStage[];

function createHarness(ids: string[]) {
  const gateway = new FakeProcessingGateway();
  const runIds = createDeterministicIds(ids.map(createRunId));
  const artifacts = {
    exportPng: vi.fn<DocumentArtifactEffects["exportPng"]>(),
    promoteRun: vi.fn<DocumentArtifactEffects["promoteRun"]>(() => true),
    releaseDocument: vi.fn<DocumentArtifactEffects["releaseDocument"]>(),
    releaseRun: vi.fn<DocumentArtifactEffects["releaseRun"]>(),
  } satisfies DocumentArtifactEffects;
  const machine = createDocumentMachine({
    artifacts,
    gateway,
    runIds,
    cancellation: {
      create() {
        const controller = new AbortController();
        return { signal: controller.signal, abort: () => controller.abort() };
      },
    },
  });
  return { artifacts, gateway, machine };
}

async function waitForStatus(
  actor: ReturnType<typeof createActor<ReturnType<typeof createDocumentMachine>>>,
  status: DocumentState["status"],
) {
  await vi.waitFor(() => {
    expect(actor.getSnapshot().context.document.status).toBe(status);
  });
}

describe("document actor model paths", () => {
  it.each(cancellableStages)(
    "cancels at %s with one terminal and released run",
    async (stage) => {
      const harness = createHarness([`run-${stage}`]);
      const actor = createActor(harness.machine, {
        input: { document: buildDocumentState() },
      });
      actor.start();
      actor.send({
        type: "COMMAND",
        command: {
          type: "START_AUTOMATIC_REMOVAL",
          documentId: actor.getSnapshot().context.document.documentId,
          backend: "local",
        },
      });
      await vi.waitFor(() => expect(harness.gateway.runs).toHaveLength(1));
      const run = harness.gateway.runs[0];
      if (!run) throw new Error("Expected one fake processing run");
      run.publish(buildProcessingProgress({ ...run.request, stage }));
      actor.send({
        type: "COMMAND",
        command: {
          type: "CANCEL_ACTIVE_RUN",
          documentId: run.request.documentId,
        },
      });

      await waitForStatus(actor, "ready");
      expect(actor.getSnapshot().context.document.activeRun).toBeNull();
      expect(run.released()).toBe(true);
      actor.stop();
      await harness.gateway.dispose();
    },
  );

  it("rejects duplicate start, ignores stale success, retries a crash, and commits once", async () => {
    const harness = createHarness(["run-1", "run-rejected-duplicate", "run-2"]);
    const actor = createActor(harness.machine, {
      input: { document: buildDocumentState() },
    });
    actor.start();
    const documentId = actor.getSnapshot().context.document.documentId;
    const start = {
      type: "START_AUTOMATIC_REMOVAL" as const,
      documentId,
      backend: "local" as const,
    };
    actor.send({ type: "COMMAND", command: start });
    actor.send({ type: "COMMAND", command: start });
    await vi.waitFor(() => expect(harness.gateway.runs).toHaveLength(1));
    expect(actor.getSnapshot().context.lastCommandOutcome).toMatchObject({
      status: "rejected",
      reason: "run-active",
    });

    const first = harness.gateway.runs[0];
    if (!first) throw new Error("Expected first run");
    first.fail(buildProcessingError({ code: "worker-crashed" }));
    await waitForStatus(actor, "error");
    actor.send({ type: "COMMAND", command: start });
    await vi.waitFor(() => expect(harness.gateway.runs).toHaveLength(2));
    const second = harness.gateway.runs[1];
    if (!second) throw new Error("Expected retry run");

    actor.send({
      type: "DOMAIN_EVENT",
      event: {
        type: "PROCESSING_SUCCEEDED",
        ...first.request,
        snapshot: buildDocumentSnapshot(),
      },
    });
    expect(actor.getSnapshot().context.document.activeRun?.runId).toBe(
      second.request.runId,
    );
    second.succeed(buildDocumentSnapshot());
    await waitForStatus(actor, "result");
    expect(actor.getSnapshot().context.document.revision).toBe(1);
    expect(harness.artifacts.promoteRun).toHaveBeenCalledOnce();
    actor.stop();
    await harness.gateway.dispose();
  });

  it("reset and unmount release ownership; a fresh remount starts independently", async () => {
    const firstHarness = createHarness(["run-before-reset"]);
    const firstActor = createActor(firstHarness.machine, {
      input: { document: buildDocumentState() },
    });
    firstActor.start();
    const documentId = firstActor.getSnapshot().context.document.documentId;
    firstActor.send({
      type: "COMMAND",
      command: { type: "START_AUTOMATIC_REMOVAL", documentId, backend: "local" },
    });
    await vi.waitFor(() => expect(firstHarness.gateway.runs).toHaveLength(1));
    firstActor.send({
      type: "COMMAND",
      command: { type: "RESET_DOCUMENT", documentId },
    });
    await waitForStatus(firstActor, "disposed");
    firstActor.stop();
    expect(firstHarness.artifacts.releaseDocument).toHaveBeenCalled();
    expect(firstHarness.gateway.runs[0]?.released()).toBe(true);
    await firstHarness.gateway.dispose();

    const secondHarness = createHarness(["run-after-remount"]);
    const secondActor = createActor(secondHarness.machine, {
      input: { document: buildDocumentState() },
    });
    secondActor.start();
    secondActor.send({
      type: "COMMAND",
      command: { type: "START_AUTOMATIC_REMOVAL", documentId, backend: "local" },
    });
    await vi.waitFor(() => expect(secondHarness.gateway.runs).toHaveLength(1));
    secondHarness.gateway.runs[0]?.succeed(buildDocumentSnapshot());
    await waitForStatus(secondActor, "result");
    secondActor.stop();
    await secondHarness.gateway.dispose();
  });
});

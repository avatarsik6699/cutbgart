import { describe, expect, it } from "vitest";

import { createDocumentId, createRunId } from "@/v2/domain";
import { PROCESSING_WORKER_PROTOCOL_VERSION } from "@/v2/runtime-browser";

import {
  buildDocumentSnapshot,
  buildProcessingProgress,
  buildProcessingRequest,
  createDeterministicIds,
  createFakeClock,
  FakeProcessingGateway,
  WorkerScenarioDriver,
} from ".";

describe("v2 deterministic test foundation", () => {
  it("provides isolated clocks, IDs, and minimal builders", () => {
    const clock = createFakeClock(10);
    clock.advanceBy(5);
    expect(clock.now()).toBe(15);
    const ids = createDeterministicIds([createRunId("run-a"), createRunId("run-b")]);
    expect(ids.next()).toBe("run-a");
    expect(ids.remaining()).toBe(1);
    expect(buildProcessingRequest()).toMatchObject({ operation: "automatic-remove" });
  });

  it("drives gateway terminals without timers or a duplicate state machine", async () => {
    const gateway = new FakeProcessingGateway();
    const request = buildProcessingRequest();
    const run = gateway.start(request, new AbortController().signal);
    const observed: number[] = [];
    run.subscribe((progress) => observed.push(progress.fraction ?? -1));
    gateway.runs[0]?.publish(buildProcessingProgress());
    gateway.runs[0]?.succeed(buildDocumentSnapshot());

    await expect(run.terminal).resolves.toMatchObject({ type: "succeeded" });
    expect(observed).toEqual([0.5]);
    run.release();
    expect(gateway.runs[0]?.released()).toBe(true);
    await gateway.dispose();
  });

  it("records production worker protocol traffic and injected failures", () => {
    const worker = new WorkerScenarioDriver();
    const correlation = {
      documentId: createDocumentId("document-1"),
      runId: createRunId("run-1"),
      expectedRevision: 0,
    };
    worker.postMessage({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "CANCEL",
      correlation,
    });
    expect(worker.commands).toHaveLength(1);
    worker.terminate();
    expect(worker.terminated()).toBe(true);
  });
});

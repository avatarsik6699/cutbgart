import { describe, expect, it, vi } from "vitest";

import type { DocumentMachineTypes } from "@/editor/application";
import {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
} from "@/editor/domain";
import { buildDocumentSnapshot, buildDocumentState } from "@/editor/testing";

import { ArtifactRepository } from "../artifacts";
import { BackgroundController } from "./background-controller";
import { BackgroundDraftRepository } from "./background-draft-repository";
import type {
  BackgroundImagePreparer,
  PreparedBackgroundImage,
} from "./background-image-client";

function actorHarness() {
  const documentId = createDocumentId("document-1");
  const draftId = createBackgroundDraftId("background-draft-1");
  let document = buildDocumentState({
    documentId,
    committed: buildDocumentSnapshot(),
    revision: 2,
    status: "result",
    activeDraft: {
      kind: "background",
      draftId,
      documentId,
      baselineRevision: 2,
      draftRevision: 0,
      fill: { type: "transparent" },
      dirty: false,
      status: "ready",
    },
  });
  const send = vi.fn((event: { type: string; command?: Record<string, unknown> }) => {
    if (event.command?.type === "CHANGE_BACKGROUND") {
      const draft = document.activeDraft;
      if (draft?.kind === "background")
        document = {
          ...document,
          activeDraft: {
            ...draft,
            draftRevision: event.command.draftRevision as number,
            fill: event.command.fill as typeof draft.fill,
            dirty: true,
          },
        };
    }
    if (event.command?.type === "CANCEL_BACKGROUND")
      document = { ...document, activeDraft: null };
  });
  const actor = {
    getSnapshot: () => ({ context: { document } }),
    send,
  } as unknown as DocumentMachineTypes.ActorRef;
  return { actor, documentId, draftId, send };
}

describe("BackgroundController", () => {
  it("prepares and registers one image descriptor, then releases it on scalar change", async () => {
    let next = 0;
    const artifacts = new ArtifactRepository({
      idSource: { next: () => createArtifactId(`background-${++next}`) },
      memoryBudgetBytes: 1024,
      urlAdapter: { create: () => "blob:background", revoke: vi.fn() },
    });
    const drafts = new BackgroundDraftRepository(artifacts);
    const prepare = vi.fn<BackgroundImagePreparer["prepare"]>(() =>
      Promise.resolve({
        blob: new Blob(["background"], { type: "image/png" }),
        mediaType: "image/png",
        width: 2,
        height: 1,
      }),
    );
    const images: BackgroundImagePreparer = {
      prepare,
    };
    const harness = actorHarness();
    const controller = new BackgroundController({
      actor: () => harness.actor,
      drafts,
      images,
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.selectImage(
      new File(["png"], "background.png", { type: "image/png" }),
    );
    expect(prepare).toHaveBeenCalledOnce();
    const command = harness.send.mock.calls.at(-1)?.[0].command;
    expect(command).toMatchObject({
      type: "CHANGE_BACKGROUND",
      draftRevision: 1,
    });
    const fill = command?.fill;
    expect(typeof fill === "object" && fill !== null && "type" in fill).toBe(true);
    if (typeof fill !== "object" || fill === null || !("artifactId" in fill))
      throw new Error("Background image descriptor was not published");
    expect(typeof fill.artifactId).toBe("string");
    expect(controller.getSnapshot()).toMatchObject({
      status: "ready",
      previewUrl: "blob:background",
      error: null,
    });
    expect(artifacts.stats()).toMatchObject({ artifacts: 1, objectUrls: 1 });

    controller.change({ type: "color", value: "#BAD" });
    expect(artifacts.stats()).toMatchObject({ artifacts: 1, objectUrls: 1 });
    expect(controller.getSnapshot().status).toBe("error");

    controller.change({ type: "color", value: "#112233" });
    expect(artifacts.stats()).toMatchObject({ artifacts: 0, leases: 0, objectUrls: 0 });
    expect(listener).toHaveBeenCalled();
    controller.dispose();
    artifacts.assertEmpty();
  });

  it("suppresses a cancelled preparation terminal", async () => {
    const artifacts = new ArtifactRepository({
      idSource: { next: () => createArtifactId("background-1") },
      memoryBudgetBytes: 1024,
      urlAdapter: { create: () => "blob:background", revoke: vi.fn() },
    });
    const drafts = new BackgroundDraftRepository(artifacts);
    let resolvePreparation!: (value: PreparedBackgroundImage) => void;
    const prepare = vi.fn<BackgroundImagePreparer["prepare"]>(
      () =>
        new Promise((resolve) => {
          resolvePreparation = resolve;
        }),
    );
    const images: BackgroundImagePreparer = { prepare };
    const harness = actorHarness();
    const controller = new BackgroundController({
      actor: () => harness.actor,
      drafts,
      images,
    });
    const pending = controller.selectImage(
      new File(["png"], "background.png", { type: "image/png" }),
    );
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    controller.cancel();
    resolvePreparation({
      blob: new Blob(["late"], { type: "image/png" }),
      mediaType: "image/png",
      width: 1,
      height: 1,
    });
    await pending;
    expect(artifacts.stats()).toMatchObject({ artifacts: 0, leases: 0 });
    expect(controller.getSnapshot()).toEqual({
      status: "ready",
      previewUrl: null,
      error: null,
    });
  });
});

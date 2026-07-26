import { describe, expect, it } from "vitest";

import {
  createEditDocumentScope,
  disposeEditDocumentScope,
  resolveEditDocumentImage,
  type EditorProcessedImage,
} from "./edit-document";

function image(result = "baseline"): EditorProcessedImage {
  return {
    source: {
      blob: new Blob(["source"], { type: "image/png" }),
      width: 2,
      height: 2,
      format: "image/png",
    },
    result: new Blob([result]),
    qualityMode: "fast",
    alphaMatte: {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([255, 255, 0, 0]),
    },
    backgroundFill: { type: "transparent" },
  };
}

describe("edit document", () => {
  it("creates immutable baseline/current references and resolves them", () => {
    const input = image();
    const scope = createEditDocumentScope(input, {
      id: "document-a",
      workerOwnerId: "worker-a",
      createdAt: 1,
    });
    expect(scope.document).toMatchObject({
      id: "document-a",
      revision: 0,
      baseline: { processingMode: "isnet-q8" },
      current: { processingMode: "isnet-q8" },
    });
    expect(scope.document.baseline).toBe(scope.document.current);
    expect(scope.workerOwnerId).toBe("worker-a");
    expect(resolveEditDocumentImage(scope)).toMatchObject({
      source: input.source,
      qualityMode: "isnet-q8",
      alphaMatte: input.alphaMatte,
    });
    expect(scope.artifacts.stats().artifactCount).toBe(2);

    disposeEditDocumentScope(scope);
    expect(scope.artifacts.stats().artifactCount).toBe(0);
  });
});

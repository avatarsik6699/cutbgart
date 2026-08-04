import { beforeEach, describe, expect, it, vi } from "vitest";

const { createNativeExportWorker } = vi.hoisted(() => ({
  createNativeExportWorker: vi.fn(),
}));

vi.mock("./export-worker-factory", () => ({ createNativeExportWorker }));

import { resizeImageInWorker } from "./export-resize-client";

describe("resizeImageInWorker", () => {
  beforeEach(() => createNativeExportWorker.mockReset());

  it("terminates the worker when postMessage throws", async () => {
    const terminate = vi.fn();
    createNativeExportWorker.mockReturnValue({
      addEventListener: vi.fn(),
      postMessage: vi.fn(() => {
        throw new Error("clone failed");
      }),
      terminate,
    });

    await expect(
      resizeImageInWorker(new Blob(), { width: 1, height: 1 }, "image/png"),
    ).rejects.toThrow("clone failed");
    expect(terminate).toHaveBeenCalledOnce();
  });
});

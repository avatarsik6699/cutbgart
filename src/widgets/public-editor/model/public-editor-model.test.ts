import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicEditorModel } from "./public-editor-model";

afterEach(() => {
  globalThis.localStorage.clear();
});

describe("PublicEditorModel", () => {
  it("publishes cached UI-only snapshots without mirroring session workflow", async () => {
    const model = new PublicEditorModel();
    const listener = vi.fn();
    const stop = model.subscribeView(listener);
    const initial = model.getViewSnapshot();

    expect(model.getViewSnapshot()).toBe(initial);
    model.chooseExportSize(1024);
    const changed = model.getViewSnapshot();
    expect(changed).not.toBe(initial);
    expect(changed).toMatchObject({
      batchMode: false,
      exportSize: 1024,
      qualityMode: "isnet-q8",
      restoreFocusTool: null,
    });
    expect(model.getViewSnapshot()).toBe(changed);
    expect(listener).toHaveBeenCalledOnce();

    model.chooseExportSize(1024);
    expect(listener).toHaveBeenCalledOnce();
    stop();
    await model.dispose();
  });

  it("hydrates the persisted quality preference after the provider boundary mounts", async () => {
    globalThis.localStorage.setItem("qualityMode", "max");
    const model = new PublicEditorModel();

    expect(model.getViewSnapshot().qualityMode).toBe("isnet-q8");
    model.hydrate();
    expect(model.getViewSnapshot().qualityMode).toBe("isnet-fp32");
    await model.dispose();
  });
});

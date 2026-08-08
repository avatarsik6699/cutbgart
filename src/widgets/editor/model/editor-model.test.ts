import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorModel } from "./editor-model";

afterEach(() => {
  globalThis.localStorage.clear();
});

describe("EditorModel", () => {
  it("publishes cached UI-only snapshots without mirroring session workflow", async () => {
    const model = new EditorModel();
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
      qualityMode: null,
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
    const model = new EditorModel();

    expect(model.getViewSnapshot().qualityMode).toBeNull();
    model.hydrate();
    expect(model.getViewSnapshot().qualityMode).toBe("isnet-fp32");
    await model.dispose();
  });

  it("selects Maximum after client initialization when no legacy preference exists", async () => {
    const model = new EditorModel();

    expect(model.getViewSnapshot().qualityMode).toBeNull();
    model.hydrate();
    expect(model.getViewSnapshot().qualityMode).toBe("ben2-fp16");
    await model.dispose();
  });
});

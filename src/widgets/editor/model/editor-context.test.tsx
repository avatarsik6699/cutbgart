import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EditorSessionTypes } from "@/editor/runtime";

import { EditorContext, useEditorSessionValue } from "./editor-context";
import type { EditorModel } from "./editor-model";
import { selectActiveFileName, selectActiveWidth } from "./editor-session-selectors";

function sessionStore() {
  const listeners = new Set<() => void>();
  let snapshot = {
    kind: "document",
    actor: null,
    backgroundRuntime: { status: "ready" },
    enhancementRuntime: { status: "idle" },
    error: null,
    fileName: "first.png",
    foregroundUrl: "blob:foreground",
    height: 600,
    magicProgress: null,
    previewUrl: "blob:preview",
    resultUrl: "blob:result",
    width: 800,
  } as unknown as EditorSessionTypes.ActiveSnapshot;
  const session = {
    getSnapshot: () => snapshot,
    subscribeActive(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as EditorSessionTypes.Session;

  return {
    model: { session } as EditorModel,
    publish(next: Partial<EditorSessionTypes.ActiveSnapshot>) {
      snapshot = { ...snapshot, ...next };
      for (const listener of listeners) listener();
    },
  };
}

describe("editor session selectors", () => {
  afterEach(cleanup);

  it("does not commit consumers whose selected value stayed stable", () => {
    const store = sessionStore();
    const renders = { fileName: 0, width: 0 };

    function FileNameProbe() {
      renders.fileName += 1;
      return <span>{useEditorSessionValue(selectActiveFileName)}</span>;
    }

    function WidthProbe() {
      renders.width += 1;
      return <span>{useEditorSessionValue(selectActiveWidth)}</span>;
    }

    render(
      <EditorContext.Provider value={store.model}>
        <FileNameProbe />
        <WidthProbe />
      </EditorContext.Provider>,
    );

    expect(renders).toEqual({ fileName: 1, width: 1 });
    act(() => store.publish({ fileName: "second.png" }));
    expect(renders).toEqual({ fileName: 2, width: 1 });
    act(() => store.publish({ resultUrl: "blob:next-result" }));
    expect(renders).toEqual({ fileName: 2, width: 1 });
  });
});

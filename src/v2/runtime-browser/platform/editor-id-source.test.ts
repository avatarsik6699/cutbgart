import { describe, expect, it } from "vitest";

import { createNativeEditorIdSource } from "./editor-id-source";

describe("createNativeEditorIdSource", () => {
  it("brands independent runtime IDs through one injected randomness boundary", () => {
    let next = 0;
    const ids = createNativeEditorIdSource(() => `uuid-${++next}`);

    expect([
      ids.artifact(),
      ids.document(),
      ids.image(),
      ids.run(),
      ids.manualDraft(),
      ids.editOperation(),
    ]).toEqual(["uuid-1", "uuid-2", "uuid-3", "uuid-4", "uuid-5", "uuid-6"]);
  });
});

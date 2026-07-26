import { describe, expect, it, vi } from "vitest";

import { EditorArtifactStore } from "./artifact-store";

describe("EditorArtifactStore", () => {
  it("deduplicates immutable values and releases unreachable object URLs", () => {
    let nextId = 0;
    const revokeObjectURL = vi.fn();
    const blob = new Blob(["result"]);
    const store = new EditorArtifactStore({
      createId: () => `artifact-${String(++nextId)}`,
      createObjectURL: (value) => `blob:${String(value.size)}`,
      revokeObjectURL,
    });
    const first = store.add("composite", blob);
    expect(store.add("foreground", blob)).toBe(first);
    store.replaceOwner("current", [first]);
    expect(store.getObjectUrl(first)).toBe("blob:6");
    expect(store.stats()).toMatchObject({
      artifactCount: 1,
      ownerCount: 1,
      objectUrlCount: 1,
    });

    store.releaseOwner("current");
    expect(store.get(first)).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:6");
  });

  it("keeps values while any baseline/current/history owner can reach them", () => {
    const store = new EditorArtifactStore();
    const baseline = store.add("composite", new Blob(["baseline"]));
    const current = store.add("composite", new Blob(["current"]));
    const history = store.add("composite", new Blob(["history"]));
    store.replaceAllOwners(
      new Map([
        ["baseline", [baseline]],
        ["current", [current]],
        ["past:0", [baseline, history]],
      ]),
    );
    expect(store.stats().artifactCount).toBe(3);

    store.replaceAllOwners(
      new Map([
        ["baseline", [baseline]],
        ["current", [current]],
      ]),
    );
    expect(store.get(history)).toBeNull();
    expect(store.get(baseline)).not.toBeNull();
    expect(store.get(current)).not.toBeNull();
  });
});

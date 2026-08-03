import { afterEach, describe, expect, it, vi } from "vitest";

import { createNativeArtifactUrlAdapter } from "./artifact-url-adapter";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native artifact URL adapter", () => {
  it("owns native object URL creation and revocation", () => {
    const createObjectURL = vi.fn(() => "blob:native-1");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const adapter = createNativeArtifactUrlAdapter();
    const blob = new Blob(["image"]);

    expect(adapter.create(blob)).toBe("blob:native-1");
    adapter.revoke("blob:native-1");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:native-1");
  });
});

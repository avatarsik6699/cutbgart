import { describe, expect, it, vi } from "vitest";

import { createNativeDownloadAdapter } from "./download-adapter";

describe("createNativeDownloadAdapter", () => {
  it("starts a named browser download without owning URL lifetime", () => {
    const anchor = document.createElement("a");
    const click = vi.spyOn(anchor, "click").mockImplementation(() => undefined);
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);

    createNativeDownloadAdapter().start("blob:result", "portrait-no-background.png");

    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor).toMatchObject({
      href: "blob:result",
      download: "portrait-no-background.png",
      rel: "noopener",
    });
    expect(click).toHaveBeenCalledOnce();
  });
});

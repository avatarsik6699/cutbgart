import { afterEach, describe, expect, it, vi } from "vitest";

import { trackEvent } from "./track-event";

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.umami;
});

describe("trackEvent", () => {
  it("is a no-op when window.umami hasn't loaded (dev/test)", () => {
    expect(() => {
      trackEvent("download_clicked");
    }).not.toThrow();
  });

  it("forwards the event name and data to window.umami.track when present", () => {
    const track = vi.fn<(event: string, data?: unknown) => void>();
    window.umami = { track };

    trackEvent("processing_completed", { qualityMode: "fast" });

    expect(track).toHaveBeenCalledWith("processing_completed", { qualityMode: "fast" });
  });

  it("drops runtime-injected source metadata and image-derived values", () => {
    const track = vi.fn<(event: string, data?: unknown) => void>();
    window.umami = { track };

    trackEvent("processing_completed", {
      qualityMode: "fast",
      fileName: "private-photo.jpg",
      sha256: "image-derived-hash",
      pixels: new Uint8Array([1, 2, 3]),
    } as never);

    expect(track).toHaveBeenCalledWith("processing_completed", {
      qualityMode: "fast",
    });
    expect(JSON.stringify(track.mock.calls)).not.toContain("private-photo");
    expect(JSON.stringify(track.mock.calls)).not.toContain("image-derived-hash");
  });
});

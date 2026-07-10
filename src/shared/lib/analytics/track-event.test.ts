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
});

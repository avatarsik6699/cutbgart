import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DownloadSplitButton } from "./download-split-button";

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe("DownloadSplitButton", () => {
  it("downloads Original from the primary action and exposes only applicable sizes", async () => {
    const anchor = document.createElement("a");
    const click = vi.fn();
    anchor.click = click;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) =>
      tag === "a" ? anchor : createElement(tag),
    );
    render(
      <DownloadSplitButton
        image={new Blob(["committed"], { type: "image/png" })}
        source={{ width: 2048, height: 1024 }}
        settings={{ format: "png", longestSide: "original" }}
        onSettingsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(anchor.download).toBe("result.png");

    fireEvent.click(screen.getByRole("button", { name: "Output options" }));
    expect(screen.queryByRole("menuitemradio", { name: "2048 px" })).toBeNull();
    expect(screen.getByRole("menuitemradio", { name: "1024 px" })).toBeDefined();
    expect(screen.getAllByText("Download")).toHaveLength(2);
    expect(screen.queryByText(/WebP|JPEG/)).toBeNull();
  });

  it("announces and isolates a selected size through the controlled settings callback", () => {
    const onSettingsChange = vi.fn();
    render(
      <DownloadSplitButton
        image={new Blob(["committed"], { type: "image/png" })}
        source={{ width: 4096, height: 2048 }}
        settings={{ format: "png", longestSide: "original" }}
        onSettingsChange={onSettingsChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Output options" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "2048 px" }));
    expect(onSettingsChange).toHaveBeenCalledWith({
      format: "png",
      longestSide: 2048,
    });
    expect(screen.getByRole("status").textContent).toContain("2048 px");
  });

  it("opens from the keyboard and offers retry plus Original fallback on resize failure", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 2000, height: 1000, close: vi.fn() }),
    );
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return { drawImage: vi.fn() };
        }
        convertToBlob() {
          return Promise.reject(new Error("encode failed"));
        }
      },
    );
    const onSettingsChange = vi.fn();
    render(
      <DownloadSplitButton
        image={new Blob(["committed"], { type: "image/png" })}
        source={{ width: 2000, height: 1000 }}
        settings={{ format: "png", longestSide: 1024 }}
        onSettingsChange={onSettingsChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Output options" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByRole("menuitemradio", { name: "Original" })).toBeDefined(),
    );
    fireEvent.keyDown(document.activeElement ?? trigger, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/could not be prepared/i),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Use Original" }));
    expect(onSettingsChange).toHaveBeenCalledWith({
      format: "png",
      longestSide: "original",
    });
  });

  it("uses Download all as the primary action without a selected batch item", async () => {
    const anchor = document.createElement("a");
    const click = vi.fn();
    anchor.click = click;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) =>
      tag === "a" ? anchor : createElement(tag),
    );
    render(
      <DownloadSplitButton
        batchItems={[
          {
            originalFileName: "one.png",
            processedImage: {
              result: new Blob(["result"], { type: "image/png" }),
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download all" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(anchor.download).toBe("cutbg-results.zip");
  });
});

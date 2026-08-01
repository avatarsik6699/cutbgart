import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode, type PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BackgroundFill, ProcessedImage } from "../../../entities/processed-image";
import { normalizeHexColor } from "./types";
import { prepareBackgroundImage, useBackgroundFill } from "./use-background-fill";

const image: ProcessedImage = {
  source: { blob: new Blob(), width: 10, height: 10, format: "image/png" },
  result: new Blob(),
  cutout: new Blob(),
  qualityMode: "fast",
  backgroundFill: { type: "transparent" },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => vi.unstubAllGlobals());

describe("background fill model", () => {
  it("normalizes valid colors and rejects invalid values", () => {
    expect(normalizeHexColor("#a1b2c3")).toBe("#A1B2C3");
    expect(normalizeHexColor("#fff")).toBeNull();
    expect(normalizeHexColor("transparent")).toBeNull();
  });

  it("previews instantly without ever calling onApply — encoding only runs on save()", () => {
    const onPreview = vi.fn();
    const onApply = vi.fn<(fill: BackgroundFill) => Promise<ProcessedImage>>();
    const onResult = vi.fn<(image: ProcessedImage) => void>();
    const { result } = renderHook(() =>
      useBackgroundFill({ image, onPreview, onApply, onResult }),
    );

    act(() => {
      result.current.selectColor("#ff0000");
      result.current.selectColor("#00ff00");
      result.current.selectColor("#0000ff");
    });

    expect(result.current.fill).toEqual({ type: "color", value: "#0000FF" });
    expect(result.current.dirty).toBe(true);
    expect(onPreview).toHaveBeenCalledTimes(3);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("encodes exactly once when save() is called, and clears dirty on success", async () => {
    const onApply = vi
      .fn<(fill: BackgroundFill) => Promise<ProcessedImage>>()
      .mockResolvedValue({
        ...image,
        backgroundFill: { type: "color", value: "#0000FF" },
      });
    const onResult = vi.fn<(image: ProcessedImage) => void>();
    const { result } = renderHook(() =>
      useBackgroundFill({ image, onPreview: vi.fn(), onApply, onResult }),
    );

    act(() => result.current.selectColor("#0000FF"));
    expect(result.current.dirty).toBe(true);

    await act(() => result.current.save());

    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledWith({ type: "color", value: "#0000FF" });
    expect(onResult).toHaveBeenCalledOnce();
    expect(result.current.dirty).toBe(false);
    expect(result.current.saving).toBe(false);
  });

  it("coalesces repeated save() calls while preserving a newer draft", async () => {
    const first = deferred<ProcessedImage>();
    const onApply = vi.fn().mockReturnValueOnce(first.promise);
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useBackgroundFill({ image, onPreview: vi.fn(), onApply, onResult }),
    );

    act(() => result.current.selectColor("#FF0000"));
    let firstSave!: Promise<void>;
    act(() => {
      firstSave = result.current.save();
    });
    act(() => result.current.selectColor("#0000FF"));
    let secondSave!: Promise<void>;
    act(() => {
      secondSave = result.current.save();
    });

    expect(secondSave).toBe(firstSave);
    expect(onApply).toHaveBeenCalledOnce();
    await act(async () => {
      first.resolve({ ...image, backgroundFill: { type: "color", value: "#FF0000" } });
      await firstSave;
    });
    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.dirty).toBe(true);
    expect(result.current.saving).toBe(false);
  });

  it("keeps the pending fill and dirty state after a failed save so it can be retried", async () => {
    const onApply = vi
      .fn<(fill: BackgroundFill) => Promise<ProcessedImage>>()
      .mockRejectedValue(new Error("compositing failed"));
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useBackgroundFill({ image, onPreview: vi.fn(), onApply, onResult }),
    );

    act(() => result.current.selectColor("#00FF00"));
    await act(() => result.current.save());

    expect(result.current.error).toBe("compositing failed");
    expect(result.current.fill).toEqual({ type: "color", value: "#00FF00" });
    expect(result.current.dirty).toBe(true);
    expect(onResult).not.toHaveBeenCalled();
  });

  it("cancels a draft and restores the committed preview without recompositing", () => {
    const onPreview = vi.fn();
    const onApply = vi.fn();
    const { result } = renderHook(() =>
      useBackgroundFill({ image, onPreview, onApply, onResult: vi.fn() }),
    );
    act(() => result.current.selectColor("#00FF00"));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.cancel());

    expect(result.current.fill).toEqual({ type: "transparent" });
    expect(result.current.dirty).toBe(false);
    expect(onPreview).toHaveBeenLastCalledWith({ type: "transparent" });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("does not let a cancelled uploaded-image preparation replace the committed fill", async () => {
    const pending = deferred<{ width: number; height: number; close: () => void }>();
    vi.stubGlobal("createImageBitmap", vi.fn().mockReturnValue(pending.promise));
    const onPreview = vi.fn();
    const { result } = renderHook(() =>
      useBackgroundFill({
        image,
        onPreview,
        onApply: vi.fn(),
        onResult: vi.fn(),
      }),
    );
    let selection!: Promise<void>;
    act(() => {
      selection = result.current.selectImage(
        new File(["jpg"], "background.jpg", { type: "image/jpeg" }),
      );
    });
    act(() => result.current.cancel());
    await act(async () => {
      pending.resolve({ width: 10, height: 10, close: vi.fn() });
      await selection;
    });
    expect(result.current.fill).toEqual({ type: "transparent" });
    expect(onPreview).toHaveBeenLastCalledWith({ type: "transparent" });
  });

  it("finishes applying under React Strict Mode", async () => {
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(StrictMode, null, children);
    const { result } = renderHook(
      () =>
        useBackgroundFill({
          image,
          onPreview: vi.fn(),
          onApply: vi.fn().mockResolvedValue({
            ...image,
            backgroundFill: { type: "color", value: "#FFFFFF" },
          }),
          onResult: vi.fn(),
        }),
      { wrapper },
    );
    act(() => result.current.selectColor("#FFFFFF"));
    await act(() => result.current.save());
    expect(result.current.busy).toBe(false);
  });

  it("closes a decoded custom image bitmap after validation", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 800, height: 600, close }),
    );
    const file = new File(["jpg"], "background.jpg", { type: "image/jpeg" });
    await expect(prepareBackgroundImage(file)).resolves.toBe(file);
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects unsupported custom-image formats before decoding", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(
      prepareBackgroundImage(new File(["gif"], "background.gif", { type: "image/gif" })),
    ).rejects.toThrow(/JPEG, PNG, or WebP/);
    expect(decode).not.toHaveBeenCalled();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UploadDropzone } from "./UploadDropzone";

function makeFile(overrides: { type?: string; size?: number } = {}): File {
  const size = overrides.size ?? 1024;
  return new File([new Uint8Array(size)], "photo.jpg", {
    type: overrides.type ?? "image/jpeg",
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("UploadDropzone", () => {
  it("exposes a real, keyboard-accessible file input", () => {
    render(<UploadDropzone onUpload={vi.fn()} />);

    const input = screen.getByLabelText("Upload an image");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveProperty("type", "file");
  });

  it("calls onUpload with a validated result when a file is chosen via the input", async () => {
    const onUpload = vi.fn();
    render(<UploadDropzone onUpload={onUpload} />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile()] },
    });

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(onUpload.mock.calls[0]?.[0]).toMatchObject({ ok: true });
  });

  it("reports preparation immediately and clears it after multiple files are ready", async () => {
    let finishDecode!: (value: ImageBitmap) => void;
    const delayedDecode = new Promise<ImageBitmap>((resolve) => {
      finishDecode = resolve;
    });
    vi.mocked(createImageBitmap).mockReturnValueOnce(delayedDecode);
    const onUploads = vi.fn();
    const onPreparationChange = vi.fn();
    render(
      <UploadDropzone
        onUpload={vi.fn()}
        onUploads={onUploads}
        onPreparationChange={onPreparationChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile(), makeFile()] },
    });

    expect(onPreparationChange).toHaveBeenCalledWith(2);
    expect(onUploads).not.toHaveBeenCalled();
    finishDecode({ width: 800, height: 600, close: vi.fn() });

    await waitFor(() => expect(onUploads).toHaveBeenCalled());
    expect(onPreparationChange).toHaveBeenLastCalledWith(0);
  });

  it("calls onUpload with an error result for an unsupported format", async () => {
    const onUpload = vi.fn();
    render(<UploadDropzone onUpload={onUpload} />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile({ type: "image/gif" })] },
    });

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(onUpload.mock.calls[0]?.[0]).toMatchObject({
      ok: false,
      error: { code: "unsupported-format" },
    });
  });

  it("calls onUpload when a file is dropped", async () => {
    const onUpload = vi.fn();
    render(<UploadDropzone onUpload={onUpload} />);

    fireEvent.drop(screen.getByLabelText("Upload an image").parentElement!, {
      dataTransfer: { files: [makeFile()] },
    });

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(onUpload.mock.calls[0]?.[0]).toMatchObject({ ok: true });
  });

  it("calls onUpload when an image is pasted from the clipboard", async () => {
    const onUpload = vi.fn();
    render(<UploadDropzone onUpload={onUpload} />);

    const file = makeFile();
    fireEvent.paste(window, {
      clipboardData: { items: [{ kind: "file", getAsFile: () => file }] },
    });

    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(onUpload.mock.calls[0]?.[0]).toMatchObject({ ok: true });
  });

  it("disables the input and ignores paste when disabled", () => {
    const onUpload = vi.fn();
    render(<UploadDropzone onUpload={onUpload} disabled />);

    expect(screen.getByLabelText("Upload an image")).toHaveProperty("disabled", true);

    fireEvent.paste(window, {
      clipboardData: { items: [{ kind: "file", getAsFile: () => makeFile() }] },
    });

    expect(onUpload).not.toHaveBeenCalled();
  });
});

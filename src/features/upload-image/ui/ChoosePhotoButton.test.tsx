import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChoosePhotoButton } from "./ChoosePhotoButton";

function makeFile(): File {
  const bytes = new Uint8Array(1024);
  bytes.set([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0x01, 0x11,
    0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  return new File([bytes], "photo.jpg", { type: "image/jpeg" });
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

describe("ChoosePhotoButton", () => {
  it("renders a real file input with mobile camera capture", () => {
    const { container } = render(<ChoosePhotoButton onUpload={vi.fn()} />);

    const input = container.querySelector("input[type='file']");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("capture")).toBe("environment");
  });

  it("calls onUpload with a validated result when a photo is chosen", async () => {
    const onUpload = vi.fn();
    const { container } = render(<ChoosePhotoButton onUpload={onUpload} />);

    const input = container.querySelector("input[type='file']")!;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() =>
      expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({ ok: true })),
    );
  });

  it("shows disabled state on the label wrapper", () => {
    render(<ChoosePhotoButton onUpload={vi.fn()} disabled />);

    expect(screen.getByText("Choose photo").closest("label")).toHaveProperty(
      "dataset.disabled",
      "true",
    );
  });
});

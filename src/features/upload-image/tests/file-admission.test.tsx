import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileAdmission } from "../ui/file-admission";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FileAdmission", () => {
  it("routes input, drop, and paste through one file boundary", () => {
    const onFiles = vi.fn();
    render(<FileAdmission onFiles={onFiles} />);
    const file = new File([new Uint8Array([1])], "photo.png", {
      type: "image/png",
    });
    const input = screen.getByLabelText(/Upload an image|Загрузить изображения/);

    expect(
      screen.getByText(/Paste from clipboard|Вставить из буфера обмена/),
    ).toBeTruthy();
    expect(screen.getByText("Ctrl/⌘ + V")).toBeTruthy();

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.drop(input.parentElement!, { dataTransfer: { files: [file] } });
    fireEvent.paste(window, {
      clipboardData: { items: [{ kind: "file", getAsFile: () => file }] },
    });

    expect(onFiles).toHaveBeenNthCalledWith(1, [file]);
    expect(onFiles).toHaveBeenNthCalledWith(2, [file]);
    expect(onFiles).toHaveBeenNthCalledWith(3, [file]);
  });

  it("keeps both inputs disabled and ignores drop and paste", () => {
    const onFiles = vi.fn();
    const view = render(<FileAdmission disabled onFiles={onFiles} />);
    const inputs = view.container.querySelectorAll("input[type='file']");

    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toHaveProperty("disabled", true);
    fireEvent.drop(inputs[0]!.parentElement!, { dataTransfer: { files: [] } });
    fireEvent.paste(window, { clipboardData: { items: [] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("preserves mobile camera capture and configurable batch input", () => {
    const onFiles = vi.fn();
    const view = render(<FileAdmission multiple={false} onFiles={onFiles} />);
    const inputs = view.container.querySelectorAll("input[type='file']");
    const first = new File([new Uint8Array([1])], "first.png", {
      type: "image/png",
    });
    const second = new File([new Uint8Array([2])], "second.png", {
      type: "image/png",
    });

    expect(inputs[0]?.hasAttribute("multiple")).toBe(false);
    expect(inputs[1]?.hasAttribute("multiple")).toBe(false);
    expect(inputs[1]?.getAttribute("capture")).toBe("environment");
    fireEvent.paste(window, {
      clipboardData: {
        items: [
          { kind: "file", getAsFile: () => first },
          { kind: "file", getAsFile: () => second },
        ],
      },
    });
    expect(onFiles).toHaveBeenCalledWith([first]);
  });

  it("keeps one paste subscription while publishing to the latest callback", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const firstOnFiles = vi.fn();
    const latestOnFiles = vi.fn();
    const view = render(<FileAdmission onFiles={firstOnFiles} />);
    const file = new File([new Uint8Array([1])], "clipboard.png", {
      type: "image/png",
    });

    expect(
      addEventListener.mock.calls.filter(([eventName]) => eventName === "paste"),
    ).toHaveLength(1);
    view.rerender(<FileAdmission onFiles={latestOnFiles} />);
    expect(
      addEventListener.mock.calls.filter(([eventName]) => eventName === "paste"),
    ).toHaveLength(1);

    fireEvent.paste(window, {
      clipboardData: { items: [{ kind: "file", getAsFile: () => file }] },
    });
    expect(firstOnFiles).not.toHaveBeenCalled();
    expect(latestOnFiles).toHaveBeenCalledWith([file]);

    view.unmount();
    expect(
      removeEventListener.mock.calls.filter(([eventName]) => eventName === "paste"),
    ).toHaveLength(1);
  });

  it("renders preparation and error feedback inside the admission surface", () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    const view = render(
      <FileAdmission
        onFiles={vi.fn()}
        state={{ kind: "preparing", message: "Preparing…", onCancel }}
      />,
    );

    expect(screen.getByRole("status").getAttribute("data-file-admission-state")).toBe(
      "preparing",
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel|Отмена/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(view.container.querySelector("input[type='file']")).toBeNull();

    view.rerender(
      <FileAdmission
        onFiles={vi.fn()}
        state={{ kind: "error", message: "Unsupported image", onRetry }}
      />,
    );
    expect(screen.getByRole("alert").getAttribute("data-file-admission-state")).toBe(
      "error",
    );
    fireEvent.click(screen.getByRole("button", { name: /Try again|Повторить/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

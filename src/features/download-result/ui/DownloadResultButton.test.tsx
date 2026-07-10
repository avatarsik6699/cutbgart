import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DownloadResultButton } from "./DownloadResultButton";

let revokeObjectURL: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("DownloadResultButton", () => {
  it("triggers a download of the result blob when clicked", () => {
    const clickSpy = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = clickSpy;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) =>
      tagName === "a" ? anchor : originalCreateElement(tagName),
    );

    render(<DownloadResultButton image={new Blob(["png"], { type: "image/png" })} />);

    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(anchor.download).toBe("result.png");
    expect(anchor.href).toContain("blob:mock-url");
  });

  it("revokes the previous object URL when the image blob changes", () => {
    const { rerender } = render(
      <DownloadResultButton image={new Blob(["a"], { type: "image/png" })} />,
    );
    rerender(<DownloadResultButton image={new Blob(["b"], { type: "image/png" })} />);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

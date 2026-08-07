import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DownloadControl } from "../download-control";

afterEach(cleanup);

describe("DownloadControl", () => {
  it("routes download, size selection, and recovery through its declarative contract", () => {
    const onDownload = vi.fn();
    const onSelectSize = vi.fn();
    const onUseOriginal = vi.fn();
    render(
      <DownloadControl
        error="resize failed"
        onDownload={onDownload}
        onSelectSize={onSelectSize}
        onUseOriginal={onUseOriginal}
        selectedSize={1024}
        sizes={["original", 1024]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /download|скачать/i }));
    expect(onDownload).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /output options|параметры/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Original" }));
    expect(onSelectSize).toHaveBeenCalledWith("original");
    fireEvent.click(screen.getByRole("button", { name: /use original|оригинал/i }));
    expect(onUseOriginal).toHaveBeenCalledOnce();
  });
});

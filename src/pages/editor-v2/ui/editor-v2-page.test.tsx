import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProcessingGateway } from "@/v2/application";
import {
  createArtifactId,
  createDocumentId,
  createImageId,
  createRunId,
} from "@/v2/domain";
import { ArtifactRepository, type EditorSessionOptions } from "@/v2/runtime-browser";

import { EditorV2Page } from "./editor-v2-page";

function sessionOptions(): EditorSessionOptions {
  const gateway: ProcessingGateway = {
    start() {
      throw new Error("Invalid input must not start processing");
    },
    dispose: vi.fn(() => Promise.resolve()),
  };
  const repository = new ArtifactRepository({
    idSource: { next: () => createArtifactId("artifact-1") },
    memoryBudgetBytes: 1024,
    urlAdapter: { create: () => "blob:test", revoke: vi.fn() },
  });
  return {
    gateway,
    repository,
    download: { start: vi.fn() },
    ids: {
      artifact: () => createArtifactId("artifact-1"),
      document: () => createDocumentId("document-1"),
      image: () => createImageId("image-1"),
      run: () => createRunId("run-1"),
    },
  };
}

describe("EditorV2Page", () => {
  it("offers one-image input, keeps an unrelated preview control live, and directs invalid input", async () => {
    render(<EditorV2Page sessionOptions={sessionOptions()} />);

    const gridButton = screen.getByRole("button", { name: /Grid|Сетка/ });
    const firstLabel = gridButton.textContent;
    fireEvent.click(gridButton);
    expect(gridButton.textContent).not.toBe(firstLabel);

    const input = screen.getByLabelText(/Choose an image|Выбрать изображение/);
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1, 2, 3])], "broken.png", { type: "image/png" }),
        ],
      },
    });

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /could not be read|Не удалось прочитать/,
      ),
    );
    expect(
      screen.queryByRole("button", {
        name: /Cutout|Enhancements|Background tool|Batch|Пакет/,
      }),
    ).toBeNull();
  });
});

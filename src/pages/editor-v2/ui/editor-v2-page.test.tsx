import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return {
    ...actual,
    SiteShell: ({ children }: { children: ReactNode }) => children,
  };
});

import type { ProcessingGateway } from "@/v2/application";
import {
  createArtifactId,
  createBackgroundDraftId,
  createDocumentId,
  createEditOperationId,
  createEnhancementDraftId,
  createImageId,
  createManualDraftId,
  createMagicCandidateId,
  createMagicDraftId,
  createRunId,
} from "@/v2/domain";
import { ArtifactRepository, type EditorSessionOptions } from "@/v2/runtime-browser";

import { EditorV2Page } from "./editor-v2-page";

afterEach(cleanup);

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
      manualDraft: () => createManualDraftId("draft-1"),
      magicDraft: () => createMagicDraftId("magic-draft-1"),
      magicCandidate: () => createMagicCandidateId("magic-candidate-1"),
      backgroundDraft: () => createBackgroundDraftId("background-draft-1"),
      enhancementDraft: () => createEnhancementDraftId("enhancement-draft-1"),
      editOperation: () => createEditOperationId("operation-1"),
    },
  };
}

describe("EditorV2Page", () => {
  it("renders the shared main-page controls and directs invalid input", async () => {
    render(<EditorV2Page sessionOptions={sessionOptions()} />);

    const heading = screen.getByRole("heading", {
      name: /Remove image backgrounds in seconds|Уберите фон с изображения за секунды/,
    });
    expect(heading).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);

    const input = screen.getByLabelText(/Upload an image|Загрузить изображения/);
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

  it("admits a bounded batch and reports files rejected beyond capacity", async () => {
    render(<EditorV2Page sessionOptions={sessionOptions()} />);
    const files = Array.from(
      { length: 21 },
      (_, index) =>
        new File([new Uint8Array([1, 2, 3])], `broken-${index + 1}.png`, {
          type: "image/png",
        }),
    );

    fireEvent.change(screen.getByLabelText(/Upload an image|Загрузить изображения/), {
      target: { files },
    });

    await waitFor(() =>
      expect(screen.getByTestId("batch-filmstrip").children).toHaveLength(20),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/up to 20|до 20/);
  });
});

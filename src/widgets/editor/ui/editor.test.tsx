import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessingGateway } from "@/editor/application";
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
} from "@/editor/domain";
import { ArtifactRepository, type EditorSessionTypes } from "@/editor/runtime";

import { EditorWorkspace } from "./editor";
import {
  EditorProvider,
  useEditorSessionSelector,
  useEditorModel,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../model";

afterEach(cleanup);

function sessionOptions(): EditorSessionTypes.Options {
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

describe("EditorWorkspace", () => {
  it("renders the shared main-page controls and directs invalid input", async () => {
    render(<EditorWorkspace sessionOptions={sessionOptions()} />);

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
    render(<EditorWorkspace sessionOptions={sessionOptions()} />);
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
    expect(screen.getByText(/up to 20|до 20/)).toBeTruthy();
  });

  it("rerenders only consumers whose selected model value changes", () => {
    const renders = { exportSize: 0, qualityMode: 0, sessionKind: 0 };
    const selectExportSize = (snapshot: EditorViewSnapshot) => snapshot.exportSize;
    const selectQualityMode = (snapshot: EditorViewSnapshot) => snapshot.qualityMode;
    const selectSessionKind = (snapshot: EditorSessionTypes.Snapshot) => snapshot.kind;

    function ExportSizeProbe() {
      renders.exportSize += 1;
      return <span>{useEditorViewSelector(selectExportSize)}</span>;
    }

    function QualityModeProbe() {
      renders.qualityMode += 1;
      return <span>{useEditorViewSelector(selectQualityMode)}</span>;
    }

    function SessionKindProbe() {
      renders.sessionKind += 1;
      return <span>{useEditorSessionSelector(selectSessionKind)}</span>;
    }

    function ModelControls() {
      const model = useEditorModel();
      return (
        <button type="button" onClick={() => model.chooseExportSize(1024)}>
          choose 1024
        </button>
      );
    }

    render(
      <EditorProvider sessionOptions={sessionOptions()}>
        <ExportSizeProbe />
        <QualityModeProbe />
        <SessionKindProbe />
        <ModelControls />
      </EditorProvider>,
    );

    expect(renders).toEqual({ exportSize: 1, qualityMode: 1, sessionKind: 1 });
    fireEvent.click(screen.getByRole("button", { name: "choose 1024" }));
    expect(renders).toEqual({ exportSize: 2, qualityMode: 1, sessionKind: 1 });
  });
});

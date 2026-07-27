import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

import { EditorStage } from "./EditorStage";

afterEach(cleanup);

describe("EditorStage", () => {
  it("keeps one labeled document footprint for its content", () => {
    const { rerender } = render(
      <EditorStage documentId="doc-1">
        <div data-testid="stage-content">image</div>
      </EditorStage>,
    );
    const stage = screen.getByTestId("editor-stage");

    rerender(
      <EditorStage documentId="doc-1">
        <div data-testid="stage-content">image</div>
      </EditorStage>,
    );

    expect(screen.getByTestId("editor-stage")).toBe(stage);
    expect(stage.getAttribute("data-stage-document-id")).toBe("doc-1");
  });

  it("reserves the stage while content is loading", () => {
    render(
      <EditorStage documentId="doc-1" loading>
        image
      </EditorStage>,
    );

    expect(screen.getByTestId("editor-stage-placeholder")).toBeDefined();
    expect(screen.getByTestId("editor-stage").getAttribute("aria-busy")).toBe("true");
  });
});

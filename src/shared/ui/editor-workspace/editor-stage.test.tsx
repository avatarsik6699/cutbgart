import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EditorStage } from "./editor-stage";

afterEach(cleanup);

describe("EditorStage", () => {
  it("places one labelled blocking overlay above the workspace while busy", () => {
    render(
      <EditorStage documentId="document-1" loading loadingLabel="Applying locally">
        <button type="button">Workspace action</button>
      </EditorStage>,
    );

    const overlay = screen.getByRole("status");
    expect(overlay.textContent).toContain("Applying locally");
    expect(overlay.querySelector(".sr-only")?.textContent).toBe("Applying locally");
    expect(overlay.children).toHaveLength(1);
    expect(overlay.className).toContain("z-40");
    expect(screen.getByTestId("editor-stage").getAttribute("aria-busy")).toBe("true");
  });
});

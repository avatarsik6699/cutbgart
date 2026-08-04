import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EditorSession } from "@/v2/runtime-browser";

import { EditorV2DocumentPanel } from "./editor-v2-document-panel";

describe("EditorV2DocumentPanel", () => {
  it("exposes bounded processing progress to assistive technology", () => {
    render(
      <EditorV2DocumentPanel
        backgroundOpen={false}
        canRedoDocument={false}
        canUndoDocument={false}
        enhancementOpen={false}
        magicOpen={false}
        manualOpen={false}
        onBeginBackground={vi.fn()}
        onBeginEnhancements={vi.fn()}
        onBeginMagic={vi.fn()}
        onBeginManual={vi.fn()}
        progress={0.42}
        revision={0}
        session={{ cancel: vi.fn() } as unknown as EditorSession}
        status="processing"
      />,
    );

    const progress = screen.getByRole("progressbar", {
      name: /Processing progress|Ход обработки/,
    });
    expect(progress.getAttribute("aria-valuemin")).toBe("0");
    expect(progress.getAttribute("aria-valuemax")).toBe("100");
    expect(progress.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText(/Shortcuts:|Клавиши:/)).toBeDefined();
  });
});

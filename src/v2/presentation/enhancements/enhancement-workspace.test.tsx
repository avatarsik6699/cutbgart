import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDocumentId,
  createEnhancementDraftId,
  type EnhancementDraft,
} from "@/v2/domain";
import type { EditorSession } from "@/v2/runtime-browser";

import { EnhancementWorkspace } from "./enhancement-workspace";

afterEach(cleanup);

const draft: EnhancementDraft = {
  kind: "enhance",
  draftId: createEnhancementDraftId("enhancement-draft-1"),
  documentId: createDocumentId("document-1"),
  baselineRevision: 1,
  selectedOperationIds: ["fine-detail", "colour-halo"],
  dirty: true,
  status: "ready",
};

function sessionHarness() {
  const calls = {
    apply: vi.fn(),
    cancel: vi.fn(),
    change: vi.fn(),
    retry: vi.fn(),
  };
  return {
    calls,
    session: {
      applyEnhancements: calls.apply,
      cancelEnhancements: calls.cancel,
      changeEnhancements: calls.change,
      retryEnhancements: calls.retry,
    } as unknown as EditorSession,
  };
}

describe("EnhancementWorkspace", () => {
  it("changes bounded operation selection and applies explicitly", () => {
    const harness = sessionHarness();
    render(
      <EnhancementWorkspace
        draft={draft}
        height={100}
        previewUrl="blob:result"
        runtime={{
          status: "ready",
          activeOperationId: null,
          fraction: null,
          error: null,
        }}
        session={harness.session}
        width={100}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Fine detail|Мелкие детали/ }));
    expect(harness.calls.change).toHaveBeenCalledWith(["colour-halo"]);
    fireEvent.click(screen.getByRole("button", { name: /^Apply$|^Применить$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));
    expect(harness.calls.apply).toHaveBeenCalledOnce();
    expect(harness.calls.cancel).toHaveBeenCalledOnce();
  });

  it("reports a no-op without implying a commit and offers retry", () => {
    const harness = sessionHarness();
    render(
      <EnhancementWorkspace
        draft={draft}
        height={100}
        previewUrl="blob:result"
        runtime={{
          status: "no-change",
          activeOperationId: null,
          fraction: null,
          error: null,
        }}
        session={harness.session}
        width={100}
      />,
    );

    expect(screen.getByRole("status").textContent).toMatch(
      /Nothing was added|В историю документа ничего не добавлено/,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Retry$|^Повторить$/ }));
    expect(harness.calls.retry).toHaveBeenCalledOnce();
  });

  it("announces the active stage and progress without model scores", () => {
    const harness = sessionHarness();
    render(
      <EnhancementWorkspace
        draft={{ ...draft, status: "running" }}
        height={100}
        previewUrl="blob:result"
        runtime={{
          status: "running",
          activeOperationId: "fine-detail",
          fraction: 0.42,
          error: null,
        }}
        session={harness.session}
        width={100}
      />,
    );

    expect(screen.getByRole("status").textContent).toMatch(/42%/);
    expect(screen.queryByText(/score|confidence|точност|уверен/i)).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDocumentId,
  createEnhancementDraftId,
  type EnhancementTypes,
} from "@/editor/domain";
import {
  EnhancementWorkspace,
  type EnhancementInteraction,
} from "./enhancement-workspace";

afterEach(cleanup);

const draft: EnhancementTypes.Draft = {
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
    interaction: {
      apply: calls.apply,
      cancel: calls.cancel,
      change: calls.change,
      retry: calls.retry,
    } satisfies EnhancementInteraction,
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
        sourceUrl="blob:source"
        interaction={harness.interaction}
        width={100}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Improve fine details|Улучшить мелкие детали/,
      }),
    );
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
        sourceUrl="blob:source"
        interaction={harness.interaction}
        width={100}
      />,
    );

    expect(screen.getByRole("status").textContent).toMatch(
      /No safe visible change|Безопасных заметных изменений/,
    );
    fireEvent.click(screen.getByRole("button", { name: /Try again|Попробовать снова/ }));
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
        sourceUrl="blob:source"
        interaction={harness.interaction}
        width={100}
      />,
    );

    expect(screen.getByRole("status").textContent).toMatch(/42%/);
    expect(screen.queryByText(/score|confidence|точност|уверен/i)).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEnhancementDraft,
  createEnhancementOperationRegistry,
} from "../enhancement-operation-registry";
import { EnhancementsToolPanel } from "../enhancements-tool-panel";

afterEach(cleanup);

describe("EnhancementsToolPanel", () => {
  const registry = createEnhancementOperationRegistry();
  const draft = createEnhancementDraft(registry, { inferencePath: "wasm" });

  it("presents benefit-labeled choices and one atomic Apply action", () => {
    const onOperationChange = vi.fn();
    const onApply = vi.fn();
    render(
      <EnhancementsToolPanel
        registry={registry}
        draft={draft}
        progress={null}
        activeOperationId={null}
        outcome={null}
        errorCode={null}
        onOperationChange={onOperationChange}
        onApply={onApply}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /improve fine details/i })).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /remove colour halo/i })).toBeDefined();
    expect(screen.getByTestId("enhancements-tool-panel").textContent).not.toMatch(
      /ViTMatte|model|provider|WASM|WebGPU|graph|MiB|skip and edit/i,
    );
    expect(screen.queryByRole("heading", { name: /enhancements/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /remove colour halo/i }));
    expect(onOperationChange).toHaveBeenCalledWith("colour-halo", false);
    fireEvent.click(screen.getByRole("button", { name: /^Apply$/ }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("offers one explicit Stop action only while an enhancement is running", () => {
    const onCancel = vi.fn();
    render(
      <EnhancementsToolPanel
        registry={registry}
        draft={{ ...draft, status: "applying" }}
        progress={45}
        activeOperationId="fine-detail"
        outcome={null}
        errorCode={null}
        onOperationChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={onCancel}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps recovery user-actionable without internal fallback text", () => {
    const onRetry = vi.fn();
    const onCancel = vi.fn();
    render(
      <EnhancementsToolPanel
        registry={registry}
        draft={{ ...draft, status: "error" }}
        progress={null}
        activeOperationId="fine-detail"
        outcome={null}
        errorCode="out-of-memory"
        onOperationChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={onCancel}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/smaller image/i);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep current result/i }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

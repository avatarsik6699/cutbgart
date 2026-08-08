import { describe, expect, it } from "vitest";

import { createDocumentId, createEnhancementDraftId } from "../ids";
import {
  changeEnhancementDraft,
  enhancementOperation,
  ENHANCEMENT_OPERATION_ORDER,
  ENHANCEMENT_OPERATION_REGISTRY,
  orderEnhancementOperations,
} from "./enhancements.policy";
import type { EnhancementTypes } from "./enhancements.types";

describe("enhancement policy", () => {
  it("freezes the typed operation registry and adapter order", () => {
    expect(ENHANCEMENT_OPERATION_REGISTRY.map(({ id }) => id)).toEqual([
      "fine-detail",
      "colour-halo",
    ]);
    expect(enhancementOperation("fine-detail").executionAdapter).toBe("matte-refinement");
    expect(Object.isFrozen(ENHANCEMENT_OPERATION_REGISTRY)).toBe(true);
    expect(ENHANCEMENT_OPERATION_REGISTRY.every(Object.isFrozen)).toBe(true);
  });
  it("deduplicates selections into the frozen execution order", () => {
    expect(
      orderEnhancementOperations(["colour-halo", "fine-detail", "colour-halo"]),
    ).toEqual(ENHANCEMENT_OPERATION_ORDER);
  });

  it("keeps selection changes as bounded draft metadata", () => {
    const draft: EnhancementTypes.Draft = {
      kind: "enhance",
      draftId: createEnhancementDraftId("enhancement-draft-1"),
      documentId: createDocumentId("document-1"),
      baselineRevision: 3,
      selectedOperationIds: [],
      dirty: false,
      status: "ready",
    };
    const changed = changeEnhancementDraft(draft, ["colour-halo", "fine-detail"]);
    expect(changed).toMatchObject({
      baselineRevision: 3,
      selectedOperationIds: ["fine-detail", "colour-halo"],
      dirty: true,
      status: "ready",
    });
    expect(draft.selectedOperationIds).toEqual([]);
  });
});

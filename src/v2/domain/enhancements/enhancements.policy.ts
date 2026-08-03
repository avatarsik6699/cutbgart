import type {
  EnhancementDraft,
  EnhancementOperationDefinition,
  EnhancementOperationId,
} from "./enhancements.types";

export const ENHANCEMENT_OPERATION_REGISTRY = Object.freeze([
  Object.freeze({
    id: "fine-detail",
    order: 10,
    executionAdapter: "matte-refinement",
    selectedByDefault: true,
  }),
  Object.freeze({
    id: "colour-halo",
    order: 20,
    executionAdapter: "foreground-cleanup",
    selectedByDefault: true,
  }),
] as const satisfies readonly EnhancementOperationDefinition[]);

export const ENHANCEMENT_OPERATION_ORDER = Object.freeze(
  ENHANCEMENT_OPERATION_REGISTRY.map(({ id }) => id),
) as readonly EnhancementOperationId[];

export function enhancementOperation(
  operationId: EnhancementOperationId,
): EnhancementOperationDefinition {
  const definition = ENHANCEMENT_OPERATION_REGISTRY.find(({ id }) => id === operationId);
  if (definition === undefined) throw new Error(`Unknown enhancement: ${operationId}`);
  return definition;
}

export function orderEnhancementOperations(
  operationIds: readonly EnhancementOperationId[],
): readonly EnhancementOperationId[] {
  const selected = new Set(operationIds);
  return ENHANCEMENT_OPERATION_ORDER.filter((operationId) => selected.has(operationId));
}

export function changeEnhancementDraft(
  draft: EnhancementDraft,
  operationIds: readonly EnhancementOperationId[],
): EnhancementDraft {
  return {
    ...draft,
    selectedOperationIds: orderEnhancementOperations(operationIds),
    dirty: true,
    status: "ready",
  };
}

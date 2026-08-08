import type { EnhancementTypes } from "./enhancements.types";

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
] as const satisfies readonly EnhancementTypes.OperationDefinition[]);

export const ENHANCEMENT_OPERATION_ORDER = Object.freeze(
  ENHANCEMENT_OPERATION_REGISTRY.map(({ id }) => id),
) as readonly EnhancementTypes.OperationId[];

export function enhancementOperation(
  operationId: EnhancementTypes.OperationId,
): EnhancementTypes.OperationDefinition {
  const definition = ENHANCEMENT_OPERATION_REGISTRY.find(({ id }) => id === operationId);
  if (definition === undefined) throw new Error(`Unknown enhancement: ${operationId}`);
  return definition;
}

export function orderEnhancementOperations(
  operationIds: readonly EnhancementTypes.OperationId[],
): readonly EnhancementTypes.OperationId[] {
  const selected = new Set(operationIds);
  return ENHANCEMENT_OPERATION_ORDER.filter((operationId) => selected.has(operationId));
}

export function changeEnhancementDraft(
  draft: EnhancementTypes.Draft,
  operationIds: readonly EnhancementTypes.OperationId[],
): EnhancementTypes.Draft {
  return {
    ...draft,
    selectedOperationIds: orderEnhancementOperations(operationIds),
    dirty: true,
    status: "ready",
  };
}

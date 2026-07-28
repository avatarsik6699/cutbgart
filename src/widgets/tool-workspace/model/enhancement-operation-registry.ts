import type { InferencePath } from "../../../entities/processed-image";
import { m } from "@/paraglide/messages";

export type EnhancementOperationId = "fine-detail" | "colour-halo";
export type EnhancementExecutionAdapter = "matte-refinement" | "foreground-cleanup";

export interface EnhancementAvailabilityContext {
  hasAlphaMatte: boolean;
  busy: boolean;
}

export interface EnhancementDefaultContext {
  inferencePath: InferencePath | null;
}

export interface EnhancementOperationDefinition {
  id: EnhancementOperationId;
  label: string;
  help: string;
  order: number;
  isAvailable: (context: EnhancementAvailabilityContext) => boolean;
  isSelectedByDefault: (context: EnhancementDefaultContext) => boolean;
  executionAdapter: EnhancementExecutionAdapter;
  historyLabel: string;
}

export interface EnhancementDraft {
  selectedOperationIds: readonly EnhancementOperationId[];
  improveDetail: boolean;
  removeColourHalo: boolean;
  dirty: boolean;
  status: "idle" | "applying" | "error";
}

const availableWithMatte = ({ hasAlphaMatte, busy }: EnhancementAvailabilityContext) =>
  hasAlphaMatte && !busy;

export function createEnhancementOperationRegistry(): readonly EnhancementOperationDefinition[] {
  const registry = [
    {
      id: "fine-detail",
      label: m.enhancementsFineDetail(),
      help: m.enhancementsFineDetailHelp(),
      order: 10,
      isAvailable: availableWithMatte,
      isSelectedByDefault: () => true,
      executionAdapter: "matte-refinement",
      historyLabel: m.enhancementsHistoryLabel(),
    },
    {
      id: "colour-halo",
      label: m.enhancementsColourHalo(),
      help: m.enhancementsColourHaloHelp(),
      order: 20,
      isAvailable: availableWithMatte,
      isSelectedByDefault: () => true,
      executionAdapter: "foreground-cleanup",
      historyLabel: m.enhancementsHistoryLabel(),
    },
  ] satisfies EnhancementOperationDefinition[];
  return registry.sort((left, right) => left.order - right.order);
}

export function createEnhancementDraft(
  registry: readonly EnhancementOperationDefinition[],
  context: EnhancementDefaultContext,
): EnhancementDraft {
  const selectedOperationIds = registry
    .filter((operation) => operation.isSelectedByDefault(context))
    .map((operation) => operation.id);
  return {
    selectedOperationIds,
    improveDetail: selectedOperationIds.includes("fine-detail"),
    removeColourHalo: selectedOperationIds.includes("colour-halo"),
    dirty: false,
    status: "idle",
  };
}

export function updateEnhancementDraft(
  draft: EnhancementDraft,
  operationId: EnhancementOperationId,
  selected: boolean,
): EnhancementDraft {
  const selectedOperationIds = selected
    ? [...new Set([...draft.selectedOperationIds, operationId])]
    : draft.selectedOperationIds.filter((id) => id !== operationId);
  return {
    ...draft,
    selectedOperationIds,
    improveDetail: selectedOperationIds.includes("fine-detail"),
    removeColourHalo: selectedOperationIds.includes("colour-halo"),
    dirty: true,
  };
}

import { useState } from "react";

import {
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
} from "../../../features/download-result";
import type { EditorToolId } from "../model/editor-tool-registry";
import type { CanvasInteractionMode } from "./canvas-view-controls";
import type { CutoutMode } from "./CutoutToolPanel";

/**
 * Owns the per-document (keyed by `activeDocumentId`) UI preferences that
 * `ToolWorkspace.tsx` previously tracked as 7 separate `useState` maps
 * directly in the component body: active tool, cutout mode, interaction
 * mode, background-draft dirtiness, export settings, before/after slider
 * position, and view-controls collapsed state. Each preference resets to a
 * sensible default whenever there's no active document, matching the
 * original inline `activeDocumentId ? map[activeDocumentId] ?? default :
 * default` pattern exactly. (PHASE_31 F-24 follow-up — first slice of the
 * component's own state, distinct from the `use-tool-workspace-controller.ts`
 * hook-only slices.)
 */
export function useDocumentUiState(activeDocumentId: string | null) {
  const [toolByDocument, setToolByDocument] = useState<Record<string, EditorToolId>>({});
  const [cutoutModeByDocument, setCutoutModeByDocument] = useState<
    Record<string, CutoutMode>
  >({});
  const [interactionModeByDocument, setInteractionModeByDocument] = useState<
    Record<string, CanvasInteractionMode>
  >({});
  const [backgroundDraftByDocument, setBackgroundDraftByDocument] = useState<
    Record<string, boolean>
  >({});
  const [exportSettingsByDocument, setExportSettingsByDocument] = useState<
    Record<string, ExportSettings>
  >({});
  const [viewPositionByDocument, setViewPositionByDocument] = useState<
    Record<string, number>
  >({});
  const [viewControlsCollapsedByDocument, setViewControlsCollapsedByDocument] = useState<
    Record<string, boolean>
  >({});

  const activeTool: EditorToolId = activeDocumentId
    ? (toolByDocument[activeDocumentId] ?? "cutout")
    : "cutout";
  const cutoutMode: CutoutMode = activeDocumentId
    ? (cutoutModeByDocument[activeDocumentId] ?? "magic")
    : "magic";
  const interactionMode: CanvasInteractionMode = activeDocumentId
    ? (interactionModeByDocument[activeDocumentId] ?? "brush")
    : "brush";
  const backgroundDraftDirty = activeDocumentId
    ? Boolean(backgroundDraftByDocument[activeDocumentId])
    : false;
  const exportSettings: ExportSettings = activeDocumentId
    ? (exportSettingsByDocument[activeDocumentId] ?? DEFAULT_EXPORT_SETTINGS)
    : DEFAULT_EXPORT_SETTINGS;
  const viewPosition = activeDocumentId
    ? (viewPositionByDocument[activeDocumentId] ?? 50)
    : 50;
  const viewControlsCollapsed = activeDocumentId
    ? Boolean(viewControlsCollapsedByDocument[activeDocumentId])
    : false;

  function activateTool(tool: EditorToolId) {
    if (!activeDocumentId) return;
    setToolByDocument((current) => ({ ...current, [activeDocumentId]: tool }));
  }

  function setCutoutMode(mode: CutoutMode) {
    if (!activeDocumentId) return;
    setCutoutModeByDocument((current) => ({ ...current, [activeDocumentId]: mode }));
  }

  function setInteractionMode(mode: CanvasInteractionMode) {
    if (!activeDocumentId) return;
    setInteractionModeByDocument((current) => ({ ...current, [activeDocumentId]: mode }));
  }

  function setBackgroundDraftDirty(dirty: boolean) {
    if (!activeDocumentId) return;
    setBackgroundDraftByDocument((current) => ({
      ...current,
      [activeDocumentId]: dirty,
    }));
  }

  function setExportSettings(settings: ExportSettings) {
    if (!activeDocumentId) return;
    setExportSettingsByDocument((current) => ({
      ...current,
      [activeDocumentId]: settings,
    }));
  }

  function setViewPosition(position: number) {
    if (!activeDocumentId) return;
    setViewPositionByDocument((current) => ({
      ...current,
      [activeDocumentId]: position,
    }));
  }

  function setViewControlsCollapsed(collapsed: boolean) {
    if (!activeDocumentId) return;
    setViewControlsCollapsedByDocument((current) => ({
      ...current,
      [activeDocumentId]: collapsed,
    }));
  }

  return {
    activeTool,
    activateTool,
    cutoutMode,
    setCutoutMode,
    interactionMode,
    setInteractionMode,
    backgroundDraftDirty,
    setBackgroundDraftDirty,
    exportSettings,
    setExportSettings,
    viewPosition,
    setViewPosition,
    viewControlsCollapsed,
    setViewControlsCollapsed,
  };
}

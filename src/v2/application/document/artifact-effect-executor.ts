import type { DocumentEffect } from "@/v2/domain";

import type { DocumentMachineDependencies } from "./document-machine.types";

export function executeArtifactEffect(
  dependencies: DocumentMachineDependencies,
  effect: DocumentEffect,
): boolean | null {
  switch (effect.type) {
    case "export-png":
      dependencies.artifacts.exportPng(effect);
      return null;
    case "promote-run":
      return dependencies.artifacts.promoteRun(effect);
    case "release-document":
      dependencies.artifacts.releaseDocument(effect);
      return null;
    case "release-run-if-owned":
      dependencies.artifacts.releaseRun(effect);
      return null;
    case "start-processing":
    case "cancel-processing":
      return null;
  }
}

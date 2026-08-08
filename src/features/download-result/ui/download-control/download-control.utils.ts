import { m } from "@/paraglide/messages";

import type { ExportSize } from "../../model/types";

export function exportSizeLabel(size: ExportSize): string {
  return size === "original" ? m.exportOriginal() : `${String(size)} px`;
}

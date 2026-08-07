import { m } from "@/paraglide/messages";

import type { MainPageEditorTypes } from "../main-page-editor.types";

export function admissionErrorText(error: MainPageEditorTypes.AdmissionError): string {
  if (error === "unsupported-file") return m.uploadUnsupported({ format: "unknown" });
  if (error === "exceeds-size-limit") return m.uploadTooLarge();
  if (error === "multiple-files") return m.uploadSingleOnly();
  return m.editorV2InvalidImage();
}

import type { UploadValidationError } from "../../../features/upload-image";
import { Button } from "@/shared/ui";
import { m } from "@/paraglide/messages";

function localizedUploadError(error: UploadValidationError): string {
  if (error.code === "unsupported-format") {
    const format = error.message.match(/"([^"]+)"/)?.[1] ?? "unknown";
    return m.uploadUnsupported({ format });
  }
  if (error.code === "exceeds-size-limit") return m.uploadTooLarge();
  return m.uploadResolutionError();
}

export interface UploadErrorNoticeProps {
  error: UploadValidationError;
  onDismiss: () => void;
}

// Renders in place inside the owning upload surface (idle dropzone or batch
// "add images" row) instead of a separate grid area, so an invalid file
// never hides the upload controls or shifts them down the page (PHASE_31
// T8/F7).
export function UploadErrorNotice({ error, onDismiss }: UploadErrorNoticeProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <p>{localizedUploadError(error)}</p>
      <Button type="button" variant="outline" onClick={onDismiss} className="self-start">
        {m.tryAgain()}
      </Button>
    </div>
  );
}

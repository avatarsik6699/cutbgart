import {
  selectDocumentError,
  selectHasAutomaticReprocessError,
} from "@/editor/application";
import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

import { useActiveDocumentActorSelector } from "../../model";

export function DocumentError() {
  const error = useActiveDocumentActorSelector(selectDocumentError);
  const automaticReprocessError = useActiveDocumentActorSelector(
    selectHasAutomaticReprocessError,
  );
  if (error === null && !automaticReprocessError) return null;

  return (
    <Typography
      variant="body-small"
      as="p"
      role="alert"
      className="text-destructive [grid-area:error]"
    >
      {automaticReprocessError ? m.editorModelReprocessFailed() : error}
    </Typography>
  );
}

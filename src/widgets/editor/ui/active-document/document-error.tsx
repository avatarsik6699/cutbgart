import { selectDocumentError } from "@/editor/application";
import { Typography } from "@/shared/ui";

import { useActiveDocumentActorSelector } from "../../model";

export function DocumentError() {
  const error = useActiveDocumentActorSelector(selectDocumentError);
  if (error === null) return null;

  return (
    <Typography
      variant="body-small"
      as="p"
      role="alert"
      className="text-destructive [grid-area:error]"
    >
      {error}
    </Typography>
  );
}

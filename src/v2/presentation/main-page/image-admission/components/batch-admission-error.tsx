import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

import type { MainPageEditorTypes } from "../../main-page-editor.types";

type Props = Readonly<{
  admissionError: NonNullable<MainPageEditorTypes.BatchProjection["admissionError"]>;
  limit: MainPageEditorTypes.BatchProjection["capacity"]["limit"];
}>;

export function BatchAdmissionError(props: Props) {
  return (
    <Typography
      variant="body-small"
      as="p"
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
    >
      {m.batchCapacityExceeded({
        limit: String(props.limit),
        rejected: String(props.admissionError.rejectedCount),
      })}
    </Typography>
  );
}

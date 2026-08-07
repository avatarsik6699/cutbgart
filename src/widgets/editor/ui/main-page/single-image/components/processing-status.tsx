import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

import { DelayedProcessingExplanation } from "./delayed-processing-explanation";

type Props = Readonly<{
  fallbackUsed: boolean;
  processing: boolean;
  statusText: string;
}>;

export function ProcessingStatus(props: Props) {
  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">
        {props.statusText}
      </div>
      {props.processing ? <DelayedProcessingExplanation /> : null}
      {props.fallbackUsed ? (
        <Typography
          variant="body-small"
          as="p"
          role="status"
          className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 [grid-area:notice]"
        >
          {m.processingFallbackNotice()}
        </Typography>
      ) : null}
    </>
  );
}

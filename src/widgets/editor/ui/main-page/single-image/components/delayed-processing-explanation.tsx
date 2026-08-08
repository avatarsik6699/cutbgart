import { useEffect, useState } from "react";

import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

/** Normal runs stay quiet; sustained local work receives one deterministic explanation. */
export const PROCESSING_EXPLANATION_DELAY_MS = 10_000;

export function DelayedProcessingExplanation() {
  const [visible, setVisible] = useState(false);

  useEffect(function revealDelayedProcessingExplanationFx() {
    const timeout = window.setTimeout(() => {
      setVisible(true);
    }, PROCESSING_EXPLANATION_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;
  return (
    <Typography
      variant="body-small"
      as="p"
      role="status"
      data-testid="delayed-processing-explanation"
      className="rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground [grid-area:notice]"
    >
      {m.processingDelayedExplanation()}
    </Typography>
  );
}

import { CircleAlert, LoaderCircle } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { Button, Typography } from "@/shared/ui";

import type { FileAdmissionTypes } from "../file-admission.types";

type Props = Readonly<{
  className?: string;
  state: Exclude<FileAdmissionTypes.State, { kind: "idle" }>;
}>;

export function FileAdmissionStatus(props: Props) {
  const preparing = props.state.kind === "preparing";

  return (
    <div
      role={preparing ? "status" : "alert"}
      aria-live="polite"
      data-file-admission-state={props.state.kind}
      className={cn(
        "flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background/50 p-6 text-center backdrop-blur-sm sm:min-h-64",
        props.className,
      )}
    >
      {preparing ? (
        <LoaderCircle
          className="size-8 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
      )}
      <Typography
        variant="body-small"
        as="p"
        className={preparing ? "text-muted-foreground" : "text-destructive"}
      >
        {props.state.message}
      </Typography>
      <Button
        type="button"
        variant="outline"
        onClick={preparing ? props.state.onCancel : props.state.onRetry}
      >
        {preparing ? m.cancel() : m.tryAgain()}
      </Button>
    </div>
  );
}

import { m } from "@/paraglide/messages";
import { Button, Typography } from "@/shared/ui";

type Props = Readonly<{
  onReset: () => void;
  onRetry: () => void;
  retryable: boolean;
}>;

export function ProcessingRecovery(props: Props) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive [grid-area:error]"
    >
      <Typography variant="body-small" as="p" className="leading-5 text-destructive">
        {m.editorRuntimeFailure()}
      </Typography>
      <div className="flex gap-2">
        {props.retryable ? (
          <Button variant="outline" onClick={props.onRetry}>
            {m.tryAgain()}
          </Button>
        ) : null}
        <Button variant="outline" onClick={props.onReset}>
          {m.reset()}
        </Button>
      </div>
    </div>
  );
}

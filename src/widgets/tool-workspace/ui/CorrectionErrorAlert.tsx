import { Button } from "@/shared/ui";
import { m } from "@/paraglide/messages";

export type DisplayError = { message: string; action: "retry" | "reset" };

export interface CorrectionErrorAlertProps {
  error: DisplayError;
  onRetry: () => void;
  onReset: () => void;
}

export function CorrectionErrorAlert({
  error,
  onRetry,
  onReset,
}: CorrectionErrorAlertProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <p>{error.message}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onRetry}>
          {m.tryAgain()}
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          {m.reset()}
        </Button>
      </div>
    </div>
  );
}

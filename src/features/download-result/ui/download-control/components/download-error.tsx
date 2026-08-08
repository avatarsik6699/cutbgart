import { m } from "@/paraglide/messages";
import { Button, Typography } from "@/shared/ui";

type Props = Readonly<{
  message: string;
  onRetry(): void;
  onUseOriginal?(): void;
  showOriginalFallback: boolean;
}>;

export function DownloadError(props: Props) {
  return (
    <div
      role="alert"
      className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-destructive/40 bg-background p-3 text-sm shadow-lg"
    >
      <Typography variant="body-small" as="p">
        {props.message}
      </Typography>
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>
          {m.tryAgain()}
        </Button>
        {props.showOriginalFallback && props.onUseOriginal !== undefined ? (
          <Button type="button" variant="outline" size="sm" onClick={props.onUseOriginal}>
            {m.exportUseOriginal()}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

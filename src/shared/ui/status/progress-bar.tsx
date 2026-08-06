import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  label?: string;
}

function ProgressBar({
  value,
  className,
  label = m.editorV2Progress(),
}: ProgressBarProps) {
  const rounded = Math.round(value);
  return (
    <div
      data-slot="progress-bar"
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full bg-primary" style={{ width: `${String(rounded)}%` }} />
    </div>
  );
}

export { ProgressBar };

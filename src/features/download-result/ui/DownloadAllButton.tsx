import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { m } from "@/paraglide/messages";
import { createResultsZip } from "../lib/create-results-zip";

interface DownloadableItem {
  originalFileName: string;
  processedImage?: { result: Blob; backgroundPending?: boolean };
}

export function DownloadAllButton({
  items,
  disabled = false,
  className,
}: {
  items: DownloadableItem[];
  disabled?: boolean;
  className?: string;
}) {
  const completed = items.filter((item) => item.processedImage);
  return (
    <Button
      type="button"
      disabled={
        disabled ||
        !completed.length ||
        completed.some((item) => item.processedImage?.backgroundPending)
      }
      onClick={() => {
        void createResultsZip(completed).then((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "cutbg-results.zip";
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 0);
        });
      }}
      className={cn(className)}
    >
      {m.downloadAll()}
    </Button>
  );
}

import { Button } from "@/shared/ui";
import { createResultsZip } from "../lib/create-results-zip";

interface DownloadableItem {
  originalFileName: string;
  processedImage?: { result: Blob; backgroundPending?: boolean };
}

export function DownloadAllButton({
  items,
  disabled = false,
}: {
  items: DownloadableItem[];
  disabled?: boolean;
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
    >
      Download all as ZIP
    </Button>
  );
}

import { Download } from "lucide-react";
import { useEffect, useRef } from "react";

import { trackEvent } from "@/shared/lib/analytics";
import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";

export interface DownloadResultButtonProps {
  /** Composited PNG-with-alpha result (`ProcessedImage.result`, Phase 02). */
  image: Blob;
  fileName?: string;
  disabled?: boolean;
}

/**
 * PNG-with-alpha download button (SPEC.md §2.2, §5.2). Owns a single object
 * URL for `image`, revoking it whenever a new result blob arrives (recompute
 * / process-another-image) or the component unmounts — never left dangling.
 */
export function DownloadResultButton({
  image,
  fileName = "result.png",
  disabled = false,
}: DownloadResultButtonProps) {
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(image);
    urlRef.current = url;
    return () => {
      URL.revokeObjectURL(url);
      urlRef.current = null;
    };
  }, [image]);

  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={() => {
        const url = urlRef.current;
        if (!url) return;
        trackEvent("download_clicked");
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
      }}
    >
      <Download aria-hidden="true" />
      {m.download()}
    </Button>
  );
}

import type { ExportSize } from "../../model/types";

export declare namespace DownloadControlTypes {
  type Props = Readonly<{
    announcement?: string;
    busy?: boolean;
    className?: string;
    disabled?: boolean;
    error?: string | null;
    onDownload(): void;
    onRetry?(): void;
    onSelectSize(size: ExportSize): void;
    onUseOriginal?(): void;
    selectedSize: ExportSize;
    sizes: readonly ExportSize[];
  }>;
}

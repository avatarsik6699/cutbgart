import type { ExportSize } from "../../model/types";

export declare namespace DownloadControlTypes {
  type BatchZipOption = Readonly<{
    busy: boolean;
    disabled: boolean;
    label: string;
    onClick(): void;
  }>;

  type Props = Readonly<{
    announcement?: string;
    batchZip?: BatchZipOption;
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

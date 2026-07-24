interface ZipResultItem {
  originalFileName: string;
  processedImage?: { result: Blob };
}

export function createUniqueResultNames(
  items: Pick<ZipResultItem, "originalFileName">[],
): string[] {
  return items.map((_, index) => `cutbg-result-${String(index + 1)}.png`);
}

export async function createResultsZip(items: ZipResultItem[]): Promise<Blob> {
  const completed = items.filter((item) => item.processedImage);
  const names = createUniqueResultNames(completed);
  const { downloadZip } = await import("client-zip");
  return downloadZip(
    completed.map((item, index) => ({
      name: names[index],
      input: item.processedImage!.result,
      // ZIP's DOS timestamp is metadata too. A fixed epoch makes exports
      // deterministic and cannot reveal source-file or session timestamps.
      lastModified: new Date("1980-01-01T00:00:00.000Z"),
    })),
  ).blob();
}

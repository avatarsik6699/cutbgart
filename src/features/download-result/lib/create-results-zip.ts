interface ZipResultItem {
  originalFileName: string;
  processedImage?: { result: Blob };
}

function sanitizeBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return (
    withoutExtension
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^[.-]+|[.-]+$/g, "") || "result"
  );
}

export function createUniqueResultNames(
  items: Pick<ZipResultItem, "originalFileName">[],
): string[] {
  const counts = new Map<string, number>();
  return items.map((item) => {
    const base = sanitizeBaseName(item.originalFileName);
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return `${base}${count === 1 ? "" : `-${String(count)}`}.png`;
  });
}

export async function createResultsZip(items: ZipResultItem[]): Promise<Blob> {
  const completed = items.filter((item) => item.processedImage);
  const names = createUniqueResultNames(completed);
  const { downloadZip } = await import("client-zip");
  return downloadZip(
    completed.map((item, index) => ({
      name: names[index],
      input: item.processedImage!.result,
      lastModified: new Date(),
    })),
  ).blob();
}

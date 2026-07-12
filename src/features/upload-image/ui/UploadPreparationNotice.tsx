export function UploadPreparationNotice({ fileCount }: { fileCount: number }) {
  if (fileCount <= 0) return null;

  return (
    <div
      role="status"
      data-testid="upload-preparation"
      className="overflow-hidden rounded-lg border border-border bg-muted/40"
    >
      <div className="flex items-start gap-3 p-3">
        <span
          className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium">
            Preparing {fileCount} {fileCount === 1 ? "image" : "images"}…
          </p>
          <p className="text-xs text-muted-foreground">
            Reading files in your browser. Processing will start automatically.
          </p>
        </div>
      </div>
      <div className="h-1 bg-muted">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/70" />
      </div>
    </div>
  );
}

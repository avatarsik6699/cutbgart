import type { ChangeEvent } from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type {
  ActiveEditorSessionSnapshot,
  EditorSession,
  EditorWorkspaceSnapshot,
  WorkspaceItemSummary,
} from "@/v2/runtime-browser";
import { Image, Typography } from "@/v2/shared/ui";

type Props = {
  active: ActiveEditorSessionSnapshot | null;
  session: EditorSession;
  workspace: EditorWorkspaceSnapshot;
};

function itemLabel(item: WorkspaceItemSummary): string {
  if (item.status === "preparing") return m.editorV2BatchPreparing();
  if (item.status === "result") return m.editorV2BatchResult();
  if (item.status === "error") return m.editorV2BatchError();
  if (item.queuePosition !== null)
    return m.editorV2QueuePosition({ position: String(item.queuePosition) });
  return m.editorV2BatchProcessing();
}

function errorDetail(item: WorkspaceItemSummary): string | null {
  if (item.error === null) return null;
  if (typeof item.error === "string") return item.error;
  return `${item.error.code}: ${item.error.message}`;
}

export function EditorWorkspaceStrip(props: Props) {
  const completed = props.workspace.items.filter(
    (item) => item.status === "result",
  ).length;
  const failed = props.workspace.items.filter((item) => item.status === "error").length;
  const activeDocument = props.active?.actor.getSnapshot().context.document ?? null;
  const activeDraftDirty = activeDocument?.activeDraft?.dirty === true;

  function addImagesFx(event: ChangeEvent<HTMLInputElement>): void {
    const files = [...(event.currentTarget.files ?? [])];
    if (files.length > 0) void props.session.importImages(files);
    event.currentTarget.value = "";
  }

  function removeFx(item: WorkspaceItemSummary): void {
    const activeWork =
      item.documentId === activeDocument?.documentId &&
      (activeDraftDirty || !["ready", "result", "error"].includes(activeDocument.status));
    if (activeWork && !globalThis.confirm(m.editorV2RemoveGuard())) return;
    props.session.removeItem(item.itemId);
  }

  return (
    <section
      className="border-border bg-card/70 mb-4 rounded-xl border p-3 sm:p-4"
      aria-label={m.editorV2BatchTitle()}
      data-testid="v2-workspace-strip"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="label" as="h2" className="uppercase tracking-[0.16em]">
            {m.editorV2BatchTitle()}
          </Typography>
          <Typography
            variant="caption"
            as="p"
            className="text-muted-foreground mt-1 font-mono"
          >
            {m.editorV2BatchSummary({
              completed: String(completed),
              failed: String(failed),
              total: String(props.workspace.items.length),
            })}
          </Typography>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="border-input bg-background hover:bg-accent focus-within:ring-ring inline-flex h-9 cursor-pointer items-center rounded-md border px-3 font-mono text-sm focus-within:ring-2">
            {m.editorV2AddImages()}
            <input
              className="sr-only"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={addImagesFx}
            />
          </label>
          <Button
            size="sm"
            onClick={() => void props.session.exportAll()}
            disabled={completed === 0 || props.workspace.export.status === "preparing"}
          >
            {m.editorV2DownloadAll()}
          </Button>
        </div>
      </div>
      <ol
        className="focus-visible:ring-ring grid grid-flow-col auto-cols-[minmax(10rem,13rem)] gap-2 overflow-x-auto pb-1 focus-visible:ring-2"
        tabIndex={0}
        aria-label={m.editorV2BatchTitle()}
      >
        {props.workspace.items.map((item, index) => {
          const selected = item.documentId === props.workspace.selectedDocumentId;
          return (
            <li
              key={item.itemId}
              className={
                selected
                  ? "border-primary bg-primary/5 grid grid-cols-[3.25rem_1fr_auto] items-center gap-2 rounded-lg border-2 p-2"
                  : "border-border bg-background/70 grid grid-cols-[3.25rem_1fr_auto] items-center gap-2 rounded-lg border p-2"
              }
              aria-current={selected ? "true" : undefined}
            >
              <button
                type="button"
                className="bg-muted focus-visible:ring-ring relative grid aspect-square overflow-hidden rounded-md focus-visible:ring-2"
                aria-label={m.editorV2SelectImage({ name: item.fileName })}
                disabled={item.documentId === null}
                onClick={() => {
                  if (item.documentId !== null)
                    props.session.selectDocument(item.documentId);
                }}
              >
                {item.previewUrl !== null ? (
                  <Image
                    src={item.previewUrl}
                    decorative
                    preset="thumbnail"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="place-self-center font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                )}
              </button>
              <div className="min-w-0">
                <Typography variant="caption" as="p" className="truncate font-mono">
                  {item.fileName}
                </Typography>
                <Typography
                  variant="caption"
                  as="p"
                  className="text-muted-foreground mt-1"
                >
                  {itemLabel(item)}
                </Typography>
                {errorDetail(item) !== null ? (
                  <Typography
                    variant="caption"
                    as="p"
                    className="text-destructive mt-1 line-clamp-2"
                  >
                    {errorDetail(item)}
                  </Typography>
                ) : null}
                {item.status === "error" ? (
                  <button
                    type="button"
                    className="text-primary mt-1 min-h-6 text-xs underline underline-offset-2"
                    onClick={() => void props.session.retryItem(item.itemId)}
                  >
                    {m.editorV2RetryImage({ name: item.fileName })}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive focus-visible:ring-ring size-6 rounded font-mono text-sm focus-visible:ring-2"
                aria-label={m.editorV2RemoveImage({ name: item.fileName })}
                onClick={() => removeFx(item)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
      {props.workspace.export.includedCount > 0 ? (
        <Typography
          variant="caption"
          as="p"
          role="status"
          className="text-muted-foreground mt-2 font-mono"
        >
          {m.editorV2DownloadAllSummary({
            included: String(props.workspace.export.includedCount),
            skipped: String(props.workspace.export.skippedCount),
          })}
        </Typography>
      ) : null}
    </section>
  );
}

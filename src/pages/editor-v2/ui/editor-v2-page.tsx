import { useState } from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import { EditorWorkspaceStrip, useEditorSession } from "@/v2/presentation";
import type { EditorSessionOptions } from "@/v2/runtime-browser";
import { useIsHydrated } from "@/v2/shared/lib";
import { Typography } from "@/v2/shared/ui";

import { EditorV2ActiveDocument } from "./editor-v2-active-document";
import { EditorV2Stage } from "./editor-v2-stage";
import { EditorV2StatusRail } from "./editor-v2-status-rail";

type Props = {
  sessionOptions?: EditorSessionOptions;
};

export function EditorV2Page(props: Props) {
  const editor = useEditorSession(props.sessionOptions);
  const [grid, setGrid] = useState<"fine" | "wide">("fine");
  const hydrated = useIsHydrated();
  const workspace = editor.session.workspaceSnapshot();

  function toggleGridFx(): void {
    setGrid((current) => (current === "fine" ? "wide" : "fine"));
  }

  return (
    <main
      className="bg-background text-foreground min-h-screen px-4 py-5 sm:px-6 sm:py-8"
      data-hydrated={hydrated}
      data-artifact-count={editor.session.resources().artifacts}
      data-lease-count={editor.session.resources().leases}
      data-object-url-count={editor.session.resources().objectUrls}
    >
      <div className="mx-auto max-w-[92rem]">
        <header className="border-border mb-5 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
          <div>
            <Typography
              variant="label"
              as="p"
              className="text-local mb-2 font-mono uppercase tracking-[0.18em]"
            >
              cutbg / editor v2
            </Typography>
            <Typography variant="display" as="h1" className="max-w-4xl text-balance">
              {m.editorV2Title()}
            </Typography>
          </div>
          <Button variant="outline" size="sm" onClick={toggleGridFx}>
            {grid === "fine" ? m.editorV2GridFine() : m.editorV2GridWide()}
          </Button>
        </header>

        {workspace.items.length > 0 ? (
          <EditorWorkspaceStrip
            active={editor.snapshot.kind === "document" ? editor.snapshot : null}
            session={editor.session}
            workspace={workspace}
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {editor.snapshot.kind === "document" ? (
            <EditorV2ActiveDocument
              grid={grid}
              session={editor.session}
              snapshot={editor.snapshot}
            />
          ) : (
            <>
              <EditorV2StatusRail
                status={editor.snapshot.kind === "preparing" ? "preparing" : "empty"}
              />
              <EditorV2Stage
                fileName={editor.snapshot.fileName}
                grid={grid}
                height={editor.snapshot.height}
                onFiles={(files) => void editor.session.importImages(files)}
                previewUrl={editor.snapshot.previewUrl}
                resultUrl={editor.snapshot.resultUrl}
                status={editor.snapshot.kind === "preparing" ? "preparing" : "empty"}
                width={editor.snapshot.width}
              />
            </>
          )}
        </div>

        {editor.snapshot.error !== null ? (
          <Typography
            variant="body-small"
            as="p"
            role="alert"
            className="text-destructive mt-4"
          >
            {m.editorV2InvalidImage()}
          </Typography>
        ) : null}
      </div>
    </main>
  );
}

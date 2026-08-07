import { m } from "@/paraglide/messages";

export function CanvasWorkspaceActiveIndicator({
  active,
}: Readonly<{ active: boolean }>) {
  return (
    <span
      className="pointer-events-none absolute left-3 top-3 z-30 rounded-full border border-primary/25 bg-card/90 px-3 py-1 font-mono text-[0.6875rem] font-semibold text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity data-[active=true]:opacity-100 motion-reduce:transition-none"
      data-active={active}
      aria-hidden={!active}
    >
      {m.editorWorkspaceControlsActive()}
    </span>
  );
}

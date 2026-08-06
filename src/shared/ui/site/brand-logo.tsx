import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";

/**
 * Open-corner square + checkerboard mark: the corner that's "missing" from
 * the frame is where the checker pattern (the app's own transparency
 * convention, see `editor-stage-grid`/checkerboard canvas) shows through —
 * literally depicting "cut background, transparency revealed." Pure
 * currentColor/theme tokens, no raster asset, so it never carries a baked-in
 * canvas color across light/dark themes.
 */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-6", className)}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M28 17V11A7 7 0 0 0 21 4H11A7 7 0 0 0 4 11V21A7 7 0 0 0 11 28H17"
        stroke="var(--color-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="16" y="16" width="5" height="5" className="fill-muted-foreground/60" />
      <rect x="22" y="22" width="5" height="5" className="fill-muted-foreground/60" />
      <rect x="22" y="16" width="5" height="5" className="fill-muted-foreground/25" />
      <rect x="16" y="22" width="5" height="5" className="fill-muted-foreground/25" />
    </svg>
  );
}

function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark />
      <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
        {m.brandName()}
        <span className="text-primary">.art</span>
      </span>
    </span>
  );
}

export { BrandLogo };

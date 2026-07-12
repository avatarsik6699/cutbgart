import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";

const TELEGRAM_FEEDBACK_URL = "https://t.me/+HaqBWI1A3vg4MWJi";

function SiteFooter({ className }: { className?: string }) {
  return (
    <footer data-slot="site-footer" className={cn("border-t border-border", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <Link to="/" aria-label={m.brandName()} className="w-fit">
              <img src="/logo.png" alt={m.brandName()} className="h-8 w-auto" />
            </Link>
            <p className="text-sm text-muted-foreground">{m.footerTagline()}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/about" className="text-muted-foreground hover:text-foreground">
              {m.navAbout()}
            </Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
              {m.footerPrivacy()}
            </Link>
            <a
              href={TELEGRAM_FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {m.navFeedback()}
            </a>
          </nav>
        </div>
        <div className="flex flex-col gap-1 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{m.footerTrust()}</p>
          <p>{m.footerCopyright({ year: String(new Date().getFullYear()) })}</p>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };

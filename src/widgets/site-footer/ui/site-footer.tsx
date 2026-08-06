import { m } from "@/paraglide/messages";
import { cn, currentLocalYear } from "@/shared/lib";
import { BrandLogo, FeedbackLink, SiteLink, Typography } from "@/shared/ui";

type Props = Readonly<{ className?: string }>;

function SiteFooter(props: Props) {
  return (
    <footer
      data-slot="site-footer"
      className={cn("border-t border-border", props.className)}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <SiteLink to="/" variant="plain" aria-label={m.brandName()} className="w-fit">
              <BrandLogo />
            </SiteLink>
            <Typography variant="body-muted">{m.footerTagline()}</Typography>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <SiteLink to="/about" variant="footer">
              {m.navAbout()}
            </SiteLink>
            <SiteLink to="/privacy" variant="footer">
              {m.footerPrivacy()}
            </SiteLink>
            <FeedbackLink variant="footer" />
          </nav>
        </div>
        <div className="flex flex-col gap-1 border-t border-border pt-4 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Typography variant="caption-muted" className="font-mono">
            {m.footerTrust()}
          </Typography>
          <Typography variant="caption-muted" className="font-mono">
            {m.footerCopyright({ year: currentLocalYear() })}
          </Typography>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };

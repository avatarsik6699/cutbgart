import { Link, useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { m } from "@/paraglide/messages";
import { getLocale, localizeHref, locales } from "@/paraglide/runtime";
import { cn } from "@/shared/lib/utils";

const TELEGRAM_FEEDBACK_URL = "https://t.me/+HaqBWI1A3vg4MWJi";

const LOCALE_LABELS = {
  ru: () => m.navLanguageRu(),
  en: () => m.navLanguageEn(),
} satisfies Record<(typeof locales)[number], () => string>;

function LanguageSwitcher() {
  const href = useLocation({ select: (location) => location.href });
  const currentLocale = getLocale();

  return (
    <div className="flex items-center gap-1 text-sm" aria-label="Language">
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground/50">/</span>}
          <a
            href={localizeHref(href, { locale })}
            aria-current={locale === currentLocale ? "page" : undefined}
            aria-label={LOCALE_LABELS[locale]()}
            title={LOCALE_LABELS[locale]()}
            className={cn(
              "px-1 uppercase",
              locale === currentLocale
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locale}
          </a>
        </span>
      ))}
    </div>
  );
}

function SiteHeader({ className }: { className?: string }) {
  return (
    <header data-slot="site-header" className={cn("border-b border-border", className)}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
        <Link to="/" aria-label={m.brandName()} className="shrink-0">
          <img src="/logo.png" alt={m.brandName()} className="h-8 w-auto sm:h-9" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm sm:gap-6">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground [&.active]:font-semibold [&.active]:text-foreground"
          >
            {m.navHome()}
          </Link>
          <Link
            to="/about"
            className="text-muted-foreground hover:text-foreground [&.active]:font-semibold [&.active]:text-foreground"
          >
            {m.navAbout()}
          </Link>
          <a
            href={TELEGRAM_FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1 text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {m.navFeedback()}
          </a>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}

export { SiteHeader };

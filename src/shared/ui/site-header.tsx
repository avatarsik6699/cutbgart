import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { m } from "@/paraglide/messages";
import { getLocale, localizeHref, locales } from "@/paraglide/runtime";
import { cn } from "@/shared/lib/utils";
import { BrandLogo } from "@/shared/ui/brand-logo";

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

function SiteHeader({
  className,
  utilitySlot,
  workspaceUtilityRef,
}: {
  className?: string;
  /** Page-supplied utility trigger (e.g. model storage) rendered before the
   * language switcher. `shared/ui` stays feature-agnostic — the caller
   * (`pages/*`) composes whatever feature-level content belongs here. */
  utilitySlot?: ReactNode;
  workspaceUtilityRef?: (node: HTMLSpanElement | null) => void;
}) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this marker is intentionally false in SSR and the first client render, then exposes when header links are safe to drive in hydration-sensitive browsers.
    setHydrated(true);
  }, []);

  return (
    <header
      data-slot="site-header"
      data-hydrated={hydrated}
      className={cn(
        "border-b border-border bg-background/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4 sm:px-8">
        <Link to="/" aria-label={m.brandName()} className="shrink-0">
          <BrandLogo />
        </Link>
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-x-6"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
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
          </div>
          <div className="flex shrink-0 items-center gap-x-1">
            {utilitySlot}
            <span
              ref={workspaceUtilityRef}
              className="grid min-h-9 min-w-9 shrink-0 place-items-center"
              data-testid="workspace-header-utilities"
            />
          </div>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}

export { SiteHeader };

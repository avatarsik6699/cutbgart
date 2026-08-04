import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib";

import { BrandLogo } from "./brand-logo";
import { LanguageSwitcher } from "./language-switcher";

const TELEGRAM_FEEDBACK_URL = "https://t.me/+HaqBWI1A3vg4MWJi";

type Props = {
  className?: string;
  homeActive?: boolean;
  /** Page-supplied utility trigger (e.g. model storage) rendered before the
   * language switcher. `shared/ui` stays feature-agnostic — the caller
   * (`pages/*`) composes whatever feature-level content belongs here. */
  utilitySlot?: ReactNode;
  onWorkspaceUtilityChange?: (node: HTMLSpanElement | null) => void;
};

function SiteHeader(props: Props) {
  const [hydrated, setHydrated] = useState(false);

  function setWorkspaceUtilityFx(node: HTMLSpanElement | null): void {
    props.onWorkspaceUtilityChange?.(node);
  }

  useEffect(function markHeaderHydratedFx() {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this marker is intentionally false in SSR and the first client render, then exposes when header links are safe to drive in hydration-sensitive browsers.
    setHydrated(true);
  }, []);

  return (
    <header
      data-slot="site-header"
      data-hydrated={hydrated}
      className={cn(
        "border-b border-border bg-background/90 backdrop-blur-md",
        props.className,
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
              className={cn(
                "text-muted-foreground hover:text-foreground [&.active]:font-semibold [&.active]:text-foreground",
                props.homeActive && "font-semibold text-foreground",
              )}
              aria-current={props.homeActive ? "page" : undefined}
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
            {props.utilitySlot}
            <span
              ref={setWorkspaceUtilityFx}
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

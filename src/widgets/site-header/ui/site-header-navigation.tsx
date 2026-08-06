import type { ReactNode } from "react";

import { m } from "@/paraglide/messages";
import { FeedbackLink, SiteLink } from "@/shared/ui";

import { LanguageSwitcher } from "./language-switcher";

type Props = Readonly<{
  HeaderUtilities?: ReactNode;
  homeActive?: boolean;
}>;

export function SiteHeaderNavigation(props: Props) {
  return (
    <nav
      aria-label="Main"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-x-6"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
        <SiteLink
          to="/"
          variant="navigation"
          forceActive={props.homeActive}
          aria-current={props.homeActive ? "page" : undefined}
        >
          {m.navHome()}
        </SiteLink>
        <SiteLink to="/about" variant="navigation">
          {m.navAbout()}
        </SiteLink>
        <FeedbackLink variant="header" />
      </div>
      <div className="flex shrink-0 items-center gap-x-1">{props.HeaderUtilities}</div>
      <LanguageSwitcher />
    </nav>
  );
}

import { ModelStorageTrigger } from "@/features/model-storage";
import { m } from "@/paraglide/messages";
import { FeedbackLink, SiteLink } from "@/shared/ui";
import { DiagnosticsSheet } from "@/widgets/editor";

import { LanguageSwitcher } from "./language-switcher";

const EMPTY_DIAGNOSTIC_LOGS = [] as const;

type Props = Readonly<{
  homeActive?: boolean;
  variant?: "default" | "home";
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
      <div className="flex shrink-0 items-center gap-x-1">
        {props.variant === "home" ? <ModelStorageTrigger /> : null}
        <DiagnosticsSheet logs={EMPTY_DIAGNOSTIC_LOGS} />
      </div>
      <LanguageSwitcher />
    </nav>
  );
}

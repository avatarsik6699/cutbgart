import type { ReactNode } from "react";

import { SiteFooter } from "@/widgets/site-footer";
import { SiteHeader } from "@/widgets/site-header";

type Props = Readonly<{
  children: ReactNode;
  homeNavigationActive?: boolean;
  variant?: "default" | "home";
}>;

function SiteShell(props: Props) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader
        className="relative z-30"
        homeActive={props.homeNavigationActive}
        variant={props.variant}
      />
      <div className="relative z-20 flex-1">
        <div
          aria-hidden="true"
          className="site-background-pattern pointer-events-none absolute inset-0 z-0"
        />
        <div className="relative z-10">{props.children}</div>
      </div>
      <SiteFooter className="relative z-10" />
    </div>
  );
}

export { SiteShell };

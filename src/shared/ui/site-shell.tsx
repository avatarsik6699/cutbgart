import { useState, type ReactNode } from "react";

import { HeaderUtilityPortalProvider } from "./header-utility-portal";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type Props = Readonly<{
  children: ReactNode;
  headerUtilitySlot?: ReactNode;
  homeNavigationActive?: boolean;
}>;

function SiteShell(props: Props) {
  const [workspaceUtilityTarget, setWorkspaceUtilityTarget] =
    useState<HTMLElement | null>(null);

  return (
    <HeaderUtilityPortalProvider target={workspaceUtilityTarget}>
      <div className="relative flex min-h-screen flex-col overflow-x-clip">
        <SiteHeader
          className="relative z-30"
          homeActive={props.homeNavigationActive}
          utilitySlot={props.headerUtilitySlot}
          onWorkspaceUtilityChange={setWorkspaceUtilityTarget}
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
    </HeaderUtilityPortalProvider>
  );
}

export { SiteShell };

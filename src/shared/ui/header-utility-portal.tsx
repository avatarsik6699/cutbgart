import type { ReactNode } from "react";

import { HeaderUtilityPortalContext } from "./header-utility-portal-context";
export function HeaderUtilityPortalProvider({
  target,
  children,
}: {
  target: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <HeaderUtilityPortalContext.Provider value={target}>
      {children}
    </HeaderUtilityPortalContext.Provider>
  );
}

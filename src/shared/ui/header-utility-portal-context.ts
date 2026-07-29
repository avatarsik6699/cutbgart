import { createContext, useContext } from "react";

export const HeaderUtilityPortalContext = createContext<HTMLElement | null>(null);

export function useHeaderUtilityPortalTarget() {
  return useContext(HeaderUtilityPortalContext);
}

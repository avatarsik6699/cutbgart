import type { ReactNode } from "react";

import { useIsHydrated, cn } from "@/shared/lib";

import { SiteHeaderBrand } from "./site-header-brand";
import { SiteHeaderNavigation } from "./site-header-navigation";

type Props = Readonly<{
  className?: string;
  homeActive?: boolean;
  HeaderUtilities?: ReactNode;
}>;

export function SiteHeader(props: Props) {
  const hydrated = useIsHydrated();

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
        <SiteHeaderBrand />
        <SiteHeaderNavigation
          HeaderUtilities={props.HeaderUtilities}
          homeActive={props.homeActive}
        />
      </div>
    </header>
  );
}

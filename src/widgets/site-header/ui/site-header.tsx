import { useIsHydrated, cn } from "@/shared/lib";

import { SiteHeaderBrand } from "./site-header-brand";
import { SiteHeaderNavigation } from "./site-header-navigation";

type Props = Readonly<{
  className?: string;
  homeActive?: boolean;
  variant?: "default" | "home";
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
        <SiteHeaderNavigation homeActive={props.homeActive} variant={props.variant} />
      </div>
    </header>
  );
}

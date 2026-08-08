import { m } from "@/paraglide/messages";
import { BrandLogo, SiteLink } from "@/shared/ui";

export function SiteHeaderBrand() {
  return (
    <SiteLink to="/" variant="plain" aria-label={m.brandName()} className="shrink-0">
      <BrandLogo />
    </SiteLink>
  );
}

import type { ComponentPropsWithRef } from "react";

import { cn } from "@/shared/lib";

export type SiteLinkVariant = "footer" | "navigation" | "plain";

export type SiteLinkAnchorProps = ComponentPropsWithRef<"a"> & {
  forceActive?: boolean;
  variant: SiteLinkVariant;
};

const VARIANT_CLASSES: Record<SiteLinkVariant, string | undefined> = {
  footer: "text-muted-foreground hover:text-foreground",
  navigation:
    "text-muted-foreground hover:text-foreground [&.active]:font-semibold [&.active]:text-foreground",
  plain: undefined,
};

function anchorAttributes(
  props: SiteLinkAnchorProps,
): Omit<SiteLinkAnchorProps, "className" | "forceActive" | "ref" | "variant"> {
  const { className, forceActive, ref, variant, ...attributes } = props;
  return attributes;
}

export function SiteLinkAnchor(props: SiteLinkAnchorProps) {
  return (
    <a
      {...anchorAttributes(props)}
      className={cn(
        VARIANT_CLASSES[props.variant],
        props.forceActive && "font-semibold text-foreground",
        props.className,
      )}
      ref={props.ref}
    />
  );
}

import type { ElementType, HTMLAttributes, Ref } from "react";

import { cn } from "@/shared/lib";

export type TypographyVariant =
  | "display"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "page-title"
  | "section-title"
  | "body"
  | "body-small"
  | "body-muted"
  | "caption"
  | "caption-muted"
  | "label"
  | "code";

export type TypographyElement = "h1" | "h2" | "h3" | "p" | "span" | "label" | "code";

export type TypographyProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  as?: TypographyElement;
  className?: string;
  ref?: Ref<HTMLElement>;
  variant: TypographyVariant;
};

const DEFAULT_ELEMENTS: Record<TypographyVariant, TypographyElement> = {
  display: "h1",
  "heading-1": "h1",
  "heading-2": "h2",
  "heading-3": "h3",
  "page-title": "h1",
  "section-title": "h2",
  body: "p",
  "body-small": "p",
  "body-muted": "p",
  caption: "span",
  "caption-muted": "p",
  label: "span",
  code: "code",
};

const VARIANT_CLASSES: Record<TypographyVariant, string> = {
  display:
    "font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl",
  "heading-1": "font-heading text-3xl font-semibold tracking-tight text-foreground",
  "heading-2": "font-heading text-2xl font-semibold tracking-tight text-foreground",
  "heading-3": "font-heading text-xl font-semibold text-foreground",
  "page-title": "text-2xl font-semibold",
  "section-title": "text-lg font-medium",
  body: "text-base leading-7 text-foreground",
  "body-small": "text-sm leading-6 text-foreground",
  "body-muted": "text-sm text-muted-foreground",
  caption: "text-xs leading-5 text-muted-foreground",
  "caption-muted": "text-xs text-muted-foreground",
  label: "font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground",
  code: "font-mono text-sm text-foreground",
};

function htmlProps(props: TypographyProps): HTMLAttributes<HTMLElement> {
  const { as, className, ref, variant, ...attributes } = props;
  return attributes;
}

export function Typography(props: TypographyProps) {
  const Element = (props.as ?? DEFAULT_ELEMENTS[props.variant]) as ElementType<
    HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }
  >;
  return (
    <Element
      {...htmlProps(props)}
      className={cn(VARIANT_CLASSES[props.variant], props.className)}
      ref={props.ref}
    />
  );
}
